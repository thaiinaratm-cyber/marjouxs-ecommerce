-- PROPOSED ROLLBACK ONLY. Restores the function read from the database.
-- Existing events are preserved, but order.paid can no longer be claimed.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION public.ecommerce_claim_outbox(p_event_types text[], p_limit integer DEFAULT 10)
 RETURNS TABLE(result_id uuid, result_order_id uuid, result_event_type text, result_payload jsonb, result_attempt_count integer, result_lock_token uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if p_event_types is null
 or pg_catalog.cardinality(p_event_types) = 0 then
 raise exception
 using errcode = '22023', message = 'Event types are required';
 end if;

 if exists (
 select 1
 from pg_catalog.unnest(p_event_types) as requested(event_type)
 where requested.event_type not in (
 'ga4_purchase',
 'erp_financial'
 )
 ) then
 raise exception
 using errcode = '22023', message = 'Unknown outbox event type';
 end if;

 if p_limit is null or p_limit not between 1 and 100 then
 raise exception
 using errcode = '22023', message = 'Invalid outbox batch size';
 end if;

 return query
 with candidates as (
 select outbox.id
 from public.ecommerce_integration_outbox as outbox
 where outbox.event_type = any (p_event_types)
 and (
 (
 outbox.status in ('pending', 'failed')
 and outbox.next_attempt_at <= pg_catalog.clock_timestamp()
 )
 or
 (
 outbox.status = 'processing'
 and outbox.locked_at <
 pg_catalog.clock_timestamp() - interval '10 minutes'
 )
 )
 order by outbox.next_attempt_at asc, outbox.created_at asc
 for update skip locked
 limit p_limit
 ),
 claimed as (
 update public.ecommerce_integration_outbox as outbox
 set
 status = 'processing',
 attempt_count = outbox.attempt_count + 1,
 lock_token = gen_random_uuid(),
 locked_at = pg_catalog.clock_timestamp(),
 last_error = null
 from candidates
 where outbox.id = candidates.id
 returning
 outbox.id,
 outbox.order_id,
 outbox.event_type,
 outbox.payload,
 outbox.attempt_count,
 outbox.lock_token
 )
 select
 claimed.id,
 claimed.order_id,
 claimed.event_type,
 claimed.payload,
 claimed.attempt_count,
 claimed.lock_token
 from claimed;
end;
$function$;

COMMIT;

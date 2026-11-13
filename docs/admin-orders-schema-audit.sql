-- Read-only metadata audit. No customer rows, writes, or business RPC calls.
-- Run in the Supabase SQL Editor and share the single JSON result.
SELECT jsonb_build_object(
  'columns', (
    SELECT jsonb_agg(to_jsonb(c) ORDER BY c.table_name, c.ordinal_position)
    FROM (
      SELECT table_schema, table_name, ordinal_position, column_name,
             data_type, udt_name, is_nullable, column_default,
             is_generated, generation_expression
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN (
          'ecommerce_orders', 'ecommerce_order_items',
          'ecommerce_payment_attempts', 'ecommerce_integration_outbox'
        )
    ) c
  ),
  'constraints', (
    SELECT jsonb_agg(jsonb_build_object(
      'table', t.relname, 'name', c.conname, 'type', c.contype,
      'definition', pg_get_constraintdef(c.oid, true), 'validated', c.convalidated
    ) ORDER BY t.relname, c.conname)
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname IN (
        'ecommerce_orders', 'ecommerce_order_items',
        'ecommerce_payment_attempts', 'ecommerce_integration_outbox'
      )
  ),
  'indexes', (
    SELECT jsonb_agg(to_jsonb(i) ORDER BY i.tablename, i.indexname)
    FROM pg_indexes i
    WHERE i.schemaname = 'public'
      AND i.tablename IN (
        'ecommerce_orders', 'ecommerce_order_items',
        'ecommerce_payment_attempts', 'ecommerce_integration_outbox'
      )
  ),
  'rls', (
    SELECT jsonb_agg(jsonb_build_object(
      'table', t.relname, 'enabled', t.relrowsecurity, 'forced', t.relforcerowsecurity
    ) ORDER BY t.relname)
    FROM pg_class t
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname IN (
        'ecommerce_orders', 'ecommerce_order_items',
        'ecommerce_payment_attempts', 'ecommerce_integration_outbox'
      )
  ),
  'policies', (
    SELECT jsonb_agg(to_jsonb(p) ORDER BY p.tablename, p.policyname)
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND p.tablename IN (
        'ecommerce_orders', 'ecommerce_order_items',
        'ecommerce_payment_attempts', 'ecommerce_integration_outbox'
      )
  ),
  'grants', (
    SELECT jsonb_agg(to_jsonb(g) ORDER BY g.table_name, g.grantee, g.privilege_type)
    FROM information_schema.table_privileges g
    WHERE g.table_schema = 'public'
      AND g.table_name IN (
        'ecommerce_orders', 'ecommerce_order_items',
        'ecommerce_payment_attempts', 'ecommerce_integration_outbox'
      )
  ),
  'column_grants', (
    SELECT jsonb_agg(to_jsonb(g) ORDER BY g.table_name, g.column_name, g.grantee, g.privilege_type)
    FROM information_schema.column_privileges g
    WHERE g.table_schema = 'public'
      AND g.table_name IN (
        'ecommerce_orders', 'ecommerce_order_items',
        'ecommerce_payment_attempts', 'ecommerce_integration_outbox'
      )
  ),
  'triggers', (
    SELECT jsonb_agg(jsonb_build_object(
      'table', t.relname, 'name', tr.tgname,
      'definition', pg_get_triggerdef(tr.oid, true),
      'function', p.proname, 'function_schema', pn.nspname,
      'function_definition', pg_get_functiondef(p.oid)
    ) ORDER BY t.relname, tr.tgname)
    FROM pg_trigger tr
    JOIN pg_class t ON t.oid = tr.tgrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_proc p ON p.oid = tr.tgfoid
    JOIN pg_namespace pn ON pn.oid = p.pronamespace
    WHERE n.nspname = 'public' AND NOT tr.tgisinternal
      AND t.relname IN (
        'ecommerce_orders', 'ecommerce_order_items',
        'ecommerce_payment_attempts', 'ecommerce_integration_outbox'
      )
  ),
  'functions', (
    SELECT jsonb_agg(jsonb_build_object(
      'schema', n.nspname, 'name', p.proname,
      'identity_arguments', pg_get_function_identity_arguments(p.oid),
      'arguments', pg_get_function_arguments(p.oid),
      'returns', pg_get_function_result(p.oid),
      'security_definer', p.prosecdef,
      'configuration', p.proconfig, 'acl', p.proacl,
      'definition', pg_get_functiondef(p.oid)
    ) ORDER BY p.proname, p.oid)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f'
      AND p.proname IN (
        'ecommerce_create_checkout', 'ecommerce_confirm_payment',
        'ecommerce_claim_outbox', 'ecommerce_complete_outbox',
        'ecommerce_fail_outbox', 'ecommerce_is_admin'
      )
  )
) AS schema_audit;

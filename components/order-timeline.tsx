import { Check, Circle } from "lucide-react";
import { getOrderTimeline } from "@/lib/order-status";
import type { PublicOrder } from "@/types/checkout";

export function OrderTimeline({ order }: { order: PublicOrder }) {
  const steps = getOrderTimeline(order);

  return (
    <ol
      aria-label="Andamento do pedido"
      className="mt-6 flex flex-col lg:flex-row"
    >
      {steps.map((step, index) => {
        const complete = step.state === "complete";
        const current = step.state === "current";
        const stateLabel = complete ? "Concluído" : current ? "Etapa atual" : "Próxima etapa";

        return (
          <li
            key={step.id}
            aria-current={current ? "step" : undefined}
            className="relative flex min-w-0 flex-1 gap-3 pb-5 last:pb-0 lg:flex-col lg:items-center lg:gap-2 lg:pb-0 lg:text-center"
          >
            {index < steps.length - 1 ? (
              <span
                aria-hidden="true"
                className={`absolute left-[13px] top-7 h-[calc(100%-1.75rem)] w-px lg:left-1/2 lg:top-[13px] lg:h-px lg:w-full ${
                  complete ? "bg-gold" : "bg-black/10"
                }`}
              />
            ) : null}
            <span
              className={`relative z-10 grid size-7 shrink-0 place-items-center rounded-full border ${
                complete
                  ? "border-gold bg-gold text-white"
                  : current
                    ? "border-gold bg-white text-gold ring-4 ring-gold/10"
                    : "border-black/15 bg-white text-black/25"
              }`}
              aria-hidden="true"
            >
              {complete ? <Check size={15} strokeWidth={2} /> : <Circle size={9} fill="currentColor" />}
            </span>
            <span className="min-w-0 pt-0.5 lg:px-1 lg:pt-0">
              <span
                className={`block text-sm font-semibold leading-5 ${
                  current || complete ? "text-ink" : "text-taupe"
                }`}
              >
                {step.label}
              </span>
              <span className={`mt-0.5 block text-xs ${current ? "text-gold" : "text-taupe"}`}>
                {stateLabel}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

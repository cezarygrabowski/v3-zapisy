import type { PaymentOffer } from "@/lib/fees"
import { cn } from "@/lib/utils"

export function FeesOfferList({
  offers,
  disabled,
  onPick,
}: {
  offers: PaymentOffer[]
  disabled?: boolean
  onPick: (offer: PaymentOffer) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      {offers.map((offer, index) => {
        const primary = index === offers.length - 1
        return (
          <button
            key={offer.amountKk}
            type="button"
            disabled={disabled}
            onClick={() => onPick(offer)}
            className={cn(
              "flex w-full items-center justify-between gap-4 rounded-xl px-3.5 py-3 text-left transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50",
              primary
                ? "bg-primary text-primary-foreground hover:bg-primary/80"
                : "bg-muted/50 ring-1 ring-foreground/10 hover:bg-muted"
            )}
          >
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="font-medium">{offer.title}</span>
              <span
                className={cn(
                  "text-xs",
                  primary ? "text-primary-foreground/70" : "text-muted-foreground"
                )}
              >
                {offer.detail}
              </span>
            </span>
            <span className="shrink-0 font-heading text-base font-semibold tabular-nums">
              {offer.amountKk} kk
            </span>
          </button>
        )
      })}
    </div>
  )
}

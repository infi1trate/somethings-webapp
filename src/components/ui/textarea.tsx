import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-24 w-full rounded-xl border border-input bg-card px-4 py-3 text-base leading-relaxed transition-[color,box-shadow,border-color] outline-none placeholder:text-muted-foreground hover:border-foreground/25 focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/15 disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-4 aria-invalid:ring-destructive/15",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }

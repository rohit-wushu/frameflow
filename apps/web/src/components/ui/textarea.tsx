import * as React from "react"
import { cn } from "cn"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2 text-base shadow-[inset_0_1px_2px_0_rgb(0_0_0/0.25)] transition-[color,background-color,border-color,box-shadow] outline-none placeholder:text-muted-foreground/70 hover:border-white/15 focus-visible:border-primary/70 focus-visible:bg-white/[0.05] focus-visible:ring-3 focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }

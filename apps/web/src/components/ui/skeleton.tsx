import { cn } from "cn"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-shimmer rounded-md bg-[linear-gradient(90deg,oklch(1_0_0/0.04)_0%,oklch(1_0_0/0.1)_50%,oklch(1_0_0/0.04)_100%)] bg-[length:200%_100%]", className)}
      {...props}
    />
  )
}

export { Skeleton }

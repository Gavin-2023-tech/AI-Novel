"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

export interface SeparatorProps {
  className?: string
  orientation?: "horizontal" | "vertical"
  decorative?: boolean
}

const Separator = React.forwardRef<
  HTMLDivElement,
  SeparatorProps
>(({ className, orientation = "horizontal", decorative = true, ...props }, ref) => (
  <div
    ref={ref}
    data-orientation={orientation}
    aria-orientation={decorative ? undefined : orientation}
    role={decorative ? "none" : "separator"}
    className={cn(
      "shrink-0 bg-border",
      orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]",
      className
    )}
    {...props}
  />
))
Separator.displayName = "Separator"

export { Separator }
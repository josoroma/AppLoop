"use client";

import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Avatar({ className, children, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("relative flex size-20 shrink-0 select-none items-center justify-center overflow-hidden rounded-full border bg-muted cv-avatar-root", className)}
      data-builder-id="cv-avatar-root"
      {...props}
    >
      {children}
    </div>
  );
}

export function AvatarFallback({ className, ...props }: ComponentProps<"span">) {
  return <span className={cn("flex size-full items-center justify-center rounded-full bg-muted text-muted-foreground cv-avatar-fallback", className)} data-builder-id="cv-avatar-fallback" {...props} />;
}

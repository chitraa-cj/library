import * as React from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Subtle hover hint for icon-only or otherwise ambiguous controls.
 * Shows a short (1-6 word) description on hover/focus. The `label` is expected
 * to already be translated (pass `t("...")`), so hints follow the reader's
 * chosen language. Renders children untouched when no label is provided.
 */
export function HintTooltip({
  label,
  side = "top",
  children,
}: {
  label?: string | null;
  side?: "top" | "bottom" | "left" | "right";
  children: React.ReactNode;
}) {
  if (!label) return <>{children}</>;
  return (
    <Tooltip delayDuration={350}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} className="max-w-[16rem] text-center">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

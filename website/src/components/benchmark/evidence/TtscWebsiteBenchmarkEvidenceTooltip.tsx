"use client";

import { useCallback, useState } from "react";
import type React from "react";

export interface TooltipLine {
  label: string;
  value: string;
  /** Drawn as the line's swatch. Omitted lines carry no swatch. */
  color?: string;
  opacity?: number;
  /** Set on the line the pointer is actually over. */
  active?: boolean;
}

export interface TooltipContent {
  title: string;
  subtitle?: string;
  lines: TooltipLine[];
  footer?: string;
}

/**
 * A cursor-following detail card for a chart that has no room to label itself.
 *
 * A stacked bar can only show the segment it drew, and the reading a viewer
 * wants is the one the bar cannot carry: which phase this band is, what it cost
 * on its own, and what share of the row it is. The native `title` attribute
 * shows one unstyled line after a delay the browser owns, which is not enough
 * for five phases and a remainder.
 *
 * Positioned `fixed` against the viewport, so it escapes the chart's own
 * `overflow-hidden` bars, and flipped near an edge so it never opens off
 * screen.
 */
export function useTtscWebsiteBenchmarkEvidenceTooltip() {
  const [state, setState] = useState<{
    content: TooltipContent;
    x: number;
    y: number;
  } | null>(null);

  const show = useCallback(
    (content: TooltipContent) =>
      (event: React.MouseEvent): void =>
        setState({ content, x: event.clientX, y: event.clientY }),
    [],
  );
  const hide = useCallback(() => setState(null), []);

  const node =
    state === null ? null : (
      <TooltipCard content={state.content} x={state.x} y={state.y} />
    );
  return { show, hide, node };
}

function TooltipCard({
  content,
  x,
  y,
}: {
  content: TooltipContent;
  x: number;
  y: number;
}) {
  // Flip before the card would leave the viewport rather than after, since a
  // card clipped at the right edge loses exactly the values it exists to show.
  const width = 300;
  const flip =
    typeof window !== "undefined" && x + width + 24 > window.innerWidth;
  return (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-50 rounded-lg border border-[#c7dff4] bg-white/97 px-3 py-2.5 text-[12px] shadow-[0_12px_32px_rgba(16,42,67,0.18)] backdrop-blur"
      style={{
        left: flip ? x - width - 16 : x + 16,
        top: Math.max(8, y - 12),
        width,
      }}
    >
      <p className="font-semibold text-[#102a43]">{content.title}</p>
      {content.subtitle ? (
        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-slate-400">
          {content.subtitle}
        </p>
      ) : null}
      <dl className="mt-2 space-y-1">
        {content.lines.map((line) => (
          <div
            key={line.label}
            className={`flex items-center gap-2 ${
              line.active ? "font-semibold text-[#102a43]" : "text-slate-500"
            }`}
          >
            {line.color ? (
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{
                  background: line.color,
                  opacity: line.opacity ?? 1,
                }}
              />
            ) : (
              <span className="h-2.5 w-2.5 shrink-0" />
            )}
            <dt className="min-w-0 flex-1 truncate">{line.label}</dt>
            <dd className="shrink-0 tabular-nums">{line.value}</dd>
          </div>
        ))}
      </dl>
      {content.footer ? (
        <p className="mt-2 border-t border-[#eef4fa] pt-1.5 text-[11px] text-slate-400">
          {content.footer}
        </p>
      ) : null}
    </div>
  );
}

export default useTtscWebsiteBenchmarkEvidenceTooltip;

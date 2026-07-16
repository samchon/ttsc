"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { IPlaygroundExample } from "../structures/IPlaygroundExample";

interface ExamplePickerProps {
  examples: readonly IPlaygroundExample[];
  onPick: (id: string) => void;
  /** Display labels for groups. Maps `group` key → rendered heading. */
  groupLabels?: Record<string, string>;
}

export function ExamplePicker({
  examples,
  onPick,
  groupLabels,
}: ExamplePickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const grouped = useMemo(() => {
    return examples.reduce<Record<string, IPlaygroundExample[]>>((acc, e) => {
      const key = e.group ?? "Examples";
      (acc[key] ??= []).push(e);
      return acc;
    }, {});
  }, [examples]);

  if (examples.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        data-playground-examples-toggle
        onClick={() => setOpen((v) => !v)}
        className="rounded-md border border-[#b9d5ee] bg-white px-3 py-1.5 font-mono text-xs text-[#235a97] transition-colors hover:border-[#3178c6] hover:bg-[#eaf4ff]"
        title="Cmd/Ctrl+K"
      >
        Examples ▾
      </button>
      {open && (
        <div className="absolute right-0 top-full z-10 mt-2 w-80 overflow-hidden rounded-xl border border-[#b9d5ee] bg-white shadow-[0_14px_42px_rgba(49,120,198,0.18)]">
          {Object.entries(grouped).map(([group, items]) => (
            <div
              key={group}
              className="border-b border-[#d8e7f4] last:border-b-0"
            >
              <div className="bg-[#f7fbff] px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-slate-500">
                {groupLabels?.[group] ?? group}
              </div>
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    onPick(item.id);
                    setOpen(false);
                  }}
                  className="w-full px-3 py-2 text-left transition-colors hover:bg-[#eaf4ff]"
                >
                  <div className="font-mono text-[12px] text-[#102a43]">
                    {item.title}
                  </div>
                  <div className="mt-0.5 text-[10px] leading-snug text-slate-500">
                    {item.description}
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

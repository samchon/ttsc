"use client";

import { useEffect, useRef, useState } from "react";

import { PLAYGROUND_EXAMPLES } from "../../compiler/PlaygroundExamples";

const GROUP_LABEL: Record<string, string> = {
  typia: "typia",
  lint: "@ttsc/lint",
  mixed: "mixed",
};

export default function ExamplePicker({
  onPick,
}: {
  onPick: (id: string) => void;
}) {
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

  const grouped = PLAYGROUND_EXAMPLES.reduce<
    Record<string, typeof PLAYGROUND_EXAMPLES>
  >((acc, e) => {
    (acc[e.group] ??= []).push(e);
    return acc;
  }, {});

  return (
    <div ref={ref} className="relative">
      <button
        data-playground-examples-toggle
        onClick={() => setOpen((v) => !v)}
        className="px-3 py-1.5 text-xs font-mono text-neutral-300 border border-neutral-800 rounded-md hover:border-neutral-600 hover:bg-neutral-900 transition-colors"
        title="Cmd/Ctrl+K"
      >
        Examples ▾
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-lg border border-neutral-800 bg-neutral-950 shadow-[0_10px_40px_rgba(0,0,0,0.6)] z-10 overflow-hidden">
          {Object.entries(grouped).map(([group, items]) => (
            <div key={group} className="border-b border-neutral-900 last:border-b-0">
              <div className="px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-neutral-600">
                {GROUP_LABEL[group] ?? group}
              </div>
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    onPick(item.id);
                    setOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 hover:bg-neutral-900 transition-colors"
                >
                  <div className="text-[12px] font-mono text-neutral-100">
                    {item.title}
                  </div>
                  <div className="text-[10px] text-neutral-500 mt-0.5 leading-snug">
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

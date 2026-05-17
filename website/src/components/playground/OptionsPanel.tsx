"use client";

import { useEffect, useRef } from "react";

import type { ITransformOptions } from "../../compiler/ITransformOptions";

interface OptionsPanelProps {
  options: ITransformOptions;
  onChange: (next: ITransformOptions) => void;
  onClose: () => void;
}

interface ToggleSpec {
  key: keyof ITransformOptions;
  label: string;
  description: string;
}

const TOGGLES: ToggleSpec[] = [
  {
    key: "typia",
    label: "typia",
    description: "Generate runtime validators from TypeScript types.",
  },
  {
    key: "lint",
    label: "@ttsc/lint",
    description: "Report a subset of lint rules over the source AST.",
  },
];

export default function OptionsPanel({
  options,
  onChange,
  onClose,
}: OptionsPanelProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  const toggle = (key: keyof ITransformOptions) =>
    onChange({ ...options, [key]: !options[key] });

  // Escape closes. Focus traps inside the dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    // Auto-focus the first focusable on mount.
    const focusable = dialogRef.current?.querySelector<HTMLElement>(
      'button, input, [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="playground-options-title"
        className="w-[480px] max-w-[90vw] rounded-2xl border border-neutral-800 bg-neutral-950 shadow-[0_30px_80px_rgba(0,0,0,0.7)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800/70">
          <h2
            id="playground-options-title"
            className="text-base font-semibold text-white"
          >
            Transform Options
          </h2>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-white transition-colors"
            aria-label="Close options"
          >
            ✕
          </button>
        </div>
        <div className="p-6 space-y-6">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-600 mb-3">
              Plugins
            </div>
            <div className="space-y-3">
              {TOGGLES.map((t) => (
                <label
                  key={t.key}
                  className="flex items-start gap-3 cursor-pointer group"
                >
                  <input
                    type="checkbox"
                    checked={!!options[t.key]}
                    onChange={() => toggle(t.key)}
                    className="mt-1 w-4 h-4 accent-blue-500"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-mono text-neutral-100 group-hover:text-white transition-colors">
                      {t.label}
                    </div>
                    <div className="text-[11px] text-neutral-500 leading-snug">
                      {t.description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-neutral-800/70 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-mono text-neutral-900 bg-white rounded-md hover:shadow-[0_0_30px_rgba(255,255,255,0.2)] transition-shadow"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";

import type { IOptionToggle } from "../structures/IOptionToggle";
import type { ITransformOptions } from "../structures/ITransformOptions";
import { DEFAULT_OPTION_TOGGLES } from "./DEFAULT_OPTION_TOGGLES";

interface OptionsPanelProps {
  options: ITransformOptions;
  onChange: (next: ITransformOptions) => void;
  onClose: () => void;
  /** Defaults to the typia + lint pair from `DEFAULT_OPTION_TOGGLES`. */
  toggles?: readonly IOptionToggle[];
  /** Dialog heading. Defaults to "Transform Options". */
  title?: string;
}

export function OptionsPanel({
  options,
  onChange,
  onClose,
  toggles = DEFAULT_OPTION_TOGGLES,
  title = "Transform Options",
}: OptionsPanelProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  const toggle = (key: string) =>
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#102a43]/35 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="playground-options-title"
        className="w-[480px] max-w-[90vw] rounded-2xl border border-[#b9d5ee] bg-white shadow-[0_30px_80px_rgba(35,90,151,0.25)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#c7dff4] bg-[#f7fbff] px-6 py-4">
          <h2
            id="playground-options-title"
            className="text-base font-semibold text-[#102a43]"
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 transition-colors hover:text-[#235a97]"
            aria-label="Close options"
          >
            ✕
          </button>
        </div>
        <div className="p-6 space-y-6">
          <div>
            <div className="mb-3 font-mono text-[10px] uppercase tracking-wider text-slate-500">
              Plugins
            </div>
            <div className="space-y-3">
              {toggles.map((t) => (
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
                    <div className="font-mono text-sm text-slate-800 transition-colors group-hover:text-[#235a97]">
                      {t.label}
                    </div>
                    <div className="text-[11px] leading-snug text-slate-500">
                      {t.description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end border-t border-[#c7dff4] bg-[#f7fbff] px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-md bg-[#3178c6] px-4 py-2 font-mono text-xs text-white transition-colors hover:bg-[#235a97]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import type { JSX } from "react";

import type { IConsoleMessage } from "../structures/IConsoleMessage";

interface ConsoleViewerProps {
  messages: IConsoleMessage[];
  empty?: string;
}

export function ConsoleViewer({
  messages,
  empty = "No output yet. Click Execute to run the compiled JavaScript.",
}: ConsoleViewerProps) {
  if (messages.length === 0)
    return (
      <div className="flex h-full w-full items-center justify-center px-4 text-center font-mono text-[11px] text-slate-400">
        {empty}
      </div>
    );
  return (
    <div className="h-full w-full overflow-auto p-3 font-mono text-[12px] leading-snug">
      {messages.map((msg, i) => (
        <div
          key={i}
          className="flex gap-2 border-b border-[#d8e7f4] py-1 last:border-b-0"
        >
          <span
            className={`shrink-0 text-[10px] uppercase tracking-wider w-12 ${typeColor(
              msg.type,
            )}`}
          >
            {msg.type}
          </span>
          <span className="flex-1 whitespace-pre-wrap break-words text-slate-700">
            {(Array.isArray(msg.value) ? msg.value : [msg.value]).map(
              (arg, idx) => (
                <span key={idx}>
                  {idx > 0 ? " " : ""}
                  {formatValue(arg)}
                </span>
              ),
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

function typeColor(type: IConsoleMessage["type"]): string {
  switch (type) {
    case "error":
      return "text-red-600";
    case "warn":
      return "text-amber-600";
    case "info":
      return "text-sky-700";
    case "debug":
      return "text-fuchsia-700";
    case "dir":
    case "table":
      return "text-cyan-700";
    default:
      return "text-emerald-700";
  }
}

function formatValue(value: unknown, depth = 0): JSX.Element {
  if (typeof value === "string")
    return <span className="text-amber-700">{JSON.stringify(value)}</span>;
  if (typeof value === "number")
    return <span className="text-purple-700">{String(value)}</span>;
  if (typeof value === "boolean")
    return <span className="text-sky-700">{String(value)}</span>;
  if (value === null) return <span className="text-slate-500">null</span>;
  if (value === undefined)
    return <span className="text-slate-500">undefined</span>;
  if (typeof value === "function")
    return <span className="text-slate-500">[Function]</span>;
  if (Array.isArray(value))
    return (
      <span>
        [
        {value.map((item, idx) => (
          <span key={idx}>
            {idx > 0 ? ", " : ""}
            {formatValue(item, depth + 1)}
          </span>
        ))}
        ]
      </span>
    );
  if (value instanceof Error)
    return (
      <span className="text-red-700">
        {value.name}: {value.message}
      </span>
    );
  try {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return <span>{"{}"}</span>;
    if (depth > 4) return <span className="text-slate-500">[...]</span>;
    return (
      <span>
        {"{"}
        {entries.map(([k, v], idx) => (
          <span key={k}>
            {idx > 0 ? ", " : " "}
            <span className="text-[#3178c6]">{k}</span>:{" "}
            {formatValue(v, depth + 1)}
          </span>
        ))}
        {" }"}
      </span>
    );
  } catch {
    return <span>{String(value)}</span>;
  }
}

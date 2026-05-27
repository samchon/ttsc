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
      <div className="h-full w-full flex items-center justify-center text-neutral-600 font-mono text-[11px] px-4 text-center">
        {empty}
      </div>
    );
  return (
    <div className="h-full w-full overflow-auto p-3 font-mono text-[12px] leading-snug">
      {messages.map((msg, i) => (
        <div
          key={i}
          className="py-1 border-b border-neutral-900/70 last:border-b-0 flex gap-2"
        >
          <span
            className={`shrink-0 text-[10px] uppercase tracking-wider w-12 ${typeColor(
              msg.type,
            )}`}
          >
            {msg.type}
          </span>
          <span className="flex-1 break-words whitespace-pre-wrap text-neutral-200">
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
      return "text-red-400";
    case "warn":
      return "text-yellow-400";
    case "info":
      return "text-sky-400";
    case "debug":
      return "text-fuchsia-400";
    case "dir":
    case "table":
      return "text-cyan-400";
    default:
      return "text-emerald-400";
  }
}

function formatValue(value: unknown, depth = 0): JSX.Element {
  if (typeof value === "string")
    return <span className="text-amber-200">{JSON.stringify(value)}</span>;
  if (typeof value === "number")
    return <span className="text-purple-300">{String(value)}</span>;
  if (typeof value === "boolean")
    return <span className="text-sky-300">{String(value)}</span>;
  if (value === null) return <span className="text-neutral-500">null</span>;
  if (value === undefined)
    return <span className="text-neutral-500">undefined</span>;
  if (typeof value === "function")
    return <span className="text-neutral-500">[Function]</span>;
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
      <span className="text-red-300">
        {value.name}: {value.message}
      </span>
    );
  try {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return <span>{"{}"}</span>;
    if (depth > 4) return <span className="text-neutral-500">[...]</span>;
    return (
      <span>
        {"{"}
        {entries.map(([k, v], idx) => (
          <span key={k}>
            {idx > 0 ? ", " : " "}
            <span className="text-blue-300">{k}</span>:{" "}
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

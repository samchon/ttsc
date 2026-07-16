"use client";

import Editor from "@monaco-editor/react";
import { useEffect, useRef, useState } from "react";

interface ResultViewerProps {
  language: "typescript" | "javascript" | "json";
  value: string;
}

/**
 * Read-only Monaco pane used to render the compiled / transformed output with a
 * copy button. Wraps `<Editor readOnly>` and adds the toast UI.
 */
export function ResultViewer({ language, value }: ResultViewerProps) {
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (copiedTimer.current !== null)
        window.clearTimeout(copiedTimer.current);
    },
    [],
  );

  const onCopy = () => {
    void navigator.clipboard.writeText(value);
    setCopied(true);
    if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);
    copiedTimer.current = window.setTimeout(() => {
      setCopied(false);
      copiedTimer.current = null;
    }, 1500);
  };

  return (
    <div className="relative h-full w-full">
      {value && (
        <button
          onClick={onCopy}
          className="absolute right-3 top-2 z-10 rounded-md border border-[#b9d5ee] bg-white/90 px-2 py-1 font-mono text-[10px] text-[#235a97] shadow-sm transition-colors hover:bg-[#eaf4ff]"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      )}
      <Editor
        height="100%"
        language={language}
        theme="vs"
        value={value}
        path={`output.${
          language === "typescript"
            ? "ts"
            : language === "javascript"
              ? "js"
              : "json"
        }`}
        options={{
          readOnly: true,
          tabSize: 2,
          minimap: { enabled: false },
          padding: { top: 12, bottom: 12 },
          fontSize: 13,
          fontFamily:
            "ui-monospace, SFMono-Regular, 'JetBrains Mono', 'Fira Code', Consolas, monospace",
          smoothScrolling: true,
          scrollBeyondLastLine: false,
          renderLineHighlight: "none",
          wordWrap: "on",
        }}
      />
    </div>
  );
}

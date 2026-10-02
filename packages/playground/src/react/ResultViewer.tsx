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
 *
 * @evidence contracts/common.md#principled-implementation Controlled text and language select a read-only model; copy feedback follows actual clipboard settlement, and attempt identity prevents old or unmounted requests from publishing feedback.
 * @evidence contracts/common.md#clear-and-simple-design Output viewing and local copy feedback stay separate from compilation and source editing.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The read-only editor uses supported Monaco options rather than replacing editor methods.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains viewing and copy presentation; copied and failed labels distinguish actual clipboard outcomes under the documentation skill.
  * @evidence contracts/performance.md#bound-retention-and-release-resources The copy-feedback timer is cleared on the next copy or unmount, and the epoch counter discards stale clipboard settlements.
  * @evidenceExclude contracts/performance.md#efficient-algorithms A single pass or constant work over its arguments; no algorithm choice scales beyond that.
  * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call serves one request; there is no equivalent work to share across calls.
  * @evidenceExclude contracts/portability.md#os-neutral-implementation Browser UI logic with no native filesystem, path-identity or process boundary.
 */
export function ResultViewer({ language, value }: ResultViewerProps) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const copyEpoch = useRef(0);
  const copiedTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      ++copyEpoch.current;
      if (copiedTimer.current !== null)
        window.clearTimeout(copiedTimer.current);
    },
    [],
  );

  const onCopy = () => {
    const epoch = ++copyEpoch.current;
    setCopied(false);
    setCopyFailed(false);
    if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);
    copiedTimer.current = null;
    void Promise.resolve()
      .then(() => navigator.clipboard.writeText(value))
      .then(
        () => {
          if (copyEpoch.current !== epoch) return;
          setCopied(true);
          copiedTimer.current = window.setTimeout(() => {
            setCopied(false);
            copiedTimer.current = null;
          }, 1500);
        },
        () => {
          if (copyEpoch.current === epoch) setCopyFailed(true);
        },
      );
  };

  return (
    <div className="relative h-full w-full">
      {value && (
        <button
          onClick={onCopy}
          className="absolute right-3 top-2 z-10 rounded-md border border-[#b9d5ee] bg-white/90 px-2 py-1 font-mono text-[10px] text-[#235a97] shadow-sm transition-colors hover:bg-[#eaf4ff]"
        >
          {copied ? "Copied ✓" : copyFailed ? "Copy failed" : "Copy"}
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

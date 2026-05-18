"use client";

import { useState } from "react";

const MANAGERS: Record<string, string> = {
  npm: "npm install -D ttsc @ttsc/lint @typescript/native-preview",
  pnpm: "pnpm add -D ttsc @ttsc/lint @typescript/native-preview",
  yarn: "yarn add -D ttsc @ttsc/lint @typescript/native-preview",
  bun: "bun add -d ttsc @ttsc/lint @typescript/native-preview",
};

export default function InstallTabs() {
  const [active, setActive] = useState<keyof typeof MANAGERS>("npm");
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(MANAGERS[active]);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="w-full max-w-2xl mx-auto rounded-2xl border border-neutral-800/80 bg-neutral-950 overflow-hidden">
      <div className="flex items-center justify-between border-b border-neutral-800/80 px-3">
        <div className="flex">
          {Object.keys(MANAGERS).map((mgr) => (
            <button
              key={mgr}
              onClick={() => setActive(mgr as keyof typeof MANAGERS)}
              className={`px-3 py-2.5 text-xs font-mono tracking-wider transition-colors ${
                active === mgr
                  ? "text-cyan-300 border-b border-cyan-300/60 -mb-px"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              {mgr}
            </button>
          ))}
        </div>
        <button
          onClick={copy}
          className="text-[11px] font-mono text-neutral-500 hover:text-neutral-300 transition-colors px-2 py-1"
        >
          {copied ? "✓ copied" : "copy"}
        </button>
      </div>
      <pre className="px-4 py-4 text-[13px] md:text-[14px] font-mono text-neutral-300 overflow-x-auto">
        <span className="text-emerald-400 select-none">$ </span>
        {MANAGERS[active]}
      </pre>
    </div>
  );
}

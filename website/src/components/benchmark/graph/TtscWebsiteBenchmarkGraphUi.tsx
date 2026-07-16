import type React from "react";

const ACCENT = "#3178c6";

const TTSC_FILL = `linear-gradient(90deg, ${ACCENT}, #72afe6)`;
const CODEGRAPH_FILL = "linear-gradient(90deg, #f59e0b, #d97706)";
const CODEGRAPH_TEXT = "#b45309";
const CODEBASE_MEMORY_FILL = "linear-gradient(90deg, #4ade80, #15803d)";
const CODEBASE_MEMORY_TEXT = "#15803d";
const SERENA_FILL = "linear-gradient(90deg, #c084fc, #7e22ce)";
const SERENA_TEXT = "#7e22ce";

const panelClass =
  "overflow-hidden rounded-xl border border-[#c7dff4] bg-white shadow-[0_18px_48px_rgba(49,120,198,0.11)]";

/** Mono uppercase eyebrow, mirrors the landing SectionEyebrow voice. */
function Eyebrow({ label }: { label: string }) {
  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.22em]">
      <span style={{ color: ACCENT }}>[</span>
      <span className="mx-2 text-slate-500">{label}</span>
      <span style={{ color: ACCENT }}>]</span>
    </p>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
  aside,
}: {
  eyebrow: string;
  title: string;
  description: string;
  aside?: string;
}) {
  return (
    <div className="relative flex flex-wrap items-start justify-between gap-3 overflow-hidden border-b border-[#c7dff4] bg-gradient-to-b from-[#f7fbff] to-[#eef6ff] px-5 py-4">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background: `linear-gradient(to right, transparent, ${ACCENT}66, transparent)`,
        }}
      />
      <div>
        <Eyebrow label={eyebrow} />
        <h3 className="mt-2.5 text-[17px] font-semibold tracking-tight text-[#102a43]">
          {title}
        </h3>
        <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-slate-500">
          {description}
        </p>
      </div>
      {aside ? (
        <span className="shrink-0 rounded-full border border-[#b9d5ee] bg-white px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-slate-500">
          {aside}
        </span>
      ) : null}
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="not-prose my-6 rounded-xl border border-[#c7dff4] bg-white px-4 py-3 font-mono text-[12px] text-slate-500">
      {children}
    </p>
  );
}

const TtscWebsiteBenchmarkGraphUi = {
  ACCENT,
  CODEBASE_MEMORY_FILL,
  CODEBASE_MEMORY_TEXT,
  CODEGRAPH_FILL,
  CODEGRAPH_TEXT,
  Notice,
  SERENA_FILL,
  SERENA_TEXT,
  SectionHeader,
  TTSC_FILL,
  panelClass,
};

export default TtscWebsiteBenchmarkGraphUi;

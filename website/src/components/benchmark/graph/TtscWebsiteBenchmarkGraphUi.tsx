import type React from "react";

const ACCENT = "#36e2ee";

const TTSC_FILL = `linear-gradient(90deg, ${ACCENT}, #19b6c9)`;
const CODEGRAPH_FILL = "linear-gradient(90deg, #f5b042, #d97706)";
const CODEGRAPH_TEXT = "#f5b042";
const CODEBASE_MEMORY_FILL = "linear-gradient(90deg, #8bdc65, #3f9f4a)";
const CODEBASE_MEMORY_TEXT = "#8bdc65";
const SERENA_FILL = "linear-gradient(90deg, #e879f9, #a855f7)";
const SERENA_TEXT = "#e879f9";

const panelClass =
  "overflow-hidden rounded-lg border border-[#222834] bg-[#0c0e13] shadow-[0_24px_60px_rgba(0,0,0,0.35)]";

/** Mono uppercase eyebrow, mirrors the landing SectionEyebrow voice. */
function Eyebrow({ label }: { label: string }) {
  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.22em]">
      <span style={{ color: ACCENT }}>[</span>
      <span className="mx-2 text-neutral-400">{label}</span>
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
    <div className="relative flex flex-wrap items-start justify-between gap-3 overflow-hidden border-b border-[#222834] bg-gradient-to-b from-[#13171f] to-[#0e1116] px-5 py-4">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background: `linear-gradient(to right, transparent, ${ACCENT}66, transparent)`,
        }}
      />
      <div>
        <Eyebrow label={eyebrow} />
        <h3 className="mt-2.5 text-[17px] font-semibold tracking-tight text-neutral-50">
          {title}
        </h3>
        <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-neutral-400">
          {description}
        </p>
      </div>
      {aside ? (
        <span className="shrink-0 rounded-full border border-[#2a313e] bg-[#0c0e13] px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-neutral-500">
          {aside}
        </span>
      ) : null}
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="not-prose my-6 rounded-lg border border-[#222834] bg-[#0c0e13] px-4 py-3 font-mono text-[12px] text-neutral-400">
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

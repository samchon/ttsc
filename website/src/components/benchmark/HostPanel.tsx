"use client";

import type { BenchmarkHost } from "./types";

/**
 * The machine the published numbers were measured on.
 *
 * Speedups are only meaningful next to the hardware and toolchain versions that
 * produced them, so this panel sits directly above the project cards.
 */
export default function HostPanel({
  host,
  date,
}: {
  host: BenchmarkHost;
  date: string;
}) {
  const measured = new Date(date);
  const measuredLabel = Number.isNaN(measured.getTime())
    ? date
    : measured.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });

  const specs: { label: string; value: string }[] = [
    { label: "CPU", value: fallback(host.cpu) },
    {
      label: "Cores",
      value: host.cores ? `${host.cores} logical` : "not recorded",
    },
    {
      label: "Memory",
      value: host.ramGB ? `${host.ramGB} GB` : "not recorded",
    },
    { label: "OS", value: fallback(host.os) },
    { label: "Kernel", value: fallback(host.kernel) },
    { label: "Node.js", value: fallback(host.node) },
    { label: "ttsc", value: fallback(host.ttsc) },
    { label: "tsgo", value: fallback(host.tsgo) },
    { label: "TypeScript", value: fallback(host.typescript) },
  ];

  return (
    <section className="not-prose overflow-hidden rounded-md border border-[#262b36] bg-[#0f1115] shadow-[0_12px_30px_rgba(0,0,0,0.22)]">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[#262b36] bg-[#121620] px-4 py-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-sky-300">
          Measurement host
        </p>
        <p className="font-mono text-[11px] text-neutral-500">
          measured {measuredLabel}
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-px bg-[#262b36] sm:grid-cols-4">
        {specs.map((spec) => (
          <div key={spec.label} className="bg-[#0f1115] px-4 py-3">
            <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-neutral-500">
              {spec.label}
            </dt>
            <dd className="mt-1 text-sm font-semibold text-neutral-100">
              {spec.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function fallback(value: string | undefined) {
  return value && value.length > 0 ? value : "not recorded";
}

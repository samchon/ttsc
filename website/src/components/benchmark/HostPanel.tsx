"use client";

import type { BenchmarkHost } from "./types";

/**
 * The machine the published numbers were measured on.
 *
 * Speedups are only meaningful next to the hardware and toolchain versions
 * that produced them, so this panel sits directly above the project cards.
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
    { label: "CPU", value: host.cpu },
    { label: "Cores", value: `${host.cores} logical` },
    { label: "Memory", value: `${host.ramGB} GB` },
    { label: "OS", value: host.os },
    { label: "Kernel", value: host.kernel },
    { label: "Node.js", value: host.node },
    { label: "ttsc", value: host.ttsc },
    { label: "TypeScript", value: host.typescript },
  ];

  return (
    <section className="not-prose my-8 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/60">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-neutral-200 px-5 py-3 dark:border-neutral-800">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-cyan-600 dark:text-cyan-300">
          Measurement host
        </p>
        <p className="font-mono text-[11px] text-neutral-500">
          measured {measuredLabel}
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-px bg-neutral-200 sm:grid-cols-4 dark:bg-neutral-800">
        {specs.map((spec) => (
          <div
            key={spec.label}
            className="bg-neutral-50 px-5 py-3.5 dark:bg-neutral-900/60"
          >
            <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">
              {spec.label}
            </dt>
            <dd className="mt-1 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              {spec.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

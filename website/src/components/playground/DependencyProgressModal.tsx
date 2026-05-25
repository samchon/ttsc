"use client";

import type { IPlaygroundDependencyProgress } from "../../compiler/npm-dependencies";

interface DependencyProgressModalProps {
  progress: IPlaygroundDependencyProgress | null;
  packages: readonly string[];
}

export default function DependencyProgressModal({
  progress,
  packages,
}: DependencyProgressModalProps) {
  if (!progress) return null;
  const total = Math.max(progress.total, 1);
  const ratio = Math.min(1, Math.max(0, progress.completed / total));
  const activePackage =
    progress.packageName && progress.version
      ? `${progress.packageName}@${progress.version}`
      : progress.packageName;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-md rounded-lg border border-neutral-700 bg-neutral-950 p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-mono uppercase text-blue-300">
              Dependencies
            </div>
            <h2 className="mt-1 text-base font-mono text-white">
              Installing npm packages
            </h2>
          </div>
          <div className="text-[11px] font-mono text-neutral-500">
            {progress.completed}/{total}
          </div>
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-neutral-800">
          <div
            className="h-full bg-blue-400 transition-[width]"
            style={{ width: `${Math.max(8, ratio * 100)}%` }}
          />
        </div>

        <div className="mt-4 space-y-1 font-mono">
          {activePackage && (
            <div className="text-[12px] text-neutral-200">{activePackage}</div>
          )}
          <div className="text-[11px] text-neutral-400">{progress.message}</div>
        </div>

        {packages.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {packages.slice(0, 8).map((name) => (
              <span
                key={name}
                className="rounded border border-neutral-800 bg-neutral-900 px-2 py-1 text-[10px] font-mono text-neutral-300"
              >
                {name}
              </span>
            ))}
            {packages.length > 8 && (
              <span className="rounded border border-neutral-800 bg-neutral-900 px-2 py-1 text-[10px] font-mono text-neutral-500">
                +{packages.length - 8}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

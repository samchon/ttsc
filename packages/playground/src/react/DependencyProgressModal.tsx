"use client";

import type { IPlaygroundDependencyProgress } from "../structures/IPlaygroundDependencyProgress";

interface DependencyProgressModalProps {
  progress: IPlaygroundDependencyProgress | null;
  packages: readonly string[];
}

export function DependencyProgressModal({
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#102a43]/35 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-[#b9d5ee] bg-white p-5 shadow-[0_28px_70px_rgba(35,90,151,0.25)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="font-mono text-[11px] uppercase text-[#3178c6]">
              Dependencies
            </div>
            <h2 className="mt-1 font-mono text-base text-[#102a43]">
              Installing npm packages
            </h2>
          </div>
          <div className="font-mono text-[11px] text-slate-500">
            {progress.completed}/{total}
          </div>
        </div>

        <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#e7f0f8]">
          <div
            className="h-full bg-[#3178c6] transition-[width]"
            style={{ width: `${Math.max(8, ratio * 100)}%` }}
          />
        </div>

        <div className="mt-4 space-y-1 font-mono">
          {activePackage && (
            <div className="text-[12px] text-slate-700">{activePackage}</div>
          )}
          <div className="text-[11px] text-slate-500">{progress.message}</div>
        </div>

        {packages.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {packages.slice(0, 8).map((name) => (
              <span
                key={name}
                className="rounded border border-[#d2e4f4] bg-[#f7fbff] px-2 py-1 font-mono text-[10px] text-slate-600"
              >
                {name}
              </span>
            ))}
            {packages.length > 8 && (
              <span className="rounded border border-[#d2e4f4] bg-[#f7fbff] px-2 py-1 font-mono text-[10px] text-slate-500">
                +{packages.length - 8}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

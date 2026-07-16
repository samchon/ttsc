"use client";

import dynamic from "next/dynamic";

const TtscWebsitePlaygroundShell = dynamic(
  () => import("../../components/playground/TtscWebsitePlaygroundShell"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[calc(100vh-64px)] w-full items-center justify-center bg-[#f7fbff] font-mono text-sm text-slate-500">
        Loading playground…
      </div>
    ),
  },
);

export default function PlaygroundPage() {
  return <TtscWebsitePlaygroundShell />;
}

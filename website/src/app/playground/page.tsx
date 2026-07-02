"use client";

import dynamic from "next/dynamic";

const TtscWebsitePlaygroundShell = dynamic(
  () => import("../../components/playground/TtscWebsitePlaygroundShell"),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center w-full h-[calc(100vh-64px)] text-neutral-400 font-mono text-sm">
        Loading playground…
      </div>
    ),
  },
);

export default function PlaygroundPage() {
  return <TtscWebsitePlaygroundShell />;
}

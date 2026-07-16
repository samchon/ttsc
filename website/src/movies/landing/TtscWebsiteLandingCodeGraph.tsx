"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";

import TtscWebsiteBenchmarkGraphChart from "../../components/benchmark/graph/TtscWebsiteBenchmarkGraphChart";
import TtscWebsiteBenchmarkGraphData from "../../components/benchmark/graph/TtscWebsiteBenchmarkGraphData";
import TtscWebsiteBenchmarkGraphReductionTools from "../../components/benchmark/graph/TtscWebsiteBenchmarkGraphReductionTools";
import useTtscWebsiteBenchmarkGraphData from "../../components/benchmark/graph/useTtscWebsiteBenchmarkGraphData";
import TtscWebsiteLandingFadeIn from "./TtscWebsiteLandingFadeIn";

const PUNCT = "text-blue-400";
const KEY = "text-sky-300";
const STRING = "text-amber-300";

function JsonLine({
  indent,
  children,
}: {
  indent: number;
  children: ReactNode;
}) {
  return (
    <div>
      {" ".repeat(indent)}
      {children}
    </div>
  );
}

function JsonKey({ name }: { name: string }) {
  return (
    <>
      <span className={KEY}>&quot;{name}&quot;</span>
      <span className={PUNCT}>: </span>
    </>
  );
}

function JsonString({ value }: { value: string }) {
  return <span className={STRING}>&quot;{value}&quot;</span>;
}

function McpJsonBlock() {
  return (
    <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-[1.7] md:p-7 md:text-sm">
      <JsonLine indent={0}>
        <span className={PUNCT}>{"{"}</span>
      </JsonLine>
      <JsonLine indent={2}>
        <JsonKey name="mcpServers" />
        <span className={PUNCT}>{"{"}</span>
      </JsonLine>
      <JsonLine indent={4}>
        <JsonKey name="ttsc-graph" />
        <span className={PUNCT}>{"{"}</span>
      </JsonLine>
      <JsonLine indent={6}>
        <JsonKey name="command" />
        <JsonString value="npx" />
        <span className={PUNCT}>,</span>
      </JsonLine>
      <JsonLine indent={6}>
        <JsonKey name="args" />
        <span className={PUNCT}>[</span>
        <JsonString value="-y" />
        <span className={PUNCT}>, </span>
        <JsonString value="@ttsc/graph" />
        <span className={PUNCT}>]</span>
      </JsonLine>
      <JsonLine indent={4}>
        <span className={PUNCT}>{"}"}</span>
      </JsonLine>
      <JsonLine indent={2}>
        <span className={PUNCT}>{"}"}</span>
      </JsonLine>
      <JsonLine indent={0}>
        <span className={PUNCT}>{"}"}</span>
      </JsonLine>
    </pre>
  );
}

function VscodeSolChart() {
  const { commonMode } = useTtscWebsiteBenchmarkGraphData();
  const data = useMemo(() => {
    if (!commonMode) return null;
    const project = commonMode.projects.find((p) => p.repo === "vue");
    const model = project?.models.find((m) => m.model === "codex-gpt-sol");
    if (!project || !model) return null;
    return {
      model,
      row: {
        id: project.id,
        label: TtscWebsiteBenchmarkGraphData.repoLabel(project.repo),
        baseline: model.baseline,
        tools: TtscWebsiteBenchmarkGraphReductionTools(model),
      },
    };
  }, [commonMode]);

  if (!data) return null;
  return (
    <TtscWebsiteBenchmarkGraphChart
      eyebrow="Agent cost"
      title={data.model.label}
      description="The shared repository-onboarding question, on the Vue codebase."
      rows={[data.row]}
      aside={TtscWebsiteBenchmarkGraphData.modelTabMeta(data.model)}
    />
  );
}

export default function TtscWebsiteLandingCodeGraph() {
  return (
    <section className="relative overflow-hidden bg-[#102a43] px-6 py-24 md:py-32">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:64px_64px]" />
      <div className="absolute -right-40 top-16 h-96 w-96 rounded-full bg-[#3178c6]/25 blur-3xl" />

      <div className="relative mx-auto max-w-6xl">
        <TtscWebsiteLandingFadeIn>
          <p className="mb-6 font-mono text-xs uppercase tracking-[0.2em]">
            <span className="text-[#72afe6]">[</span>
            <span className="mx-2 text-blue-200">Coding agents</span>
            <span className="text-[#72afe6]">]</span>
          </p>
          <div className="grid gap-10 lg:grid-cols-[1.14fr_0.86fr] lg:items-center">
            <div>
              <h2 className="text-3xl font-bold leading-[1.08] tracking-tight text-white md:text-5xl">
                Your agent should ask the compiler, not grep.
              </h2>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-blue-100">
                <code className="font-mono font-semibold text-sky-300">
                  @ttsc/graph
                </code>{" "}
                hands a coding agent a checker-resolved graph of your project,
                over MCP. On the agent-cost benchmark, Claude agents answer
                reading zero files, cutting tokens by roughly 90%.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href="/docs/setup/graph"
                  className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-[#235a97] shadow-[0_12px_30px_rgba(16,42,67,0.3)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-blue-50"
                >
                  Connect an agent
                </a>
                <a
                  href="/docs/benchmark/graph"
                  className="rounded-full border border-white/40 bg-white/10 px-6 py-3 text-sm font-semibold text-white transition-colors hover:border-white hover:bg-white/20"
                >
                  Full benchmark
                </a>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-white/20 bg-[#0b1f33] shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
              <div className="flex items-center gap-2 border-b border-white/10 bg-[#173f66] px-4 py-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400/60" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/60" />
                <span className="ml-3 font-mono text-xs text-blue-200">
                  .mcp.json
                </span>
              </div>
              <McpJsonBlock />
              <div className="border-t border-white/10 bg-[#173f66] p-4 font-mono text-[13px] leading-relaxed text-blue-100">
                The whole setup. It never writes into CLAUDE.md or AGENTS.md.
              </div>
            </div>
          </div>
        </TtscWebsiteLandingFadeIn>

        <TtscWebsiteLandingFadeIn delay={120}>
          <div className="mt-12">
            <VscodeSolChart />
            <p className="mt-3 font-mono text-xs text-blue-300">
              GPT-5.6 Sol, shared onboarding question. Every model and
              repository:{" "}
              <a
                href="/docs/benchmark/graph"
                className="text-[#72afe6] underline-offset-2 hover:underline"
              >
                full benchmark
              </a>
              .
            </p>
          </div>
        </TtscWebsiteLandingFadeIn>
      </div>
    </section>
  );
}

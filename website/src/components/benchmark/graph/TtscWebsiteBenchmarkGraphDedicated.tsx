"use client";

import { useMemo, useState } from "react";

import type { ITtscWebsiteBenchmarkGraph } from "../../../structures/ITtscWebsiteBenchmarkGraph";
import TtscWebsiteBenchmarkGraphChart from "./TtscWebsiteBenchmarkGraphChart";
import TtscWebsiteBenchmarkGraphData from "./TtscWebsiteBenchmarkGraphData";
import TtscWebsiteBenchmarkGraphReductionTools from "./TtscWebsiteBenchmarkGraphReductionTools";
import TtscWebsiteBenchmarkGraphSearchParam from "./TtscWebsiteBenchmarkGraphSearchParam";
import TtscWebsiteBenchmarkGraphTabs from "./TtscWebsiteBenchmarkGraphTabs";
import TtscWebsiteBenchmarkGraphUi from "./TtscWebsiteBenchmarkGraphUi";
import useTtscWebsiteBenchmarkGraphData from "./useTtscWebsiteBenchmarkGraphData";

type ProjectGroup = ITtscWebsiteBenchmarkGraph.ProjectGroup;
type PromptModeGroup = ITtscWebsiteBenchmarkGraph.PromptModeGroup;
type ReductionRow = ITtscWebsiteBenchmarkGraph.ReductionRow;

function modelCountLabel(count: number): string {
  return count + " model" + (count === 1 ? "" : "s");
}

function TtscWebsiteBenchmarkGraphDedicatedChart({
  project,
}: {
  project: ProjectGroup;
}) {
  const rows = useMemo<ReductionRow[]>(
    () =>
      project.models.map((model) => ({
        id: model.id,
        label: model.label,
        ...(TtscWebsiteBenchmarkGraphData.modelTabMeta(model)
          ? { meta: TtscWebsiteBenchmarkGraphData.modelTabMeta(model) }
          : {}),
        baseline: model.baseline,
        tools: TtscWebsiteBenchmarkGraphReductionTools(model),
      })),
    [project],
  );

  return (
    <TtscWebsiteBenchmarkGraphChart
      eyebrow="Dedicated prompt"
      title={TtscWebsiteBenchmarkGraphData.repoLabel(project.repo)}
      description={project.question ?? "Project-specific mechanism request."}
      rows={rows}
      aside={modelCountLabel(project.models.length)}
    />
  );
}

function TtscWebsiteBenchmarkGraphDedicatedGroup({
  mode,
}: {
  mode: PromptModeGroup;
}) {
  const [activeProjectId, setActiveProjectId] = useState<string | null>(() =>
    TtscWebsiteBenchmarkGraphSearchParam.initial("graphDedicatedProject"),
  );
  const activeProject =
    (activeProjectId
      ? mode.projects.find((project) => project.id === activeProjectId)
      : undefined) ?? mode.projects[0];

  return (
    <section className="space-y-3">
      <TtscWebsiteBenchmarkGraphTabs
        label="Project"
        items={mode.projects.map((project) => ({
          id: project.id,
          label: TtscWebsiteBenchmarkGraphData.repoLabel(project.repo),
        }))}
        active={activeProject?.id ?? ""}
        onSelect={setActiveProjectId}
        queryParam="graphDedicatedProject"
      />
      {activeProject ? (
        <TtscWebsiteBenchmarkGraphDedicatedChart project={activeProject} />
      ) : null}
    </section>
  );
}

export default function TtscWebsiteBenchmarkGraphDedicated() {
  const { dedicatedMode, error, loading } = useTtscWebsiteBenchmarkGraphData();

  if (error)
    return (
      <TtscWebsiteBenchmarkGraphUi.Notice>
        Could not load graph benchmark data ({error}).
      </TtscWebsiteBenchmarkGraphUi.Notice>
    );

  if (loading)
    return (
      <TtscWebsiteBenchmarkGraphUi.Notice>
        Loading graph benchmark results...
      </TtscWebsiteBenchmarkGraphUi.Notice>
    );

  if (!dedicatedMode) return null;

  return (
    <div className="not-prose my-6 space-y-5">
      <TtscWebsiteBenchmarkGraphDedicatedGroup mode={dedicatedMode} />
    </div>
  );
}

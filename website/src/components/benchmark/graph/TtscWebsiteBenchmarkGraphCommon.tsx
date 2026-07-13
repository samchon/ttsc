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

type ModelGroup = ITtscWebsiteBenchmarkGraph.ModelGroup;
type PromptModeGroup = ITtscWebsiteBenchmarkGraph.PromptModeGroup;
type ReductionRow = ITtscWebsiteBenchmarkGraph.ReductionRow;

function commonRowsForModel(
  mode: PromptModeGroup,
  modelId: string,
): ReductionRow[] {
  const rows: ReductionRow[] = [];
  for (const project of mode.projects) {
    const model = project.models.find((candidate) => candidate.id === modelId);
    if (!model) continue;
    rows.push({
      id: project.id,
      label: TtscWebsiteBenchmarkGraphData.repoLabel(project.repo),
      baseline: model.baseline,
      tools: TtscWebsiteBenchmarkGraphReductionTools(model),
    });
  }
  return rows;
}

function TtscWebsiteBenchmarkGraphCommonChart({
  mode,
  activeModel,
}: {
  mode: PromptModeGroup;
  activeModel: ModelGroup;
}) {
  const rows = useMemo(
    () => commonRowsForModel(mode, activeModel.id),
    [activeModel, mode],
  );
  const commonPrompt = useMemo(
    () =>
      TtscWebsiteBenchmarkGraphData.primaryQuestion(
        mode.projects.map(
          (project) =>
            project.models.find((model) => model.id === activeModel.id)
              ?.question ?? project.question,
        ),
      ),
    [activeModel, mode],
  );

  return (
    <TtscWebsiteBenchmarkGraphChart
      eyebrow="Common prompt"
      title={activeModel.label}
      description={
        commonPrompt ??
        "All projects use the same repository-onboarding request."
      }
      rows={rows}
      aside={TtscWebsiteBenchmarkGraphData.modelTabMeta(activeModel)}
    />
  );
}

function TtscWebsiteBenchmarkGraphCommonGroup({
  mode,
  modelFilter,
}: {
  mode: PromptModeGroup;
  modelFilter?: (model: ModelGroup) => boolean;
}) {
  const models = useMemo(
    () =>
      TtscWebsiteBenchmarkGraphData.groupBy(
        mode.projects.flatMap((project) => project.models),
        (model) => model.id,
      )
        .map(({ items }) => items[0]!)
        .filter((model) => (modelFilter ? modelFilter(model) : true))
        .sort(
          (a, b) =>
            TtscWebsiteBenchmarkGraphData.modelOrder(a.model) -
              TtscWebsiteBenchmarkGraphData.modelOrder(b.model) ||
            a.label.localeCompare(b.label),
        ),
    [mode, modelFilter],
  );

  const [activeModelId, setActiveModelId] = useState<string | null>(() =>
    TtscWebsiteBenchmarkGraphSearchParam.initial("graphCommonModel"),
  );
  const activeModel =
    (activeModelId
      ? models.find((model) => model.id === activeModelId)
      : undefined) ?? models[0];

  return (
    <section className="space-y-3">
      <TtscWebsiteBenchmarkGraphTabs
        label="Model"
        items={models.map((model) => ({
          id: model.id,
          label: model.label,
          ...(TtscWebsiteBenchmarkGraphData.modelTabMeta(model)
            ? { meta: TtscWebsiteBenchmarkGraphData.modelTabMeta(model) }
            : {}),
        }))}
        active={activeModel?.id ?? ""}
        onSelect={setActiveModelId}
        queryParam="graphCommonModel"
      />
      {activeModel ? (
        <TtscWebsiteBenchmarkGraphCommonChart
          mode={mode}
          activeModel={activeModel}
        />
      ) : null}
    </section>
  );
}

const isSummaryModel = (model: ModelGroup): boolean =>
  model.model === "codex-gpt-terra";

export default function TtscWebsiteBenchmarkGraphCommon({
  summary = false,
}: {
  summary?: boolean;
}) {
  const { commonMode, error, loading } = useTtscWebsiteBenchmarkGraphData();

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

  if (!commonMode) return null;

  return (
    <div className="not-prose my-6 space-y-5">
      <TtscWebsiteBenchmarkGraphCommonGroup
        mode={commonMode}
        modelFilter={summary ? isSummaryModel : undefined}
      />
    </div>
  );
}

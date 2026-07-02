import type { ITtscWebsiteBenchmarkGraph } from "../../../structures/ITtscWebsiteBenchmarkGraph";
import TtscWebsiteBenchmarkGraphUi from "./TtscWebsiteBenchmarkGraphUi";

export default function TtscWebsiteBenchmarkGraphReductionTools(
  model: ITtscWebsiteBenchmarkGraph.ModelGroup,
): ITtscWebsiteBenchmarkGraph.ReductionTool[] {
  return [
    {
      key: "ttsc",
      label: "@ttsc/graph",
      metrics: model.ttsc,
      fill: TtscWebsiteBenchmarkGraphUi.TTSC_FILL,
      textColor: TtscWebsiteBenchmarkGraphUi.ACCENT,
    },
    {
      key: "codegraph",
      label: "codegraph",
      metrics: model.codegraph,
      setupMs: model.codegraphSetupMs,
      fill: TtscWebsiteBenchmarkGraphUi.CODEGRAPH_FILL,
      textColor: TtscWebsiteBenchmarkGraphUi.CODEGRAPH_TEXT,
    },
    {
      key: "codebaseMemory",
      label: "codebase-memory",
      metrics: model.codebaseMemory,
      setupMs: model.codebaseMemorySetupMs,
      fill: TtscWebsiteBenchmarkGraphUi.CODEBASE_MEMORY_FILL,
      textColor: TtscWebsiteBenchmarkGraphUi.CODEBASE_MEMORY_TEXT,
    },
    {
      key: "serena",
      label: "serena",
      metrics: model.serena,
      setupMs: model.serenaSetupMs,
      fill: TtscWebsiteBenchmarkGraphUi.SERENA_FILL,
      textColor: TtscWebsiteBenchmarkGraphUi.SERENA_TEXT,
    },
  ];
}

"use client";

import { useEffect, useMemo, useState } from "react";

import type { ITtscWebsiteBenchmarkGraph } from "../../../structures/ITtscWebsiteBenchmarkGraph";
import TtscWebsiteBenchmarkGraphData from "./TtscWebsiteBenchmarkGraphData";

type GraphReport = ITtscWebsiteBenchmarkGraph.Report;

let graphReportPromise: Promise<GraphReport> | null = null;

function loadGraphReport(): Promise<GraphReport> {
  graphReportPromise ??= fetch("/benchmark/graph.json").then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json() as Promise<GraphReport>;
  });
  return graphReportPromise;
}

export default function useTtscWebsiteBenchmarkGraphData() {
  const [report, setReport] = useState<GraphReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadGraphReport()
      .then((data) => {
        if (!cancelled) setReport(data);
      })
      .catch((err: unknown) => {
        graphReportPromise = null;
        if (!cancelled)
          setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const modes = useMemo(() => {
    if (!report) return [];
    const groups = TtscWebsiteBenchmarkGraphData.buildProjectGroups(
      report.agent?.cells ?? [],
    );
    return TtscWebsiteBenchmarkGraphData.buildPromptModeGroups(groups);
  }, [report]);

  return {
    report,
    loading: !report && !error,
    error,
    commonMode: modes.find((mode) => mode.id === "common"),
    dedicatedMode: modes.find((mode) => mode.id === "dedicated"),
  };
}

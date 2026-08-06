"use client";

import { useEffect, useState } from "react";

import type { ITtscWebsiteBenchmarkEvidence } from "../../../structures/ITtscWebsiteBenchmarkEvidence";

type CoverageReport = ITtscWebsiteBenchmarkEvidence.CoverageReport;
type Report = ITtscWebsiteBenchmarkEvidence.Report;

let reportPromise: Promise<Report> | null = null;
let coveragePromise: Promise<CoverageReport | null> | null = null;

function loadReport(): Promise<Report> {
  reportPromise ??= fetch("/benchmark/evidence.json").then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json() as Promise<Report>;
  });
  return reportPromise;
}

/**
 * Coverage is optional, and a 404 is an answer rather than a failure.
 *
 * The figure is counted by hand from a completed Plain workspace, so a cohort
 * can be published before anyone has read one. Treating its absence as an error
 * would take down the spend charts, which do not depend on it.
 */
function loadCoverage(): Promise<CoverageReport | null> {
  coveragePromise ??= fetch("/benchmark/evidence-coverage.json")
    .then((res) => (res.ok ? (res.json() as Promise<CoverageReport>) : null))
    .catch(() => null);
  return coveragePromise;
}

export default function useTtscWebsiteBenchmarkEvidenceData() {
  const [report, setReport] = useState<Report | null>(null);
  const [coverage, setCoverage] = useState<CoverageReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadReport()
      .then((data) => {
        if (!cancelled) setReport(data);
      })
      .catch((err: unknown) => {
        reportPromise = null;
        if (!cancelled)
          setError(err instanceof Error ? err.message : String(err));
      });
    loadCoverage().then((data) => {
      if (!cancelled) setCoverage(data);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { report, coverage, loading: !report && !error, error };
}

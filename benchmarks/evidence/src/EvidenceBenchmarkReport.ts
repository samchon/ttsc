import fs from "node:fs";
import path from "node:path";

import { EvidenceBenchmarkChart } from "./EvidenceBenchmarkChart";
import { collectEvidenceBenchmarkReport } from "./EvidenceBenchmarkDashboard";
import type { ITtscEvidenceBenchmarkReport } from "./structures/ITtscEvidenceBenchmarkReport";

export interface ITtscEvidenceBenchmarkReportOptions {
  repository: string;
  output: string;
  generatedAt?: Date;
  runIds?: readonly string[];
}

/** Writes the latest-run JSON aggregate, stable cells, and comparison charts. */
export const writeEvidenceBenchmarkReport = (
  options: ITtscEvidenceBenchmarkReportOptions,
): ITtscEvidenceBenchmarkReport => {
  const report: ITtscEvidenceBenchmarkReport = collectEvidenceBenchmarkReport(
    options.repository,
    options.generatedAt,
    options.runIds,
    true,
  );
  const output: string = path.resolve(options.output);
  // Publishing nothing is not a publication. The raw run tree is ignored, so a
  // checkout that never ran a cohort collects zero cells, and replacing the
  // tracked aggregate with that would delete the measurement rather than
  // refresh it. Refusing here is what makes the write below safe to be
  // destructive.
  if (report.cells.length === 0)
    throw new Error(
      `No benchmark cells were collected from ${path.join(options.repository, "benchmarks", "evidence", "output")}. Refusing to replace the tracked aggregate at ${output} with an empty one; render the charts from the tracked aggregate instead with the \`charts\` command.`,
    );
  fs.mkdirSync(output, { recursive: true });
  for (const entry of fs.readdirSync(output, { withFileTypes: true }))
    if (entry.isFile() && /\.(?:png|svg)$/u.test(entry.name))
      fs.rmSync(path.join(output, entry.name));
  fs.writeFileSync(
    path.join(output, "summary.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  const cells: string = path.join(output, "cells");
  fs.rmSync(cells, { recursive: true, force: true });
  for (const cell of report.cells) {
    const file: string = path.join(
      cells,
      pathSegment(cell.model),
      pathSegment(cell.subject),
      `${cell.arm}.json`,
    );
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(cell, null, 2)}\n`);
  }
  writeEvidenceBenchmarkCharts(output, report);
  return report;
};

/**
 * Draws every chart from the tracked aggregate alone.
 *
 * The report a campaign collects and the aggregate this repository tracks hold
 * the same values, and only the second one survives outside the machine that
 * ran the cohort. Taking the report as an argument keeps a fresh collection
 * from being written to disk and read back; omitting it is how a clone with no
 * run tree reproduces every published chart.
 */
export const writeEvidenceBenchmarkCharts = (
  output: string,
  collected?: ITtscEvidenceBenchmarkReport,
): ITtscEvidenceBenchmarkReport => {
  const root: string = path.resolve(output);
  const report: ITtscEvidenceBenchmarkReport =
    collected ?? readEvidenceBenchmarkAggregate(root);
  const coverage: readonly EvidenceBenchmarkChart.ICoverage[] =
    readEvidenceBenchmarkCoverage(root);
  fs.mkdirSync(root, { recursive: true });
  fs.writeFileSync(
    path.join(root, "summary.svg"),
    EvidenceBenchmarkChart.summary({ report, coverage }),
  );
  // A subject's chart belongs beside the JSON holding the same run's figures,
  // so opening a subject's directory gives its numbers and its picture at once.
  for (const [model, subjects] of Map.groupBy(
    report.cells,
    (cell) => cell.model,
  ))
    for (const subject of new Set(subjects.map((cell) => cell.subject))) {
      const directory: string = path.join(
        root,
        "cells",
        pathSegment(model),
        pathSegment(subject),
      );
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(
        path.join(directory, "arms.svg"),
        EvidenceBenchmarkChart.arms({ report, coverage, model, subject }),
      );
    }
  return report;
};

/** Reads the tracked `summary.json`, which is the whole report. */
export const readEvidenceBenchmarkAggregate = (
  output: string,
): ITtscEvidenceBenchmarkReport => {
  const file: string = path.join(path.resolve(output), "summary.json");
  if (fs.existsSync(file) === false)
    throw new Error(
      `No tracked aggregate at ${file}. Publish one with the \`report\` command from a checkout that holds the run records.`,
    );
  return JSON.parse(
    fs.readFileSync(file, "utf8"),
  ) as ITtscEvidenceBenchmarkReport;
};

/**
 * Reads the coverage the `coverage` command composed, when a cohort has one.
 *
 * Absence is an ordinary state: coverage is counted by hand from a completed
 * Plain workspace, so a cohort can be published before anyone has read one. It
 * is the one state that yields no rows rather than an error. A file that is
 * present and unreadable is the opposite, because a chart that quietly skipped
 * a coverage block would be indistinguishable from one that never had it.
 */
const readEvidenceBenchmarkCoverage = (
  output: string,
): readonly EvidenceBenchmarkChart.ICoverage[] => {
  const file: string = path.join(output, "coverage.json");
  if (fs.existsSync(file) === false) return [];
  const parsed: unknown = JSON.parse(fs.readFileSync(file, "utf8"));
  const cells: unknown = (parsed as { cells?: unknown } | null)?.cells;
  if (Array.isArray(cells) === false)
    throw new Error(`${file} has no \`cells\` array.`);
  return cells.map((cell, index) => {
    const row = cell as {
      model?: unknown;
      subject?: unknown;
      arm?: unknown;
      coverage?: { score?: unknown; measured?: unknown };
    };
    const score: unknown = row.coverage?.score;
    if (
      typeof row.model !== "string" ||
      typeof row.subject !== "string" ||
      (row.arm !== "plain" && row.arm !== "evidence") ||
      typeof score !== "number" ||
      typeof row.coverage?.measured !== "boolean"
    )
      throw new Error(
        `${file} cell ${index} is not a coverage row: it needs a string \`model\` and \`subject\`, an \`arm\` of "plain" or "evidence", and a \`coverage\` carrying a numeric \`score\` and a boolean \`measured\`.`,
      );
    return {
      model: row.model,
      subject: row.subject,
      arm: row.arm,
      score,
      measured: row.coverage.measured,
    };
  });
};

const pathSegment = (value: string): string => {
  const encoded: string = encodeURIComponent(value);
  return encoded === "." || encoded === ".."
    ? encoded.replaceAll(".", "%2E")
    : encoded;
};

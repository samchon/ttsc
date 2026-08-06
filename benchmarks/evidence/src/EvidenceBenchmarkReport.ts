import fs from "node:fs";
import path from "node:path";

import { EvidenceBenchmarkChart } from "./EvidenceBenchmarkChart";
import { collectEvidenceBenchmarkReport } from "./EvidenceBenchmarkDashboard";
import { EvidenceBenchmarkLayout } from "./EvidenceBenchmarkLayout";
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
      `No benchmark cells were collected from ${path.join(EvidenceBenchmarkLayout.assetsRoot(options.repository), "output")}. Refusing to replace the tracked aggregate at ${output} with an empty one; render the charts from the tracked aggregate instead with the \`charts\` command.`,
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
  writeEvidenceBenchmarkCharts({
    aggregate: output,
    charts: EvidenceBenchmarkLayout.chartsRoot(options.repository),
    collected: report,
  });
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
export const writeEvidenceBenchmarkCharts = (props: {
  /** Directory holding `summary.json` and, when it exists, `coverage.json`. */
  aggregate: string;
  /** Directory the charts are written to, one flat file per chart. */
  charts: string;
  collected?: ITtscEvidenceBenchmarkReport;
}): ITtscEvidenceBenchmarkReport => {
  const aggregate: string = path.resolve(props.aggregate);
  const charts: string = path.resolve(props.charts);
  const report: ITtscEvidenceBenchmarkReport =
    props.collected ?? readEvidenceBenchmarkAggregate(aggregate);
  const coverage: readonly EvidenceBenchmarkChart.ICoverage[] =
    readEvidenceBenchmarkCoverage(aggregate);
  fs.mkdirSync(charts, { recursive: true });
  // Every chart this run does not write is one a previous cohort left. A
  // subject dropped from the aggregate would otherwise keep being served under
  // a name the measurement no longer carries.
  for (const name of fs.readdirSync(charts))
    if (name.endsWith(".svg")) fs.rmSync(path.join(charts, name));
  fs.writeFileSync(
    path.join(charts, "summary.svg"),
    EvidenceBenchmarkChart.summary({ report, coverage }),
  );
  // One flat directory, so the name carries what the path used to. A model and
  // a subject both appear in it because two models over one subject are two
  // charts.
  for (const [model, subjects] of Map.groupBy(
    report.cells,
    (cell) => cell.model,
  ))
    for (const subject of new Set(subjects.map((cell) => cell.subject)))
      fs.writeFileSync(
        path.join(charts, `${pathSegment(model)}-${pathSegment(subject)}.svg`),
        EvidenceBenchmarkChart.arms({ report, coverage, model, subject }),
      );
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
  const parsed: unknown = parse(file);
  const report = parsed as Partial<ITtscEvidenceBenchmarkReport>;
  if (
    typeof report.generatedAt !== "string" ||
    Array.isArray(report.cells) === false
  )
    throw new Error(
      `${file} is not a benchmark report: it needs a string \`generatedAt\` and a \`cells\` array.`,
    );
  return report as ITtscEvidenceBenchmarkReport;
};

/** Parsing that says which file failed, which `JSON.parse` does not. */
const parse = (file: string): unknown => {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`${file} is not readable JSON.
${String(error)}`);
  }
};

/**
 * Reads the coverage the `coverage` command composed, when a cohort has one.
 *
 * Absence is an ordinary state: coverage is counted by hand from a completed
 * Plain workspace, so a cohort can be published before anyone has read one. It
 * is the one state that yields no rows rather than an error. A file that is
 * present and malformed is the opposite, because a chart that quietly skipped a
 * coverage block would be indistinguishable from one that never had it.
 *
 * A null `score` is neither. It is what the composing command emits for a
 * codebase with no requirement anchors at all, which was never asked the
 * question, so the row is dropped and the block draws the subjects that were.
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
  return cells
    .map((cell, index) => {
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
        (typeof score !== "number" && score !== null) ||
        typeof row.coverage?.measured !== "boolean"
      )
        throw new Error(
          `${file} cell ${index} is not a coverage row: it needs a string \`model\` and \`subject\`, an \`arm\` of "plain" or "evidence", and a \`coverage\` carrying a \`score\` that is a number or null and a boolean \`measured\`.`,
        );
      return score === null
        ? null
        : {
            model: row.model,
            subject: row.subject,
            arm: row.arm,
            score,
            measured: row.coverage.measured,
          };
    })
    .filter((row): row is EvidenceBenchmarkChart.ICoverage => row !== null);
};

const pathSegment = (value: string): string => {
  const encoded: string = encodeURIComponent(value);
  return encoded === "." || encoded === ".."
    ? encoded.replaceAll(".", "%2E")
    : encoded;
};

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
  assertEvidenceBenchmarkCoverageCohort(output, report);
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
 * Refuses a publication that would leave a cohort boundary inside the
 * aggregate.
 *
 * `report` replaces `summary.json` and rebuilds `cells/` from nothing, and it
 * never wrote `coverage.json`, which is counted by hand from a completed
 * workspace. So a second cohort published over a first leaves the first's
 * coverage beside the second's spend, and the renderer keeps every row whose
 * model and subject appear in the report, which for a repeated subject is all
 * of them. Both artifacts stay internally consistent and the combination is two
 * cohorts, with nothing in the rendered result saying so.
 *
 * Two ties. `source.origin` names the repository the coverage was counted in,
 * so a file vendored from another project announces itself before any row is
 * read, and it is the only tie a file with an empty `cells` array has. It is
 * skipped when the aggregate being written records no origin, which happens
 * when the repository's manifest declares no resolvable one; the row tie still
 * runs, and a foreign file with no rows would then publish. Within one
 * repository every origin agrees, and there the run each row was counted from
 * is what distinguishes cohorts: a row naming a run this cohort is not
 * publishing belongs to another one, and a row naming no run cannot be
 * attributed at all.
 *
 * Either refuses the publication rather than being dropped silently, because a
 * chart that quietly lost its coverage block is indistinguishable from one that
 * never had it.
 */
export const assertEvidenceBenchmarkCoverageCohort = (
  output: string,
  report: ITtscEvidenceBenchmarkReport,
): void => {
  const file: string = path.join(path.resolve(output), "coverage.json");
  if (fs.existsSync(file) === false) return;
  const parsed: unknown = parse(file);
  const origin: unknown = (parsed as { source?: { origin?: unknown } } | null)
    ?.source?.origin;
  if (
    typeof origin === "string" &&
    report.origin !== undefined &&
    origin !== report.origin
  )
    throw new Error(
      `${file} was counted in ${origin} and this cohort was collected from ${report.origin}. Recount it here against this cohort's runs, adding each row's \`runId\`, or delete it and publish without a coverage block; refusing to leave two cohorts in ${output}.`,
    );
  const published: ReadonlyMap<string, string> = new Map(
    report.cells.map((cell) => [
      `${cell.model}/${cell.subject}/${cell.arm}`,
      cell.runId,
    ]),
  );
  const foreign: string[] = [];
  for (const row of readEvidenceBenchmarkCoverageRows(file, parsed)) {
    const key: string = `${row.model}/${row.subject}/${row.arm}`;
    const expected: string | undefined = published.get(key);
    if (row.runId === undefined)
      foreign.push(
        `${key} carries no \`runId\` naming the run it was counted from`,
      );
    else if (expected === undefined)
      foreign.push(`${key} (${row.runId}) is not in this cohort`);
    else if (expected !== row.runId)
      foreign.push(`${key} was counted from ${row.runId}, not ${expected}`);
  }
  if (foreign.length !== 0)
    throw new Error(
      `${file} belongs to a different cohort than the one being published: ${foreign.join("; ")}. Recount it against this cohort's runs, or delete it and publish without a coverage block; refusing to leave two cohorts in ${output}.`,
    );
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
 * Reads the hand-counted coverage of a cohort, when one has been counted.
 *
 * Nothing in this repository writes this file. It is counted by hand from a
 * completed workspace, which is why absence is an ordinary state: a cohort can
 * be published before anyone has read one, and that is the single state which
 * yields no rows rather than an error. A file that is present and malformed is
 * the opposite, because a chart that quietly skipped a coverage block would be
 * indistinguishable from one that never had it. A file present but belonging to
 * another cohort is refused earlier, at publication.
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
  return readEvidenceBenchmarkCoverageRows(file)
    .map((row) =>
      row.score === null
        ? null
        : {
            model: row.model,
            subject: row.subject,
            arm: row.arm,
            score: row.score,
            measured: row.measured,
          },
    )
    .filter((row): row is EvidenceBenchmarkChart.ICoverage => row !== null);
};

/** One hand-counted coverage row, with the run it was counted from. */
interface ICoverageRow {
  model: string;
  subject: string;
  arm: "plain" | "evidence";
  /** `null` for a codebase with no requirement anchors to score at all. */
  score: number | null;
  measured: boolean;
  /**
   * Run this row was counted from, absent in a file written before the field
   * existed. Publication treats absence as unattributable rather than as
   * belonging to whatever cohort is being written.
   */
  runId?: string;
}

const readEvidenceBenchmarkCoverageRows = (
  file: string,
  content: unknown = parse(file),
): readonly ICoverageRow[] => {
  const cells: unknown = (content as { cells?: unknown } | null)?.cells;
  if (Array.isArray(cells) === false)
    throw new Error(`${file} has no \`cells\` array.`);
  return cells.map((cell, index) => {
    const row = cell as {
      model?: unknown;
      subject?: unknown;
      arm?: unknown;
      runId?: unknown;
      coverage?: { score?: unknown; measured?: unknown };
    };
    const score: unknown = row.coverage?.score;
    if (
      typeof row.model !== "string" ||
      typeof row.subject !== "string" ||
      (row.arm !== "plain" && row.arm !== "evidence") ||
      (typeof score !== "number" && score !== null) ||
      typeof row.coverage?.measured !== "boolean" ||
      (row.runId !== undefined && typeof row.runId !== "string")
    )
      throw new Error(
        `${file} cell ${index} is not a coverage row: it needs a string \`model\` and \`subject\`, an \`arm\` of "plain" or "evidence", a \`coverage\` carrying a \`score\` that is a number or null and a boolean \`measured\`, and an optional string \`runId\`.`,
      );
    return {
      model: row.model,
      subject: row.subject,
      arm: row.arm,
      score,
      measured: row.coverage.measured,
      ...(row.runId === undefined ? {} : { runId: row.runId }),
    };
  });
};

const pathSegment = (value: string): string => {
  const encoded: string = encodeURIComponent(value);
  return encoded === "." || encoded === ".."
    ? encoded.replaceAll(".", "%2E")
    : encoded;
};

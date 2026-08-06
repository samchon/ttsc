import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { writeEvidenceBenchmarkCharts } from "../../../../benchmarks/evidence/src/EvidenceBenchmarkReport";
import type { ITtscEvidenceBenchmarkReport } from "../../../../benchmarks/evidence/src/structures/ITtscEvidenceBenchmarkReport";
import { benchmarkRoot } from "../internal/suiteRoot";

/**
 * Verifies every published chart redraws from the tracked aggregate alone.
 *
 * The charts used to be reachable only from `benchmarks/evidence/output/`,
 * which is gitignored and exists on the one machine that ran a cohort, so
 * nobody else could regenerate, verify, or restyle a picture from the data this
 * repository tracks. The case renders against a copy holding the JSON and
 * nothing else, then asserts that copy is unchanged: the publication path
 * deletes `cells/` and every top-level chart before it writes, and a redraw
 * that took that branch would delete the measurement it was drawing.
 *
 * 1. Copy the tracked aggregate's JSON into a temporary directory.
 * 2. Render the charts there and assert `summary.svg` plus one `arms.svg` per
 *    subject exist, each naming its own subject.
 * 3. Assert every input JSON file is byte identical afterwards.
 * 4. Render again and assert the same bytes, so a redraw is a no-op.
 */
export const test_benchmark_chart_draws_every_published_chart_from_the_tracked_aggregate =
  (): void => {
    const output: string = fs.mkdtempSync(
      path.join(os.tmpdir(), "ttsc-evidence-chart-"),
    );
    try {
      copyJson(path.join(benchmarkRoot, "aggregate"), output);
      const before: Map<string, string> = readJson(output);
      const report: ITtscEvidenceBenchmarkReport =
        writeEvidenceBenchmarkCharts(output);
      if (report.cells.length === 0)
        throw new Error("The tracked aggregate carries no cell.");

      const summary: string = path.join(output, "summary.svg");
      if (fs.existsSync(summary) === false)
        throw new Error(`${summary} was not written.`);
      const drawn: string = fs.readFileSync(summary, "utf8");
      if (
        drawn.startsWith("<svg") === false ||
        drawn.includes("</svg>") === false
      )
        throw new Error("summary.svg is not an SVG document.");

      for (const cell of report.cells) {
        const file: string = path.join(
          output,
          "cells",
          encodeURIComponent(cell.model),
          encodeURIComponent(cell.subject),
          "arms.svg",
        );
        if (fs.existsSync(file) === false)
          throw new Error(`${file} was not written.`);
        const heading: string = `${capitalize(cell.subject)}: Plain against Evidence`;
        if (fs.readFileSync(file, "utf8").includes(heading) === false)
          throw new Error(`${file} does not name ${cell.subject}.`);
      }

      const after: Map<string, string> = readJson(output);
      for (const [file, content] of before)
        if (after.get(file) !== content)
          throw new Error(`Rendering the charts modified ${file}.`);

      writeEvidenceBenchmarkCharts(output);
      if (fs.readFileSync(summary, "utf8") !== drawn)
        throw new Error(
          "Rendering the same aggregate twice produced two SVGs.",
        );
    } finally {
      fs.rmSync(output, { recursive: true, force: true });
    }
  };

/** The aggregate's JSON alone, so the copy has no chart to fall back on. */
const copyJson = (source: string, output: string): void => {
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from: string = path.join(source, entry.name);
    const to: string = path.join(output, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(to, { recursive: true });
      copyJson(from, to);
    } else if (entry.name.endsWith(".json")) fs.copyFileSync(from, to);
  }
};

const readJson = (root: string): Map<string, string> => {
  const files: Map<string, string> = new Map();
  const walk = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file: string = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (entry.name.endsWith(".json"))
        files.set(path.relative(root, file), fs.readFileSync(file, "utf8"));
    }
  };
  walk(root);
  return files;
};

const capitalize = (value: string): string =>
  `${value.charAt(0).toUpperCase()}${value.slice(1)}`;

import fs from "node:fs";
import path from "node:path";

import { EvidenceBenchmarkCoverage } from "../EvidenceBenchmarkCoverage";
import { EvidenceBenchmarkLayout } from "../EvidenceBenchmarkLayout";
import type {
  ITtscEvidenceBenchmarkCoverage,
  ITtscEvidenceBenchmarkCoverageMeasurement,
} from "../structures/ITtscEvidenceBenchmarkCoverage";

interface IInputCell {
  model: string;
  subject: string;
  edges: ITtscEvidenceBenchmarkCoverageMeasurement;
}

interface IOutputCell {
  model: string;
  subject: string;
  arm: "plain" | "evidence";
  coverage: ITtscEvidenceBenchmarkCoverage;
}

const USAGE: string = `Usage: pnpm coverage <measurement.json> [output-directory]

Composes each Plain cell's measured reference edges into one coverage figure,
and pairs it with its Evidence counterpart, which is complete by construction
and therefore neither analyzed nor measured.

The input file holds the edge populations an analyst counted while reviewing a
completed Plain workspace read-only:

  {
    "cells": [
      {
        "model": "gpt-5.6-luna",
        "subject": "todo",
        "edges": {
          "requirementToModel":     { "eligible": 0, "reached": 0 },
          "requirementToOperation": { "eligible": 0, "reached": 0 },
          "requirementToDto":       { "eligible": 0, "reached": 0 },
          "requirementToTest":      { "eligible": 0, "reached": 0 },
          "requirementToScreen":    { "eligible": 0, "reached": 0 },
          "requirementToJourney":   { "eligible": 0, "reached": 0 },
          "modelToOperation":       { "eligible": 0, "reached": 0 },
          "modelToDto":             { "eligible": 0, "reached": 0 },
          "accessorToTest":         { "eligible": 0, "reached": 0 },
          "accessorToHook":         { "eligible": 0, "reached": 0 },
          "hookToScreen":           { "eligible": 0, "reached": 0 },
          "screenToJourney":        { "eligible": 0, "reached": 0 },
          "columnToProperty":       { "eligible": 0, "reached": 0 }
        }
      }
    ]
  }
`;

const args: string[] = process.argv.slice(2);
const input: string | undefined = args[0];
if (input === undefined) {
  process.stderr.write(USAGE);
  process.exit(-1);
}

const output: string = path.resolve(
  process.cwd(),
  args[1] ??
    path.join(
      EvidenceBenchmarkLayout.assetsRoot(
        EvidenceBenchmarkLayout.repositoryRoot,
      ),
      "aggregate",
    ),
);
if (args.length > 2)
  throw new Error(`Unexpected benchmark coverage argument: ${args[2]}.`);

const parsed: { cells?: IInputCell[] } = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), input), "utf8"),
) as { cells?: IInputCell[] };
const cells: IInputCell[] = parsed.cells ?? [];
if (cells.length === 0)
  throw new Error(
    `No cells in ${input}. A coverage publication with nothing measured would report an empty comparison as a complete one.`,
  );

const composed: IOutputCell[] = cells.flatMap((cell) => [
  {
    model: cell.model,
    subject: cell.subject,
    arm: "plain" as const,
    coverage: EvidenceBenchmarkCoverage.plain(cell.edges),
  },
  {
    model: cell.model,
    subject: cell.subject,
    arm: "evidence" as const,
    coverage: EvidenceBenchmarkCoverage.evidence(),
  },
]);

fs.mkdirSync(output, { recursive: true });
const file: string = path.join(output, "coverage.json");
fs.writeFileSync(file, `${JSON.stringify({ cells: composed }, null, 2)}\n`);

const percent = (value: number | null): string =>
  value === null ? "—" : `${(value * 100).toFixed(1)}%`;

process.stdout.write(`| Subject | Arm | Coverage | Measured |\n`);
process.stdout.write(`| --- | --- | ---: | --- |\n`);
for (const cell of composed)
  process.stdout.write(
    `| ${cell.subject} | ${cell.arm} | ${percent(cell.coverage.score)} | ${
      cell.coverage.measured ? "yes" : "by construction"
    } |\n`,
  );
process.stdout.write(`\nWrote ${composed.length} coverage rows to ${file}.\n`);

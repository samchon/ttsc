import path from "node:path";

import { EvidenceBenchmarkLayout } from "../EvidenceBenchmarkLayout";
import { writeEvidenceBenchmarkCharts } from "../EvidenceBenchmarkReport";
import type { ITtscEvidenceBenchmarkReport } from "../structures/ITtscEvidenceBenchmarkReport";

const args: string[] = process.argv.slice(2);
if (args.length > 1)
  throw new Error(`Unexpected benchmark chart argument: ${args[1]}.`);
const output: string =
  args[0] === undefined
    ? path.join(
        EvidenceBenchmarkLayout.assetsRoot(
          EvidenceBenchmarkLayout.repositoryRoot,
        ),
        "aggregate",
      )
    : path.resolve(process.cwd(), args[0]);

const report: ITtscEvidenceBenchmarkReport =
  writeEvidenceBenchmarkCharts(output);
process.stdout.write(
  `Rendered charts for ${report.cells.length} benchmark cells from ${output}.\n`,
);

import path from "node:path";

import { EvidenceBenchmarkLayout } from "../EvidenceBenchmarkLayout";
import { writeEvidenceBenchmarkCharts } from "../EvidenceBenchmarkReport";
import type { ITtscEvidenceBenchmarkReport } from "../structures/ITtscEvidenceBenchmarkReport";

const args: string[] = process.argv.slice(2);
if (args.length > 2)
  throw new Error(`Unexpected benchmark chart argument: ${args[2]}.`);

const repository: string = EvidenceBenchmarkLayout.repositoryRoot;
const aggregate: string =
  args[0] === undefined
    ? path.join(EvidenceBenchmarkLayout.assetsRoot(repository), "aggregate")
    : path.resolve(process.cwd(), args[0]);
const charts: string =
  args[1] === undefined
    ? EvidenceBenchmarkLayout.chartsRoot(repository)
    : path.resolve(process.cwd(), args[1]);

const report: ITtscEvidenceBenchmarkReport = writeEvidenceBenchmarkCharts({
  aggregate,
  charts,
});
process.stdout.write(
  `Rendered charts for ${report.cells.length} benchmark cells from ${aggregate} to ${charts}.\n`,
);

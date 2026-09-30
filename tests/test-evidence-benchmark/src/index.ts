import { DynamicExecutor } from "@nestia/e2e";

import { releaseBenchmarkWorkspaces } from "./internal/benchmarkWorkspace";
import { closeBenchmarkWatches } from "./internal/startScriptWatch";

const main = async (): Promise<void> => {
  const only: string | undefined = process.argv
    .find((argument) => argument.startsWith("--include="))
    ?.slice("--include=".length);

  const report: DynamicExecutor.IReport = await DynamicExecutor.validate({
    prefix: "test",
    location: `${__dirname}/features`,
    extension: "ts",
    parameters: () => [],
    filter: (file) => only === undefined || file.includes(only),
    onComplete: (execution) =>
      console.log(
        `  - ${execution.name}: ${
          execution.error === null
            ? `${new Date(execution.completed_at).getTime() - new Date(execution.started_at).getTime()} ms`
            : "FAILED"
        }`,
      ),
  });

  if (report.executions.length === 0)
    throw new Error(`No benchmark feature matched ${only ?? "the suite"}.`);

  const failures: DynamicExecutor.IExecution[] = report.executions.filter(
    (execution) => execution.error !== null,
  );
  if (failures.length === 0) {
    console.log(`\nSuccess — ${report.executions.length} feature(s).`);
    return;
  }
  for (const failure of failures) console.error(failure.error);
  console.error(`\nFailed — ${failures.length} case(s).`);
  process.exitCode = 1;
};

void (async () => {
  try {
    await main();
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    try {
      // Failed joins retain the workspace rather than deleting a live child's inputs.
      await closeBenchmarkWatches();
      await releaseBenchmarkWorkspaces();
    } catch (error) {
      console.error(error);
      process.exitCode = 1;
    }
  }
})();

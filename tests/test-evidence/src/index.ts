import { DynamicExecutor } from "@nestia/e2e";

const main = async (): Promise<void> => {
  const only = process.argv
    .filter((argument) => argument.startsWith("--include="))
    .map((argument) => argument.slice("--include=".length));

  const report: DynamicExecutor.IReport = await DynamicExecutor.validate({
    prefix: "test",
    location: `${__dirname}/features`,
    extension: "ts",
    parameters: () => [],
    filter: (file) =>
      only.length === 0 || only.some((pattern) => file.includes(pattern)),
    onComplete: (execution) =>
      console.log(
        `  - ${execution.name}: ${
          execution.error === null
            ? `${new Date(execution.completed_at).getTime() - new Date(execution.started_at).getTime()} ms`
            : "FAILED"
        }`,
      ),
  });

  const failures: DynamicExecutor.IExecution[] = report.executions.filter(
    (execution) => execution.error !== null,
  );
  if (report.executions.length === 0)
    throw new Error("evidence selection ran no tests");
  if (failures.length === 0) {
    console.log(`\nSuccess — ${report.executions.length} feature(s).`);
    return;
  }
  for (const failure of failures) console.error(failure.error);
  console.error(`\nFailed — ${failures.length} case(s).`);
  process.exit(-1);
};

main().catch((error: unknown) => {
  console.error(error);
  process.exit(-1);
});

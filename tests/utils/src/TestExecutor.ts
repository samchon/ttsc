import { DynamicExecutor } from "@nestia/e2e";

export interface ITestExecutorProps {
  location: string;
}

const main = async (props: ITestExecutorProps): Promise<void> => {
  const include = getArguments("include");
  const exclude = getArguments("exclude");
  const started = Date.now();
  const report: DynamicExecutor.IReport = await DynamicExecutor.validate({
    prefix: "test_",
    location: props.location,
    extension: "ts",
    parameters: () => [],
    onComplete: (exec) => {
      if (exec.value === false)
        console.log(`  - \x1b[32m${exec.name}\x1b[0m: Pass`);
      else if (exec.error === null) {
        const elapsed = Math.max(
          0,
          new Date(exec.completed_at).getTime() -
            new Date(exec.started_at).getTime(),
        );
        console.log(
          `  - \x1b[32m${exec.name}\x1b[0m: \x1b[33m${elapsed.toLocaleString()} ms\x1b[0m`,
        );
      } else
        console.log(
          `  - \x1b[32m${exec.name}\x1b[0m: \x1b[31m${exec.error.name}\x1b[0m`,
        );
    },
    filter: (name) =>
      (include.length ? include.some((str) => name.includes(str)) : true) &&
      (exclude.length ? exclude.every((str) => !name.includes(str)) : true),
  });

  if (report.executions.length === 0) {
    const reason = include.length
      ? `No tests matched --include=${include.join(",")}`
      : `No tests were discovered under ${props.location}`;
    console.error(reason);
    process.exit(1);
  }

  const exceptions: Error[] = report.executions
    .filter((exec) => exec.error !== null)
    .map((exec) => exec.error!);
  for (const error of exceptions) console.error(error);
  console.log(exceptions.length ? "Failed" : "Success");
  console.log(
    "Elapsed time",
    Math.max(0, Date.now() - started).toLocaleString(),
    "ms",
  );
  if (exceptions.length) process.exit(1);
};

function getArguments(key: string): string[] {
  const prefix = `--${key}=`;
  return process.argv
    .slice(2)
    .filter((arg) => arg.startsWith(prefix))
    .flatMap((arg) => arg.slice(prefix.length).split(","))
    .map((arg) => arg.trim())
    .filter(Boolean);
}

export const TestExecutor = {
  main,
};

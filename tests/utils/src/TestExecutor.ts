import { DynamicExecutor } from "@nestia/e2e";
import fs from "node:fs";

/**
 * Shared feature-test runner used by the package-shaped test projects.
 *
 * Test packages expose each scenario as a `test_*` function; this wrapper keeps
 * discovery, include/exclude filtering, and console reporting identical across
 * compiler, runner, lint, and plugin suites.
 */
export namespace TestExecutor {
  /**
   * One or more feature-module trees for DynamicExecutor to scan. A test
   * package that splits its go-binary scenarios onto their own CI lanes passes
   * an array (e.g. `["src/features", "src/native"]`) so a plain local run still
   * exercises every tree while CI can point a lane at a single subtree.
   */
  export interface IProps {
    location: string | string[];
  }

  /**
   * Execute every discovered `test_*` export under the requested location(s).
   *
   * Command-line filters intentionally match by substring so a failing scenario
   * can be rerun from any package with `--include=<case-name>` without adding
   * package-specific runner switches.
   */
  export const main = async (props: IProps): Promise<void> => {
    const include = getArguments("include");
    const exclude = getArguments("exclude");
    const locations =
      typeof props.location === "string" ? [props.location] : props.location;
    const filter = (name: string) =>
      (include.length ? include.some((str) => name.includes(str)) : true) &&
      (exclude.length ? exclude.every((str) => !name.includes(str)) : true);
    const started = Date.now();
    // A suite that stops early must not read as a passing one. Nothing here
    // holds the event loop open by itself: a scenario awaiting a reply that
    // never comes, over a channel nothing else references, lets the process
    // exit with a success code and most of the suite unrun, which is exactly
    // as green as a real pass in CI.
    let finished = false;
    process.on("exit", (code) => {
      if (!finished && code === 0) {
        // Written synchronously: the process is already exiting, and an async
        // write to a pipe (which is how CI captures this) can be dropped before
        // it flushes, leaving a failed run with no reason attached.
        fs.writeSync(
          2,
          "The runner exited before finishing. Every case after the last one printed above was never run.\n",
        );
        process.exitCode = 1;
      }
    });

    const executions: DynamicExecutor.IReport["executions"] = [];
    for (const location of locations) {
      const report: DynamicExecutor.IReport = await DynamicExecutor.validate({
        prefix: "test_",
        location,
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
        filter,
      });
      executions.push(...report.executions);
    }

    if (executions.length === 0) {
      console.error(
        include.length
          ? `No tests matched --include=${include.join(",")}`
          : `No tests were discovered under ${locations.join(", ")}`,
      );
      process.exit(1);
    }

    const exceptions: Error[] = executions
      .filter((exec) => exec.error !== null)
      .map((exec) => exec.error!);
    for (const error of exceptions) console.error(error);
    console.log(exceptions.length ? "Failed" : "Success");
    console.log(
      "Elapsed time",
      Math.max(0, Date.now() - started).toLocaleString(),
      "ms",
    );
    finished = true;
    if (exceptions.length) process.exit(1);
  };

  /** Read comma-separated repeatable CLI filters such as `--include=a,b`. */
  function getArguments(key: string): string[] {
    const prefix = `--${key}=`;
    return process.argv
      .slice(2)
      .filter((arg) => arg.startsWith(prefix))
      .flatMap((arg) => arg.slice(prefix.length).split(","))
      .map((arg) => arg.trim())
      .filter(Boolean);
  }
}

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/** Discovers and runs the named feature exports of the package-shaped suites. */
export namespace TestExecutor {
  /** Feature-module trees selected by the owning test package. */
  export interface IProps {
    location: string | string[];
  }

  /**
   * Execute every selected test export, retaining each failure's identity.
   *
   * Files are selected before import. An import failure blocks only that file;
   * remaining files and locations still execute. Nested causes are printed as
   * each result arrives, so later discovery failures cannot hide them.
   *
   * @evidence contracts/common.md#principled-implementation A single walk selects the TypeScript file prefix and substring filters before the exported-function loop. Native ESM imports retain real file URL and module identity. Import and invocation failures remain errors while independent entries continue.
   * @evidence contracts/common.md#clear-and-simple-design One walk and two loops own discovery and execution without another runner or per-file directory rescans; existing package entries still provide locations and named exports.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No failure is retried or replaced. Returned false is reported as skipped without coverage; an empty selection or unfinished process is an error.
   * @evidence contracts/common.md#meaningful-documentation Documents selection before import, the file-level failure boundary and immediate nested error output; callers supply feature locations.
   * @evidence contracts/portability.md#os-neutral-implementation Native paths address directories and pathToFileURL supplies the module URL on Windows and POSIX. Directory links are not traversed, matching the former lstat-based discovery.
   * @evidence contracts/performance.md#efficient-algorithms One traversal visits each directory entry and each selected file is imported once. Executions run sequentially; retained paths grow with selected files and errors with failed entries.
   * @evidence contracts/performance.md#reuse-equivalent-work Node module caching shares imported helpers across cases and discovery runs once per location; test results are never reused.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Synchronous directory reads leave no handle open. Test children belong to their case owners. Paths and errors last through this run and the exit guard is removed on normal completion; nested error output is not separately capped.
   */
  export const main = async (props: IProps): Promise<void> => {
    const include = getArguments("include");
    const exclude = getArguments("exclude");
    const locations = typeof props.location === "string" ? [props.location] : props.location;
    const selected = (name: string): boolean =>
      name.startsWith("test_") && name.endsWith(".ts") &&
      (!include.length || include.some((value) => name.includes(value))) &&
      exclude.every((value) => !name.includes(value));
    const started = Date.now();
    let finished = false;
    const guard = (code: number): void => {
      if (!finished && code === 0) {
        fs.writeSync(2, "The runner exited before finishing. Cases after the last printed result were not run.\n");
        process.exitCode = 1;
      }
    };
    process.on("exit", guard);
    const failures: Error[] = [];
    let executed = 0;
    let skipped = 0;
    const fail = (name: string, cause: unknown): void => {
      const error = new Error(name, { cause });
      failures.push(error);
      console.dir(error, { depth: null });
    };
    for (const location of locations) {
      const files: string[] = [];
      const visit = (directory: string): void => {
        let entries: fs.Dirent[];
        try { entries = fs.readdirSync(directory, { withFileTypes: true }); }
        catch (error) { fail(`Test discovery failed under ${directory}`, error); return; }
        for (const entry of entries) {
          const file = path.join(directory, entry.name);
          if (entry.isDirectory()) visit(file);
          else if (entry.isFile() && selected(entry.name)) files.push(file);
        }
      };
      try {
        if (fs.statSync(location).isFile()) {
          if (selected(path.basename(location))) files.push(location);
        } else visit(location);
      } catch (error) { fail(`Test discovery failed under ${location}`, error); }
      for (const file of files) {
        let exports: Record<string, unknown>;
        try { exports = await import(pathToFileURL(file).href); }
        catch (error) { fail(`Test import failed: ${file}`, error); continue; }
        for (const [name, run] of Object.entries(exports)) {
          if (!name.startsWith("test_") || typeof run !== "function") continue;
          const before = Date.now();
          executed++;
          try {
            const value = await run();
            if (value === false) {
              skipped++;
              console.log(`  - ${name}: SKIPPED (returned false; no coverage claimed)`);
            } else console.log(`  - \x1b[32m${name}\x1b[0m: \x1b[33m${(Date.now() - before).toLocaleString()} ms\x1b[0m`);
          } catch (error) { fail(`Test failed: ${name} (${file})`, error); }
        }
      }
    }
    if (executed === 0)
      fail(include.length ? `No tests matched --include=${include.join(",")}` : `No tests were discovered under ${locations.join(", ")}`, undefined);
    console.log(failures.length ? "Failed" : "Success");
    if (skipped) console.log(`${skipped} case(s) skipped; no coverage claimed.`);
    console.log("Elapsed time", (Date.now() - started).toLocaleString(), "ms");
    finished = true;
    process.removeListener("exit", guard);
    if (failures.length) process.exitCode = 1;
  };

  /** Read repeatable comma-separated filters from the current invocation. */
  function getArguments(key: string): string[] {
    const prefix = `--${key}=`;
    return process.argv.slice(2).filter((value) => value.startsWith(prefix))
      .flatMap((value) => value.slice(prefix.length).split(","))
      .map((value) => value.trim()).filter(Boolean);
  }
}

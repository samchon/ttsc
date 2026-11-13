import { type ChildProcess, spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { E2ETrace } from "../../../internal/E2ETrace";

/**
 * Build the dependency projects a program used last time while its entry
 * project builds, instead of one after another at their first import.
 *
 * A program that imports workspace packages exporting TypeScript reaches each
 * package's own project only once it runs, so a run that rebuilt them compiled
 * them serially, each blocking the module that imported it, and none before the
 * entry project finished (samchon/ttsc#1859). Which projects a program reaches
 * is known after its first run: every process of the run notes each dependency
 * project it served in the run directory, and the launcher keeps that list in
 * the runtime build store, keyed by the entry project and its plugin policy.
 * The next run starts up to four worker processes for the listed projects as
 * soon as its run directory exists; each builds or adopts its projects through
 * the same per-run dependency cache, lock and store as the program, which then
 * finds each ready or waits for the worker holding its lock. Starting them only
 * after the entry build was measured to double the cost of a run whose edit
 * reached both the entry and a dependency. A worker's cache decisions are
 * speculative, so it reports them apart from the program's own
 * (`RuntimeBuildExplanation.speculative`), and a run whose entry build fails
 * stops its workers.
 *
 * No worker starts when `NODE_OPTIONS` selects an inspector, since a worker
 * runs under the program's options and would open, or wait for, a debugger of
 * its own.
 *
 * The list is a hint, not an input: a project the program no longer reaches
 * costs a build it did not need, and one it newly reaches is built at its first
 * import as before and listed for the next run. Workers still running when the
 * program ends are stopped, since their only remaining value is a parked build
 * for a later run.
 *
 * @evidence contracts/common.md#principled-implementation Workers run the program's own dependency build under the program's environment and the run's manifest, so the per-run cache key, lock and store entry are the ones the program asks for.
 * @evidence contracts/common.md#clear-and-simple-design One namespace owns the list file, its record in the store and the worker lifecycle; the build itself stays with the runtime hooks.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts A failed or stopped worker changes nothing the program relies on: the program builds what it needs itself.
 * @evidence contracts/common.md#meaningful-documentation Native prose states where the list comes from, how workers meet the program and why stale entries are harmless.
 * @evidence contracts/portability.md#os-neutral-implementation Workers are the current Node executable with argument arrays and no shell; paths are native.
 * @evidenceExclude contracts/performance.md#efficient-algorithms The namespace groups operations; each states its cost.
 * @evidence contracts/performance.md#reuse-equivalent-work A worker's build is the program's own build of that project in this run, shared through the run's dependency cache.
 * @evidence contracts/performance.md#bound-retention-and-release-resources At most four workers run; the launcher stops and joins them before the run directory goes.
 */
export namespace RuntimeDependencyPrebuild {
  /** File in a run directory listing the dependency projects it served. */
  export const USED_FILENAME = "dependency-projects.txt";

  /**
   * Note that this run served `tsconfig`'s project. Called by every process of
   * a run once per project.
   *
   * @param runDir The run directory.
   * @param tsconfig The served project's config.
   * @evidence contracts/common.md#principled-implementation One appended line per noted project; duplicates from several processes are removed when the list is kept.
   * @evidence contracts/common.md#clear-and-simple-design One append.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A failed append only loses a hint.
   * @evidence contracts/common.md#meaningful-documentation The prose states who calls it.
   * @evidence contracts/portability.md#os-neutral-implementation Native append of a native path and a line feed.
   * @evidence contracts/performance.md#efficient-algorithms One small append.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Noting is an effect.
   * @evidence contracts/performance.md#bound-retention-and-release-resources The file lives in the run directory and goes with it.
   */
  export function note(runDir: string, tsconfig: string): void {
    try {
      fs.appendFileSync(path.join(runDir, USED_FILENAME), tsconfig + "\n");
    } catch {
      /* The next run builds this project at its first import. */
    }
  }

  /**
   * Keep the projects this run served for the next run of the same entry.
   * Called by the launcher before the run directory goes.
   *
   * @param props.runDir The run directory.
   * @param props.store The runtime build store.
   * @param props.tsconfig The entry project's config.
   * @param props.plugins The run's plugin policy.
   * @evidence contracts/common.md#principled-implementation The record holds the sorted distinct projects of this run, replacing the previous run's.
   * @evidence contracts/common.md#clear-and-simple-design One read and one atomic write.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A run that served no dependency leaves the record as it was, so a run that ended early does not erase it.
   * @evidence contracts/common.md#meaningful-documentation The prose states when to call it.
   * @evidence contracts/portability.md#os-neutral-implementation Native read, write and rename within the store.
   * @evidence contracts/performance.md#efficient-algorithms Linear in the noted lines.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The record is a hint for later runs.
   * @evidence contracts/performance.md#bound-retention-and-release-resources One record per entry and policy, collected with the store's other files.
   */
  export function remember(props: {
    runDir: string;
    store: string;
    tsconfig: string;
    plugins: false | undefined;
  }): void {
    try {
      const projects = [
        ...new Set(
          fs
            .readFileSync(path.join(props.runDir, USED_FILENAME), "utf8")
            .split(/\r?\n/)
            .filter((line) => path.isAbsolute(line)),
        ),
      ].sort();
      if (projects.length === 0) return;
      const record = recordFile(props.store, props.tsconfig, props.plugins);
      const temporary = `${record}.${process.pid}.${crypto.randomUUID()}.tmp`;
      fs.mkdirSync(props.store, { recursive: true });
      fs.writeFileSync(temporary, JSON.stringify(projects));
      fs.renameSync(temporary, record);
    } catch {
      /* Without a record the next run builds dependencies as they load. */
    }
  }

  /**
   * Start building the projects the last run of this entry served, or return a
   * no-op when none is recorded. Called before the entry project builds.
   *
   * @param props.runDir The run directory, which holds the run's dependency
   *   cache.
   * @param props.store The runtime build store.
   * @param props.tsconfig The entry project's config.
   * @param props.projectRoot The entry project's root.
   * @param props.plugins The run's plugin policy.
   * @param props.environment The environment the program will run under, for
   *   the worker manifest named.
   * @returns A function that stops every worker still running and resolves once
   *   each has exited.
   * @evidence contracts/common.md#principled-implementation Workers get the program's environment, so their cache keys are the program's; their manifest carries the run's dependency cache and plugin policy and owns no source.
   * @evidence contracts/common.md#clear-and-simple-design Projects are dealt round-robin to at most four workers.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts A missing config drops out of the list; a worker failure is not reported, because the program builds what it needs itself.
   * @evidence contracts/common.md#meaningful-documentation Parameters state their roles and the result's contract.
   * @evidence contracts/portability.md#os-neutral-implementation The current Node executable, an argument array and hidden windows; stopping uses the platform's default termination.
   * @evidence contracts/performance.md#efficient-algorithms One record read and up to four process starts.
   * @evidence contracts/performance.md#reuse-equivalent-work See the namespace.
   * @evidence contracts/performance.md#bound-retention-and-release-resources Child handles are held until the returned function joins them.
   */
  export function start(props: {
    runDir: string;
    store: string;
    tsconfig: string;
    projectRoot: string;
    plugins: false | undefined;
    environment: (manifest: string) => NodeJS.ProcessEnv;
  }): () => Promise<void> {
    let projects: string[];
    try {
      const recorded: unknown = JSON.parse(
        fs.readFileSync(
          recordFile(props.store, props.tsconfig, props.plugins),
          "utf8",
        ),
      );
      projects = Array.isArray(recorded)
        ? recorded.filter(
            (project): project is string =>
              typeof project === "string" &&
              path.isAbsolute(project) &&
              fs.existsSync(project),
          )
        : [];
    } catch {
      projects = [];
    }
    if (projects.length === 0) return async () => undefined;
    const manifest = path.join(props.runDir, "prebuild-manifest.json");
    try {
      fs.mkdirSync(props.runDir, { recursive: true });
      fs.writeFileSync(
        manifest,
        JSON.stringify({
          depCacheDir: path.join(props.runDir, "deps"),
          emitDir: path.join(props.runDir, "prebuild"),
          emittedSources: {},
          projectRoot: props.projectRoot,
          rootDir: props.projectRoot,
          ...(props.plugins === false ? { plugins: false } : {}),
        }),
      );
    } catch {
      return async () => undefined;
    }
    const environment = props.environment(manifest);
    // A worker runs under the program's NODE_OPTIONS, which key its builds.
    // An inspector option there would make each worker open, or wait for, a
    // debugger of its own while the program waits on the worker's lock.
    if (/--(?:inspect|debug)/.test(environment.NODE_OPTIONS ?? ""))
      return async () => undefined;
    const workers: ChildProcess[] = [];
    const count = Math.min(4, projects.length);
    for (let index = 0; index < count; ++index) {
      const assigned = projects.filter(
        (_project, position) => position % count === index,
      );
      try {
        const args = [
          path.join(__dirname, "..", "runtimeDependencyPrebuild.js"),
          ...assigned,
        ];
        const trace = E2ETrace.begin(
          process.execPath,
          args,
          { cwd: props.projectRoot },
          "ttsx-dependency-prebuild",
        );
        const worker = spawn(process.execPath, args, {
          cwd: props.projectRoot,
          env: environment,
          stdio: "ignore",
          windowsHide: true,
        });
        E2ETrace.asynchronous(trace, worker);
        worker.on("error", () => undefined);
        workers.push(worker);
      } catch {
        /* The program builds this share itself. */
      }
    }
    return async () => {
      await Promise.all(
        workers.map(
          (worker) =>
            new Promise<void>((resolve) => {
              if (worker.exitCode !== null || worker.signalCode !== null)
                return resolve();
              worker.once("close", () => resolve());
              worker.kill();
            }),
        ),
      );
    };
  }

  /** The store record of one entry project's dependency projects. */
  function recordFile(
    store: string,
    tsconfig: string,
    plugins: false | undefined,
  ): string {
    return path.join(
      store,
      `${crypto
        .createHash("sha256")
        .update(`${tsconfig}\0${plugins === false ? "plain" : "plugins"}`)
        .digest("hex")}.dependencies.json`,
    );
  }
}

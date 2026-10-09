import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { isOrdinarilyClosedReadonlyLauncher } from "../../../utils/src/isOrdinarilyClosedReadonlyLauncher";
import { readE2eTraceMeasurements } from "../internal/readE2eTraceMeasurements";
import {
  maxFunctionCount,
  physicalRealpath,
  runTtsxWithCoverage,
  sourceMapSourcePath,
} from "../internal/ttsc/internal/ttsx-source-map";
import { BatchWorkspace } from "./BatchWorkspace";

/**
 * Verifies actual V8 coverage and stack consumers share the same source maps
 * without repeating equivalent original-option compiler queries.
 *
 * 1. Borrow one upfront root and two independently configured dependencies.
 * 2. Run root sourceMap true and false with the same response-selected target,
 *    recording native option queries, used/unused functions and all throws.
 * 3. Require real inline maps, physical source paths and independent stack
 *    coordinates.
 *
 * @evidence contracts/testing.md#behavioral-verification Two real installed ttsx sessions call three used exports, leave three unused exports uncalled, record three thrown stacks and rethrow an actual error. Every V8 script has nonnull map data naming its independently observed physical TypeScript file; unused stays zero and used stays positive. Authored root/dependency throw locations remain exactly12:9 and14:9 in both root configurations. Actual successful original-request showConfig records must be present and have no repeated command identity within either launcher; changed lowered argv and emit-provenance queries remain outside that equivalence class.
 * @evidence contracts/testing.md#independent-expectations Checked-in tall-comment source bytes establish used/unused intent and literal throw coordinates; native realpath independently establishes each source identity. Actual V8 coverage and native Error stacks supply observations, never expected data. The same original project/response invocation has no intervening input mutation, so its distinct command identities must equal its observed query population; the oracle does not copy measured counts or impose an elapsed limit.
 * @evidence contracts/testing.md#distinguishing-cases Root sourceMap true/false contrast with dependency sourceMap true/false in each session. Distinct source URLs and named throw records keep one lane from satisfying another. A real final rethrow must produce a nonzero ordinary exit. Response-selected ESNext requires distinct lowered arguments; the later maps-disabled configuration must still receive its own original observation and working forced runtime map.
 * @evidence contracts/testing.md#execution-ownership The selected Runtime DAG invokes this helper after collecting its main graph result. Two additional launcher lifetimes own two distinct root option preparations; each child imports both dependency owners and supplies stack plus V8 observations together.
 * @evidence contracts/e2e.md#necessary-boundary Native Node V8 coverage and Error.stack must consume compiler-served maps under original source URLs. Pure inlining/path units cannot establish actual source-map-cache data or execution counts, nor whether context assembly repeats actual compiler response expansion across its adapters.
 * @evidence contracts/e2e.md#shared-execution One upfront source/dependency graph and installed SDK serve both necessary root configurations. Each session shares its root and both dependencies between coverage and stack checks instead of four independent hosts. Real native preparation and descendant costs remain unmeasured, not zero. The same two launchers also verify the effective-options reuse boundary; no extra launcher or native contributor is prepared.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Distinct fresh coverage recorders and runtime generations belong to each session. Ordinary launcher closure and PID departure precede option mutation; unknown ownership retains the shared graph and blocks the next session. Original config bytes restore only after closure. Child joins do not certify arbitrary native descendants. Each actor lends its existing isolated coverage recorder to trace observations outside its source graph; the coverage and trace readers consume distinct file formats. Required launcher writer and process-integrity checks precede query assertions.
 * @evidence contracts/e2e.md#preserved-coverage Restores original maps-enabled/disabled root and dependency coverage with real-map/source/used-positive/unused-zero assertions, and exact root/dependency stack coordinates with actual rethrow failure. Assertions collect across scripts and both sessions; written linkage remains unexecuted until CI.
 */
export function runtimeMapsCorpus(workspace: BatchWorkspace.Workspace): void {
  const root = path.join(workspace.root, "tools/runtime-maps");
  const config = path.join(root, "tsconfig.json");
  const response = "runtime-options.rsp";
  const original = fs.readFileSync(config);
  const originals = new Map(
    [
      "package.json",
      "tsconfig.json",
      response,
      "src/main.ts",
      "src/library.ts",
      "src/boom.ts",
      ...["mapped", "forced"].flatMap((mode) =>
        ["package.json", "tsconfig.json", "src/index.ts"].map(
          (file) => "packages/" + mode + "/" + file,
        ),
      ),
    ].map((file) => [file, fs.readFileSync(path.join(root, file))]),
  );
  const nodeModules = path.join(root, "node_modules");
  fs.mkdirSync(nodeModules);
  for (const mode of ["mapped", "forced"])
    fs.symlinkSync(
      path.join(root, "packages", mode),
      path.join(nodeModules, "map-" + mode),
      "junction",
    );
  const failures: unknown[] = [];
  let unresolved = false;
  const capture = (name: string, body: () => void): void => {
    try {
      body();
    } catch (error) {
      failures.push(new Error(name, { cause: error }));
    }
  };
  try {
    for (const sourceMap of [true, false]) {
      if (unresolved) {
        failures.push(
          new Error("preceding map actor has unresolved ownership"),
        );
        break;
      }
      fs.writeFileSync(
        config,
        JSON.stringify({
          ...JSON.parse(original.toString("utf8")),
          compilerOptions: {
            ...JSON.parse(original.toString("utf8")).compilerOptions,
            sourceMap,
          },
        }),
      );
      const recorder = path.join(
        workspace.cache,
        "runtime-map-coverage-" + sourceMap,
      );
      fs.mkdirSync(recorder);
      let launcherPid: number | undefined;
      const spawn: typeof TestProject.spawn = (_script, args, options) => {
        const result = TestProject.spawn(
          process.execPath,
          [
            workspace.installedTtsx,
            ...args.slice(0, -1),
            "@" + response,
            args.at(-1)!,
          ],
          {
            ...options,
            env: {
              ...options?.env,
              TTSC_BINARY: undefined,
              TTSC_TSGO_BINARY: undefined,
            },
          },
        );
        launcherPid = result.pid;
        if (!isOrdinarilyClosedReadonlyLauncher(result)) {
          unresolved = true;
          BatchWorkspace.retain(
            "map actor ordinary closure remained unresolved",
          );
          throw new Error("map actor ordinary closure remained unresolved", {
            cause: result.error,
          });
        }
        try {
          process.kill(result.pid, 0);
          unresolved = true;
          throw new Error("map actor PID remained live");
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ESRCH") {
            unresolved = true;
            BatchWorkspace.retain(
              "map actor PID departure remained unresolved",
            );
            throw error;
          }
        }
        return result;
      };
      let run: ReturnType<typeof runTtsxWithCoverage>;
      try {
        run = runTtsxWithCoverage(
          root,
          "src/main.ts",
          { TTSC_CACHE_DIR: workspace.cache, TTSC_E2E_TRACE: recorder },
          spawn,
          recorder,
        );
      } catch (error) {
        failures.push(error);
        continue;
      }
      capture("sourceMap=" + sourceMap + " original option reuse", () => {
        assert.ok(launcherPid, "the actual launcher must have been observed");
        const observed = readE2eTraceMeasurements(recorder, [launcherPid]);
        assert.deepEqual(observed.integrityProblems, []);
        assert.deepEqual(observed.incompleteProcessInvocations, []);
        const queries = observed.processObservations
          .map(
            ({ observation }) =>
              observation as typeof observation & { argv?: unknown; cwd?: unknown },
          )
          .filter(
            (row) =>
              row.writerPid === launcherPid &&
              row.event === "process-result" &&
              Array.isArray(row.argv) &&
              row.argv.every((arg) => typeof arg === "string") &&
              row.argv.includes("@" + response) &&
              row.argv.at(-1) === "--showConfig" &&
              !row.argv.includes("--noEmit"),
          );
        assert.ok(queries.at(0), "native expansion of the original response is required");
        const identities = new Set(
          queries.map((row) => JSON.stringify({ cwd: row.cwd, argv: row.argv })),
        );
        assert.equal(
          queries.length,
          identities.size,
          "equivalent original option requests must share their prepared reader",
        );
        for (const query of queries) {
          assert.equal(query.data?.status, 0);
          assert.equal(query.data?.signal, null);
          assert.equal(query.data?.exitObserved, true);
        }
      });
      capture("sourceMap=" + sourceMap + " execution", () => {
        assert.notEqual(run.status, 0, "actual rethrow must fail the run");
        assert.match(run.stdout, /^used ran\|used ran\|used ran$/m);
        const line = run.stdout
          .split(/\r?\n/)
          .find((line) => line.startsWith("TTSC_MAP_STACKS:"));
        assert.ok(line, run.stdout + run.stderr);
        const records = JSON.parse(line.slice("TTSC_MAP_STACKS:".length)) as {
          name: string;
          threw: boolean;
          stack?: string;
        }[];
        assert.deepEqual(
          records.map(({ name, threw }) => ({ name, threw })),
          [
            { name: "boom", threw: true },
            { name: "depBoom", threw: true },
            { name: "forcedBoom", threw: true },
          ],
        );
        for (const [index, file, coordinate, functionName] of [
          [0, "src/boom.ts", "12:9", "boom"],
          [1, "packages/mapped/src/index.ts", "14:9", "depBoom"],
          [2, "packages/forced/src/index.ts", "14:9", "depBoom"],
        ] as const)
          assert.ok(
            records[index]?.stack?.includes(
              "at " +
                functionName +
                " (" +
                physicalRealpath(path.join(root, file)) +
                ":" +
                coordinate +
                ")",
            ),
            records[index]?.stack,
          );
      });
      for (const relative of [
        "src/library.ts",
        "packages/mapped/src/index.ts",
        "packages/forced/src/index.ts",
      ])
        capture("sourceMap=" + sourceMap + " coverage " + relative, () => {
          const script = run.scriptEndingWith(relative);
          assert.ok(script, "actual V8 script: " + relative);
          assert.notEqual(script.sourceMap, null, "actual V8 inline map data");
          const source = sourceMapSourcePath(script);
          assert.ok(source);
          assert.equal(
            physicalRealpath(source),
            physicalRealpath(path.join(root, relative)),
          );
          assert.equal(maxFunctionCount(script, "unused"), 0);
          assert.ok(maxFunctionCount(script, "used") >= 1);
        });
    }
  } finally {
    if (!unresolved) fs.writeFileSync(config, original);
  }
  if (!unresolved) {
    for (const [file, bytes] of originals)
      capture("unchanged map source " + file, () =>
        assert.deepEqual(fs.readFileSync(path.join(root, file)), bytes),
      );
    for (const output of ["lib", "packages/mapped/lib", "packages/forced/lib"])
      capture("private map outputs " + output, () =>
        assert.equal(fs.existsSync(path.join(root, output)), false),
      );
  }
  if (failures.length)
    throw new AggregateError(failures, "actual runtime map consumers failed");
}

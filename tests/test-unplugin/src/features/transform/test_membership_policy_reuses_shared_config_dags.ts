import assert from "node:assert/strict";
import fs from "node:fs";
import { Session } from "node:inspector/promises";
import os from "node:os";
import path from "node:path";
import { isMainThread, Worker } from "node:worker_threads";

import { findDeclaredValue } from "../../../../../packages/unplugin/src/core/tsconfig/findDeclaredValue";
import { readEffectiveTsconfigPaths } from "../../../../../packages/unplugin/src/core/tsconfig/readEffectiveTsconfigPaths";
import { readEffectiveTsconfigTemplateCompilerOptions } from "../../../../../packages/unplugin/src/core/tsconfig/readEffectiveTsconfigTemplateCompilerOptions";
import { readEffectiveTsconfigTemplateFileSpecs } from "../../../../../packages/unplugin/src/core/tsconfig/readEffectiveTsconfigTemplateFileSpecs";
import { readProjectMembershipPolicy } from "../../../../../packages/unplugin/src/core/tsconfig/readProjectMembershipPolicy";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies membership and wrapper views reuse shared config DAG ancestors.
 *
 * V8 precise call counts observe actual source operations without replacing
 * filesystem or resolver methods. Two configs per layer create exponentially
 * many paths; fixture node/edge counts define bounded observation work.
 *
 * 1. Read singleton, duplicate-base and layered DAG policies twice independently.
 * 2. Assert literal membership, origins and ordered source observations, plus
 *    one parse/identity per node and one resolution per distinct outgoing specifier.
 * 3. Count actual absent-value selections and exercise paths and both template
 *    views on the same DAG, preserving raw invalid list elements and configDir.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the actual membership reader and all three wrapper-view readers; V8 counts production parse/realpath/extends operations and a supplied generic selector counts actual absent selections. Assertions cover usable lists, output exclusions, flags, source order, paths and raw template list elements.
 * @evidence contracts/testing.md#independent-expectations Authored depth gives 2d+2 nodes and 4d distinct outgoing specifiers for d>=1; singleton and duplicate-base counts follow their literal topology. Explicit base values and lexical/configDir anchors define expected policy/template paths independently of traversal results.
 * @evidence contracts/testing.md#distinguishing-cases Singleton, duplicate direct bases and depths one/six distinguish absent inheritance, immediate sharing and recursively shared paths. Two independent policy reads require fresh full observations. Missing selector keys distinguish memoized absence; template views retain a non-string file entry while membership drops it.
 * @evidence contracts/testing.md#execution-ownership The source runner awaits one fresh Node worker running this same exported entry once. Its independent JS isolate owns real JSON inputs and Inspector coverage; it explicitly registers the existing authored unit loader before importing this entry. The parent retains arbitrary worker errors separately from event presence and original final exit, and requires a post-assertion completion receipt binding actual loader URL, arguments, cwd and native temporary root to the inherited parent route, including on exit zero. Finally stops coverage and disconnects; independent reader errors are collected before AggregateError. No compiler, producer, host, installation, retry, foreign method replacement or wall-clock threshold runs.
 */
export async function test_membership_policy_reuses_shared_config_dags(): Promise<void> {
  // Precise coverage belongs to the isolate, including its previously compiled
  // functions. Earlier suite entries can leave binary-only coverage records;
  // keep this measurement's Inspector and source execution in one fresh isolate.
  if (isMainThread) {
    const loader = new URL("../../../../../config/register-unit-loader.mjs", import.meta.url).href;
    await new Promise<void>((resolve, reject) => {
      const worker = new Worker(
        `import("node:worker_threads").then(async ({ parentPort }) => {
          const loader = ${JSON.stringify(loader)};
          await import(loader);
          const entry = await import(${JSON.stringify(import.meta.url)});
          await entry.test_membership_policy_reuses_shared_config_dags();
          parentPort.postMessage({ completed: true, loader, execArgv: process.execArgv,
            cwd: process.cwd(), temporaryRoot: (await import("node:os")).tmpdir() });
        }).catch(error => { console.dir(error, { depth: null }); throw error; });`,
        { eval: true },
      );
      let receipt: unknown;
      let failed = false;
      let failure: unknown;
      worker.on("message", (message: unknown) => {
        receipt = message;
      });
      worker.once("error", (error) => { failed = true; failure = error; });
      worker.once("exit", (code) => {
        if (failed || code !== 0)
          reject(new Error(
            `DAG measurement worker exited ${code}, error event ${failed}`,
            { cause: failure },
          ));
        else {
          try {
            assert.deepEqual(receipt, {
              completed: true, loader, execArgv: process.execArgv,
              cwd: process.cwd(), temporaryRoot: os.tmpdir(),
            });
            resolve();
          } catch (cause) {
            reject(new Error(`DAG measurement worker exited ${code} without a matching completion receipt`, { cause }));
          }
        }
      });
    });
    return;
  }
  const root = TestProject.physicalPath(TestProject.tmpdir("ttsc-policy-dag-"));
  const session = new Session();
  const failures: Error[] = [];
  const check = (name: string, operation: () => void): void => {
    try {
      operation();
    } catch (cause) {
      failures.push(new Error(name, { cause }));
    }
  };
  const at = (name: string): string => path.join(root, name);
  const pattern = (name: string): string => at(name).replaceAll("\\", "/");
  const write = (name: string, value: unknown): void => {
    fs.writeFileSync(at(name), JSON.stringify(value));
  };
  session.connect();
  try {
    await session.post("Profiler.enable");
    await session.post("Profiler.startPreciseCoverage", {
      callCount: true,
      detailed: true,
    });
    for (const depth of [-1, 0, 1, 6]) {
      write("base.json", {
        compilerOptions: {
          allowJs: true,
          outDir: "${configDir}/out",
          paths: { "@/*": ["${configDir}/shared/*", "ordinary/*"] },
          rootDirs: ["${configDir}/roots", "ordinary"],
        },
        files: ["${configDir}/main.ts", 7],
      });
      for (let level = 1; level <= depth; level++)
        for (const branch of ["a", "b"])
          write(`${branch}${level}.json`, {
            extends:
              level === 1
                ? ["./base.json", "./base.json"]
                : [`./a${level - 1}.json`, `./b${level - 1}.json`],
            compilerOptions: { target: branch === "a" ? "ES2019" : "ES2020" },
          });
      write("entry.json", {
        ...(depth < 0
          ? {}
          : {
              extends:
                depth === 0
                  ? ["./base.json", "./base.json"]
                  : [`./a${depth}.json`, `./b${depth}.json`],
            }),
      });
      const nodes = depth < 0 ? 1 : 2 * depth + 2;
      const edges = depth < 0 ? 0 : depth === 0 ? 1 : 4 * depth;
      const expectedSources = [at("entry.json")];
      for (let level = depth; level >= 1; level--)
        expectedSources.push(at(`a${level}.json`));
      if (depth >= 0) expectedSources.push(at("base.json"));
      for (let level = 1; level <= depth; level++)
        expectedSources.push(at(`b${level}.json`));
      for (const invocation of [1, 2]) {
        let policy: ReturnType<typeof readProjectMembershipPolicy> | undefined;
        check(`depth ${depth} read ${invocation} operation`, () => {
          policy = readProjectMembershipPolicy(at("entry.json"));
        });
        const coverage = await session.post("Profiler.takePreciseCoverage");
        const calls = (file: string, name: string): number => {
          const functions = coverage.result
            .filter((script) =>
              script.url.replaceAll("\\", "/").endsWith(`/${file}.ts`),
            )
            .flatMap((script) => script.functions)
            .filter((entry) => entry.functionName === name);
          assert.ok(functions.length <= 1, `${name} coverage identity`);
          if ((functions[0]?.ranges[0]?.count ?? 0) !== 0)
            assert.equal(functions[0]?.isBlockCoverage, true, JSON.stringify(functions));
          return functions[0]?.ranges[0]?.count ?? 0;
        };
        if (policy === undefined) continue;
        const actualPolicy = policy;
        check(`depth ${depth} read ${invocation} bounded observations`, () => {
          assert.equal(calls("parseJsonc", "parseJsonc"), nodes);
          assert.equal(calls("resolveExtendsConfig", "resolveExtendsConfig"), edges);
          assert.equal(
            calls("resolveRealPath", "resolveRealPath"),
            nodes + 1,
            JSON.stringify(coverage.result.filter((script) =>
              script.url.replaceAll("\\", "/").endsWith("/resolveRealPath.ts"),
            )),
          );
        });
        check(`depth ${depth} read ${invocation} membership and origins`, () => {
          assert.deepEqual(actualPolicy.sources, expectedSources);
          assert.deepEqual(actualPolicy.rootFileSpecs?.files, depth < 0 ? [] : [pattern("main.ts")]);
          assert.deepEqual(actualPolicy.rootFileSpecs?.include, depth < 0 ? [pattern("**/*")] : []);
          assert.deepEqual(actualPolicy.excludedDirectories, depth < 0 ? [] : [at("out")]);
          assert.deepEqual(actualPolicy.inputExtensions, [
            ".ts", ".tsx", ".mts", ".cts",
            ...(depth < 0 ? [] : [".js", ".jsx", ".mjs", ".cjs"]),
          ]);
        });
      }
      check(`depth ${depth} absent selection reuse`, () => {
        let selected = 0;
        const absent = findDeclaredValue(
          at("entry.json"),
          () => {
            selected++;
            return undefined;
          },
          new Set(),
        );
        assert.equal(absent, null);
        assert.equal(selected, nodes);
      });
      await session.post("Profiler.takePreciseCoverage");
      for (const [name, read, expected] of [
        ["compiler templates", readEffectiveTsconfigTemplateCompilerOptions, depth < 0 ? {} : {
          outDir: at("out"), rootDirs: [at("roots"), at("ordinary")],
          paths: { "@/*": [pattern("shared/*"), pattern("ordinary/*")] },
        }],
        ["file templates", readEffectiveTsconfigTemplateFileSpecs, depth < 0 ? {} : {
          files: [pattern("main.ts"), 7],
        }],
      ] as const) {
        let result: Record<string, unknown> | undefined;
        check(`depth ${depth} ${name} operation`, () => {
          result = read(at("entry.json"));
        });
        const coverage = await session.post("Profiler.takePreciseCoverage");
        if (result === undefined) continue;
        check(`depth ${depth} ${name} shared edges and values`, () => {
          const entries = coverage.result
            .filter((script) => script.url.replaceAll("\\", "/").endsWith("/resolveExtendsConfig.ts"))
            .flatMap((script) => script.functions)
            .filter((entry) => entry.functionName === "resolveExtendsConfig");
          assert.ok(entries.length <= 1, "template edge coverage identity");
          if ((entries[0]?.ranges[0]?.count ?? 0) !== 0)
            assert.equal(entries[0]?.isBlockCoverage, true, JSON.stringify(entries));
          assert.equal(entries[0]?.ranges[0]?.count ?? 0, edges);
          assert.deepEqual(result, expected);
        });
      }
      check(`depth ${depth} effective paths`, () => {
        assert.deepEqual(readEffectiveTsconfigPaths(at("entry.json")), depth < 0 ? {} : {
          "@/*": [pattern("shared/*"), pattern("ordinary/*")],
        });
      });
      await session.post("Profiler.takePreciseCoverage");
    }
  } finally {
    try {
      await session.post("Profiler.stopPreciseCoverage");
      await session.post("Profiler.disable");
    } finally {
      session.disconnect();
    }
  }
  if (failures.length !== 0)
    throw new AggregateError(failures, "membership DAG reuse failed");
}

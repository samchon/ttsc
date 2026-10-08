import { Session } from "node:inspector/promises";

import { loadProjectPlugins } from "../../../../../packages/ttsc/src/plugin/internal/load/loadProjectPlugins";
import { TestProject } from "../../../../utils/src/TestProject";
import { assert, fs, path, readProjectConfig } from "../../internal/project-unit";

/**
 * Verifies one project read evaluates completed diamond ancestors once.
 *
 * Native V8 call counts observe the actual JSONC reader and extends resolver
 * without replacing filesystem methods or changing production resolution.
 * The topology has two configs per layer but exponentially many paths.
 *
 * 1. Author singleton, duplicate-base and layered diamond configurations.
 * 2. Read each through the production source under precise call coverage.
 * 3. Assert unique reads, declared-edge resolutions and ordered merged values.
 * 4. Require the plugin loader's independent config confirmation on that DAG.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls readProjectConfig and uses V8's supported precise function counts to require one readJsoncFile call per distinct config and one resolveTsconfigExtends call per declared edge. Also asserts inherited values, final-consumer paths and exact configPaths order. The actual no-plugin loader must perform two independent reader observations, each reading all distinct configs, while preserving its host-input proofs.
 * @evidence contracts/testing.md#independent-expectations Authored layer counts give 2d+2 files and 4d+2 edges independently of reader traversal. Explicit left/right target values establish last-base precedence; literal DFS postorder establishes deduplicated configPaths.
 * @evidence contracts/testing.md#distinguishing-cases Empty singleton, duplicate direct bases and depths one and six distinguish no sharing, immediate sharing and recursively shared completed work. Separate reads each require their own full unique population, ruling out a persistent result cache; the actual loader's two observations distinguish invocation reuse from skipped stability confirmation. Observation and error cases have separate named owners.
 * @evidence contracts/testing.md#execution-ownership The sequential source-unit runner invokes this async entry. An in-process inspector session observes real source calls on a private fixture filesystem and disconnects in finally. loadProjectPlugins receives entries:false and exits with no native plugins before descriptor/source-host preparation; no subprocess, install, native producer or product host runs.
 */
export async function test_readprojectconfig_reuses_completed_diamond_ancestors(): Promise<void> {
  const root = TestProject.physicalPath(TestProject.tmpdir("ttsc-config-dag-"));
  const session = new Session();
  const failures: Error[] = [];
  const check = (name: string, operation: () => void): void => {
    try {
      operation();
    } catch (cause) {
      failures.push(new Error(name, { cause }));
    }
  };
  const write = (name: string, value: unknown): void => {
    fs.writeFileSync(path.join(root, name), JSON.stringify(value));
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
        compilerOptions: { strict: true, outDir: "${configDir}/out" },
      });
      for (let level = 1; level <= depth; level++) {
        for (const branch of ["a", "b"]) {
          write(`${branch}${level}.json`, {
            extends:
              level === 1
                ? ["./base.json", "./base.json"]
                : [`./a${level - 1}.json`, `./b${level - 1}.json`],
            compilerOptions: {
              target: branch === "a" ? "ES2019" : "ES2020",
            },
          });
        }
      }
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
      const result = readProjectConfig({
        tsconfig: path.join(root, "entry.json"),
      });
      const coverage = await session.post("Profiler.takePreciseCoverage");
      const calls = (file: string, name: string): number => {
        const scripts = coverage.result.filter((script) =>
          script.url.replaceAll("\\", "/").endsWith(`/${file}.ts`),
        );
        assert.ok(scripts.length <= 1, `${file} coverage identity`);
        const functions =
          scripts[0]?.functions.filter(
            (entry) => entry.functionName === name,
          ) ?? [];
        assert.ok(functions.length <= 1, `${name} coverage identity`);
        return functions[0]?.ranges[0]?.count ?? 0;
      };
      check(`depth ${depth} unique reads`, () => {
        assert.equal(
          calls("readJsoncFile", "readJsoncFile"),
          depth < 0 ? 1 : 2 * depth + 2,
        );
      });
      check(`depth ${depth} declared edges`, () => {
        assert.equal(
          calls("resolveTsconfigExtends", "resolveTsconfigExtends"),
          depth < 0 ? 0 : 4 * depth + 2,
        );
      });
      check(`depth ${depth} merged values and order`, () => {
        const expected = depth < 0 ? [] : [path.join(root, "base.json")];
        for (let level = 1; level <= depth; level++) {
          expected.push(path.join(root, `a${level}.json`));
          expected.push(path.join(root, `b${level}.json`));
        }
        expected.push(path.join(root, "entry.json"));
        assert.deepEqual(result.configPaths, expected);
        assert.equal(result.configInputsComplete, true);
        assert.equal(result.compilerOptions.strict, depth < 0 ? undefined : true);
        assert.equal(
          result.compilerOptions.outDir,
          depth < 0 ? undefined : path.join(root, "out"),
        );
        assert.equal(
          result.compilerOptions.target,
          depth > 0 ? "ES2020" : undefined,
        );
      });
    }
    const loaded = loadProjectPlugins({
      binary: "",
      entries: false,
      tsconfig: path.join(root, "entry.json"),
    });
    const coverage = await session.post("Profiler.takePreciseCoverage");
    for (const [file, functionName, expected] of [
      ["readProjectConfig", "readProjectConfig", 2],
      ["readJsoncFile", "readJsoncFile", 28],
      ["resolveTsconfigExtends", "resolveTsconfigExtends", 52],
    ] as const) {
      check(`loader retains independent ${functionName} observations`, () => {
        const counts = coverage.result
          .filter((script) =>
            script.url.replaceAll("\\", "/").endsWith(`/${file}.ts`),
          )
          .flatMap((script) => script.functions)
          .filter((entry) => entry.functionName === functionName)
          .map((entry) => entry.ranges[0]!.count);
        assert.deepEqual(counts, [expected]);
      });
    }
    check("loader preserves the accepted config and host-input proof", () => {
      assert.deepEqual(loaded.nativePlugins, []);
      assert.equal(loaded.discoveryInputsComplete, true);
      assert.equal(loaded.project.compilerOptions.strict, true);
      assert.equal(loaded.project.compilerOptions.target, "ES2020");
      assert.equal(loaded.project.configPaths.length, 14);
      for (const file of loaded.project.configPaths) {
        assert.ok(loaded.hostInputs.includes(file));
        assert.equal(typeof loaded.hostInputHashes[file], "string");
        assert.equal(loaded.hostInputRealpaths[file], fs.realpathSync(file));
      }
    });
  } finally {
    try {
      await session.post("Profiler.stopPreciseCoverage");
      await session.post("Profiler.disable");
    } finally {
      session.disconnect();
    }
  }
  if (failures.length !== 0)
    throw new AggregateError(failures, "config diamond reuse failed");
}

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { SidecarEnvironment } from "../../../../../packages/ttsc/src/compiler/internal/sharedHost/SidecarEnvironment";
import { PluginDescriptorEvaluationCache } from "../../../../../packages/ttsc/src/plugin/internal/load/PluginDescriptorEvaluationCache";
import { PluginBuildEnvironmentWitness } from "../../../../../packages/ttsc/src/plugin/internal/source/PluginBuildEnvironmentWitness";
import { PluginContentIdentities } from "../../../../../packages/ttsc/src/plugin/internal/source/PluginContentIdentities";
import { SourceBuildCacheLayout } from "../../../../../packages/ttsc/src/plugin/internal/source/SourceBuildCacheLayout";
import { readPluginBuildEnvironment } from "../../../../../packages/ttsc/src/plugin/internal/source/readPluginBuildEnvironment";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies the answers a plugin load keeps for later processes are served only
 * while what they depend on holds, and that a ttsx run's own per-run channels
 * do not move them.
 *
 * Every ttsx launch is a new process, and a plugin load used to read its Go
 * build environment (`go env`, `go version`, GOROOT), ask a custom compiler for
 * its version and evaluate its descriptor again on each one, seconds per load
 * after every input was proven unchanged (samchon/ttsc#1852).
 *
 * 1. Read a build environment whose C compiler is a fixture file into a fresh
 *    record store, mark the record, and read again: the marked record is
 *    served. Write the compiler file: the record moves and a fresh reading
 *    replaces it.
 * 2. Resolve a custom compiler's line in a new process, mark the recorded version,
 *    resolve again in another process, then rewrite the compiler and resolve
 *    once more.
 * 3. Locate a descriptor evaluation under environments that differ only in a ttsx
 *    per-run channel, a reporting switch, or an ordinary variable.
 *
 * @evidence contracts/testing.md#behavioral-verification The production reader, compiler-target resolution and descriptor locator run over real files and real record stores; a marked record coming back is the observable proof that it, not a fresh reading, answered, and a fresh answer after a change proves the witness or identity refused it.
 * @evidence contracts/testing.md#independent-expectations The fixture C compiler is a file the environment digest hashes and the witness stats; the custom compiler reports 7.1 by construction, so 7.0 can only come from the marked record; per-run channels name directories no evaluation reads, while any other variable reaches the evaluator.
 * @evidence contracts/testing.md#distinguishing-cases Unchanged inputs against a written compiler file; an unchanged compiler binary against rewritten bytes; a per-run channel and a reporting switch against an ordinary variable.
 * @evidence contracts/testing.md#execution-ownership The unit owns a temporary project and cache; the build environment runs without a Go tool, the compiler-target cases start two-plus-one ordinary Node source actors with NODE_OPTIONS cleared, and the descriptor locator runs no evaluation.
 */
export function test_plugin_load_answers_hold_only_while_their_inputs_do(): void {
  const root = TestProject.physicalPath(
    TestProject.tmpdir(
      "ttsc-plugin-load-answers-",
      path.join(TestProject.WORKSPACE_ROOT, ".cache"),
    ),
  );
  const cacheDir = path.join(root, "cache");
  const answers = path.join(
    cacheDir,
    SourceBuildCacheLayout.ANSWER_CACHE_DIRNAME,
  );
  /** The only answer file of `kind`, with its entry rewritten by `mark`. */
  const markAnswer = (kind: string, mark: (value: any) => unknown): void => {
    const files = fs
      .readdirSync(answers)
      .map((name) => path.join(answers, name))
      .filter(
        (file) => JSON.parse(fs.readFileSync(file, "utf8")).kind === kind,
      );
    assert.equal(files.length, 1, `one ${kind} record`);
    const entry = JSON.parse(fs.readFileSync(files[0]!, "utf8"));
    entry.value = mark(entry.value);
    fs.writeFileSync(files[0]!, JSON.stringify(entry));
  };
  const settle = (): void => {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 60);
  };

  // 1. The build environment.
  const compiler = path.join(root, "cc.cmd");
  fs.writeFileSync(compiler, "compiler-a\n");
  const env = { CC: `"${compiler}"`, CGO_ENABLED: "1" };
  const store = () =>
    PluginContentIdentities.open({ projectRoot: root, cacheDir, env });
  const read = (): string => {
    const witness: PluginBuildEnvironmentWitness.Record = new Map();
    const digest = readPluginBuildEnvironment(
      undefined,
      root,
      env,
      witness,
      store(),
    );
    assert.ok(witness.has(compiler), "the caller receives the witness");
    return digest;
  };
  settle();
  const fresh = read();
  markAnswer("plugin-build-environment", (value) => ({
    ...value,
    value: "marked",
  }));
  assert.equal(read(), "marked", "an unchanged environment serves its record");
  settle();
  fs.writeFileSync(compiler, "compiler-b\n");
  const moved = read();
  assert.notEqual(moved, "marked", "a moved witness refuses its record");
  assert.notEqual(moved, fresh, "the compiler's bytes reach the digest");

  // 2. A custom compiler's version, across processes.
  const binary = path.join(root, "custom-tsc.cjs");
  fs.writeFileSync(
    binary,
    'process.stdout.write("Version 7.1.0-dev.20261020.3\\n");\n',
  );
  const resolve = (): string => {
    settle();
    const result = spawnSync(
      process.execPath,
      [
        "--import",
        new URL(
          "../../../../../config/register-unit-loader.mjs",
          import.meta.url,
        ).href,
        fileURLToPath(
          new URL(
            "../../internal/plugin-load-answer-actor.ts",
            import.meta.url,
          ),
        ),
        root,
        binary,
      ],
      {
        encoding: "utf8",
        windowsHide: true,
        env: { ...process.env, NODE_OPTIONS: undefined },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  };
  assert.equal(resolve(), "7.1");
  markAnswer("compiler-version", () => "Version 7.0.0");
  assert.equal(resolve(), "7.0", "an unchanged binary serves its record");
  fs.appendFileSync(binary, "// rebuilt\n");
  assert.equal(resolve(), "7.1", "new bytes are asked again");

  // 3. Descriptor evaluations under a ttsx run's channels.
  const base = SidecarEnvironment.merge(process.env, {
    NODE_OPTIONS: undefined,
  });
  const locate = (extra: NodeJS.ProcessEnv): string | null =>
    PluginDescriptorEvaluationCache.locate({
      cacheDir,
      context: {
        binary: "",
        cwd: root,
        dirname: root,
        filename: path.join(root, "plugin.cjs"),
        plugin: { transform: path.join(root, "plugin.cjs") },
        pluginConfigDir: root,
        projectRoot: root,
        tsconfig: path.join(root, "tsconfig.json"),
      },
      cwd: root,
      env: { ...base, ...extra },
      projectRoot: root,
      request: path.join(root, "plugin.cjs"),
      runtime: process.execPath,
      version: "plugin-load-answers-unit",
    });
  const plain = locate({});
  assert.ok(plain !== null, "the real Node executable identifies an entry");
  assert.equal(
    locate({ TTSX_RUNTIME_RUN_DIR: path.join(root, "run-1") }),
    plain,
    "a per-run channel names no evaluation input",
  );
  assert.equal(
    locate({ TTSC_E2E_TRACE: path.join(root, "trace") }),
    plain,
    "a reporting switch names no evaluation input",
  );
  assert.notEqual(
    locate({ PLUGIN_LOAD_ANSWERS_VARIABLE: "1" }),
    plain,
    "any other variable reaches the evaluator",
  );
}

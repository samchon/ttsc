import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import type createLint from "../../../../../packages/lint/src/createTtscPlugin";
import { BuildExecution } from "../../../../../packages/ttsc/src/compiler/internal/build/BuildExecution";
import { NativePluginArguments } from "../../../../../packages/ttsc/src/compiler/internal/build/NativePluginArguments";
import type { RunBuildOptions } from "../../../../../packages/ttsc/src/compiler/internal/build/RunBuildOptions";
import { runNativeCheckWithObservations } from "../../../../../packages/ttsc/src/compiler/internal/runNativeCheckWithObservations";
import type { ITtscLoadedNativePlugin } from "../../../../../packages/ttsc/src/structures/internal/ITtscLoadedNativePlugin";
import type { TtscBuildOptions } from "../../../../../packages/ttsc/src/structures/internal/TtscBuildOptions";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies optional native threading arguments require declared host support.
 *
 * A formatter's changed text proves command execution, but not that the host
 * received the threading option. The actual argv composer must retain both
 * knobs for a capable host and omit them for an unsupported host regardless of
 * a built-in-looking label.
 *
 * 1. Resolve an actual config without loading plugins or invoking a compiler.
 * 2. Compose check/fix/format argv under true, false and absent capabilities.
 * 3. Check full core payload, optional knobs, command precedence and immutability.
 * 4. Compose transform-host build/check commands, including build-only verbosity,
 *    output coordinates, selected-host context and provenance admission.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls actual createNativeCheckArgs and createNativeBuildArgs with the owned execution context. Exact argv assertions distinguish check-stage threading from transform-host command/modifier policies and selected-host context/provenance gates, while preserving full projected configs and input records. Actual composed verbs also drive the observation adapter: fix/format and undeclared check transport preserve the original callback result without flags, while opted-in checks retain same-invocation metadata and reject absent or malformed successful publications.
 * @evidence contracts/testing.md#independent-expectations The native protocol gates check-stage threading, gives format precedence over fix, and omits transform check-lane emit/verbosity modifiers. Authored complete plugin JSON, output/context coordinates, build/check arrays and provenance error literals specify the contract independently of the composers. Literal original write-result identity, check streams/status and independently authored complete/incomplete/malformed metadata prescribe adapter negotiation and rejection without an actual native producer.
 * @evidence contracts/testing.md#distinguishing-cases Existing check-stage capability/name/threading/command controls remain. Transform rows distinguish absent/true/false emit, quiet/verbose/omission, relative output, selected executable versus earlier linked capability, absent/false context support, and provenance absolute versus relative/URL/unsupported refusal. Input and option nonmutation remain asserted; Native strict-host acceptance is not exercised. Sidecar transport rows preserve failed and interrupted check outcomes, reject missing/malformed successful records, and distinguish a check-stage write verb from a real check.
 * @evidence contracts/testing.md#execution-ownership One source-unit entry obtains its execution context without plugins or compiler invocation, reads the actual lint factory capabilities and directly calls both composers with full ordinary DTOs and the observation adapter with authored callback results/private metadata bytes. No host, child, Program or evaluator is introduced; actual argv transport/native acceptance is separate.
 */
export function test_native_check_arguments_gate_threading_without_name_shortcuts(): void {
  const root = TestProject.physicalPath(
    TestProject.createProject({
      "tsconfig.json": JSON.stringify({
        compilerOptions: {},
        include: ["src"],
      }),
      "src/main.ts": "export const value = 1;\n",
      "lint.config.json": JSON.stringify({ rules: {} }),
    }),
  );
  const selected = BuildExecution.resolveExecutionContext({
    cwd: root,
    plugins: false,
    binary: process.execPath,
  });
  assert.equal(selected.pluginSetupFailure, undefined);
  const descriptorPath = path.join(
    TestProject.WORKSPACE_ROOT,
    "packages",
    "lint",
    "src",
    "createTtscPlugin.ts",
  );
  const factory = (
    createRequire(import.meta.url)(descriptorPath) as {
      default: typeof createLint;
    }
  ).default;
  const descriptor = factory({
    binary: "",
    cwd: root,
    dirname: path.dirname(descriptorPath),
    filename: descriptorPath,
    plugin: { transform: "@ttsc/lint" },
    projectRoot: root,
    tsconfig: path.join(root, "tsconfig.json"),
  });
  assert.equal(descriptor.capabilities?.threadingArgs, true);
  const plugin: ITtscLoadedNativePlugin = {
    binary: process.execPath,
    source: root,
    kind: "executable",
    name: "owner",
    stage: "check",
    config: { transform: "@unit/host", configFile: "native.config.json" },
    capabilities: descriptor.capabilities,
  };
  const execution = { ...selected, nativePlugins: [plugin] };
  const options = { format: true, singleThreaded: true, checkers: 2 };
  const before = structuredClone({ plugin, options });
  const baseline = NativePluginArguments.createNativeCheckArgs(
    execution,
    options,
    plugin,
  );
  const expectedBaseline = [
    "format",
    "--tsconfig=" + path.join(root, "tsconfig.json"),
    '--plugins-json=[{"config":{"transform":"@unit/host","configFile":"native.config.json"},"name":"owner","stage":"check"}]',
    "--cwd=" + root,
    "--project-context-json=" +
      JSON.stringify({
        invocationCwd: root,
        logicalConfigPath: path.join(root, "tsconfig.json"),
        logicalProjectRoot: root,
        physicalConfigPath: fs.realpathSync.native(
          path.join(root, "tsconfig.json"),
        ),
        physicalProjectRoot: fs.realpathSync.native(root),
      }),
    "--singleThreaded",
    "--checkers=2",
  ];
  const rows: readonly [
    string,
    TtscBuildOptions,
    ITtscLoadedNativePlugin,
    string,
    string[],
  ][] = [
    [
      "supported-both",
      options,
      plugin,
      "format",
      ["--singleThreaded", "--checkers=2"],
    ],
    [
      "renamed-supported",
      options,
      { ...plugin, name: "unrelated-third-party" },
      "format",
      ["--singleThreaded", "--checkers=2"],
    ],
    [
      "built-in-label-unsupported",
      options,
      { ...plugin, name: "@ttsc/lint", capabilities: { threadingArgs: false } },
      "format",
      [],
    ],
    [
      "absent-capability",
      options,
      { ...plugin, capabilities: {} },
      "format",
      [],
    ],
    [
      "absent-record",
      options,
      { ...plugin, capabilities: undefined },
      "format",
      [],
    ],
    [
      "single-only",
      { singleThreaded: true },
      plugin,
      "check",
      ["--singleThreaded"],
    ],
    ["checkers-only", { checkers: 2 }, plugin, "check", ["--checkers=2"]],
    ["explicit-false", { singleThreaded: false }, plugin, "check", []],
    ["no-options", {}, plugin, "check", []],
    [
      "fix",
      { fix: true, singleThreaded: true },
      plugin,
      "fix",
      ["--singleThreaded"],
    ],
    [
      "format-before-fix",
      { fix: true, format: true, checkers: 2 },
      plugin,
      "format",
      ["--checkers=2"],
    ],
  ];
  const originalResult = {
    diagnostics: [],
    status: 0,
    stdout: "write-result",
    stderr: "",
    processCompletedNormally: true,
  };
  for (const command of ["fix", "format"] as const) {
    const args = NativePluginArguments.createNativeCheckArgs(
      execution,
      command === "fix" ? { fix: true } : { format: true },
      plugin,
    );
    let calls = 0;
    const returned = runNativeCheckWithObservations(
      plugin,
      (extra) => {
        calls++;
        assert.deepEqual(
          extra,
          [],
          "a write verb must not negotiate check metadata",
        );
        return originalResult;
      },
      args[0],
    );
    assert.equal(calls, 1);
    assert.equal(
      returned,
      originalResult,
      "write streams/status retain the owning result",
    );
    assert.equal(
      "graph" in returned,
      false,
      "a write result does not gain a reusable check graph",
    );
  }
  const checkArgs = NativePluginArguments.createNativeCheckArgs(
    execution,
    {},
    plugin,
  );
  const disabled = runNativeCheckWithObservations(
    { capabilities: {} },
    (extra) => {
      assert.deepEqual(extra, []);
      return originalResult;
    },
    checkArgs[0],
  );
  assert.equal(disabled, originalResult);
  const checkResult = (status: number, malformed = false, complete = false) =>
    runNativeCheckWithObservations(
      plugin,
      (extra) => {
        assert.equal(extra.length, 1);
        const flag = extra[0];
        assert.ok(flag?.startsWith("--check-observations-json="));
        const file = flag.slice("--check-observations-json=".length);
        assert.ok(path.isAbsolute(file));
        fs.writeFileSync(
          file,
          malformed
            ? "{"
            : JSON.stringify({
                hostInputs: [],
                hostInputHashes: {},
                hostInputRealpaths: {},
                ...(complete
                  ? {
                      graph: {
                        edges: { "src/main.ts": [] },
                        inputObservations: {
                          "src/main.ts": { fileExists: true },
                        },
                      },
                    }
                  : { observationsComplete: false }),
              }),
        );
        return {
          ...originalResult,
          status,
          stdout: "check-result",
          stderr: status === 2 ? "authored failed check" : "",
        };
      },
      checkArgs[0],
    );
  for (const status of [0, 2]) {
    const result = checkResult(status);
    assert.equal(result.status, status);
    assert.equal(result.stdout, "check-result");
    assert.equal(result.stderr, status === 2 ? "authored failed check" : "");
    assert.equal(
      result.observationsComplete,
      false,
      "incomplete metadata is never promoted",
    );
  }
  const completeCheck = checkResult(0, false, true);
  assert.ok(
    completeCheck.graph,
    "the selected check retains its authored same-invocation graph",
  );
  assert.deepEqual(completeCheck.graph.edges["src/main.ts"], []);
  assert.equal(completeCheck.observationsComplete, undefined);
  assert.throws(
    () => checkResult(0, true),
    /invalid check observation metadata/,
  );
  assert.throws(
    () =>
      runNativeCheckWithObservations(
        plugin,
        () => originalResult,
        checkArgs[0],
      ),
    /check observation metadata is unavailable/,
  );
  const interrupted = runNativeCheckWithObservations(
    plugin,
    () => ({ ...originalResult, status: 2, processCompletedNormally: false }),
    checkArgs[0],
  );
  assert.equal(interrupted.status, 2);
  assert.equal(interrupted.observationsComplete, false);

  const actual = rows.map(([id, input, host]) => {
    const args = NativePluginArguments.createNativeCheckArgs(
      { ...selected, nativePlugins: [host] },
      input,
      host,
    );
    return {
      id,
      command: args[0],
      threading: args.filter(
        (arg) => arg === "--singleThreaded" || arg.startsWith("--checkers="),
      ),
    };
  });
  assert.deepEqual(
    actual,
    rows.map(([id, , , command, threading]) => ({ id, command, threading })),
  );
  assert.deepEqual(baseline, expectedBaseline);
  assert.deepEqual({ plugin, options }, before);
  const transform: ITtscLoadedNativePlugin = {
    ...plugin,
    stage: "transform",
    capabilities: {},
  };
  const linked: ITtscLoadedNativePlugin = {
    ...transform,
    name: "linked-before",
    kind: "linked",
    config: { transform: "@unit/linked", enabled: true },
    capabilities: { projectContextArgs: true, emitProvenance: true },
  };
  const plugins = [linked, transform];
  const projected =
    '--plugins-json=[{"config":{"transform":"@unit/linked","enabled":true},"name":"linked-before","stage":"transform"},{"config":{"transform":"@unit/host","configFile":"native.config.json"},"name":"owner","stage":"transform"}]';
  const core = [
    "--tsconfig=" + path.join(root, "tsconfig.json"),
    projected,
    "--cwd=" + root,
  ];
  const output = path.join(root, "private output");
  const buildRows: readonly [string, RunBuildOptions, string[]][] = [
    ["default-build", {}, ["build", ...core]],
    ["emit-without-verbosity", { emit: true }, ["build", ...core, "--emit"]],
    [
      "emit-quiet",
      { emit: true, quiet: true, outDir: "private output" },
      ["build", ...core, "--emit", "--outDir=" + output, "--quiet"],
    ],
    ["build-verbose", { quiet: false }, ["build", ...core, "--verbose"]],
    [
      "check-quiet-threading-omitted",
      { emit: false, quiet: true, singleThreaded: true, checkers: 2 },
      ["check", ...core],
    ],
    [
      "check-verbose-threading-omitted",
      { emit: false, quiet: false, singleThreaded: true, checkers: 2 },
      ["check", ...core],
    ],
    [
      "check-verbose-omitted",
      { emit: false, quiet: false, outDir: "private output" },
      ["check", ...core, "--outDir=" + output],
    ],
    [
      "build-threading-not-forwarded",
      { singleThreaded: true, checkers: 2 },
      ["build", ...core],
    ],
  ];
  const buildBefore = structuredClone({ plugins, buildRows });
  const executionBefore = JSON.stringify(selected);
  const failures: Error[] = [];
  const verify = (name: string, run: () => void): void => {
    try {
      run();
    } catch (cause) {
      failures.push(new Error(name, { cause }));
    }
  };
  for (const [name, input, expected] of buildRows)
    verify(name, () => {
      assert.deepEqual(
        NativePluginArguments.createNativeBuildArgs(selected, input, plugins),
        expected,
      );
    });
  for (const [name, capabilities] of [
    ["selected-context-opt-in", { projectContextArgs: true }],
    ["selected-context-false", { projectContextArgs: false }],
    ["selected-context-absent", undefined],
  ] as const)
    verify(name, () => {
      const selectedHost = { ...transform, capabilities };
      assert.deepEqual(
        NativePluginArguments.createNativeBuildArgs(selected, {}, [
          linked,
          selectedHost,
        ]),
        capabilities?.projectContextArgs === true
          ? ["build", ...core, expectedBaseline[4]!]
          : ["build", ...core],
      );
    });
  const provenance = path.join(root, "proof.json");
  const supported = {
    ...transform,
    capabilities: { emitProvenance: true, projectContextArgs: true },
  };
  verify("absolute provenance and context", () =>
    assert.deepEqual(
      NativePluginArguments.createNativeBuildArgs(
        selected,
        { emit: true },
        [linked, supported],
        provenance,
      ),
      [
        "build",
        ...core,
        "--emit-provenance-json=" + provenance,
        expectedBaseline[4]!,
        "--emit",
      ],
    ),
  );
  for (const invalid of [
    "relative-proof.json",
    "file:///proof.json",
    "https://example.com/proof.json",
  ])
    verify(`invalid provenance ${invalid}`, () =>
      assert.throws(
        () =>
          NativePluginArguments.createNativeBuildArgs(
            selected,
            {},
            [linked, supported],
            invalid,
          ),
        {
          message:
            "ttsc: emit provenance destination must be an absolute native path",
        },
      ),
    );
  for (const capabilities of [undefined, { emitProvenance: false }] as const)
    verify("unsupported selected provenance", () =>
      assert.throws(
        () =>
          NativePluginArguments.createNativeBuildArgs(
            selected,
            {},
            [linked, { ...transform, capabilities }],
            provenance,
          ),
        {
          message:
            "ttsc: native compiler host does not support emit provenance",
        },
      ),
    );
  verify("build inputs unchanged", () =>
    assert.deepEqual({ plugins, buildRows }, buildBefore),
  );
  verify("execution unchanged", () =>
    assert.equal(JSON.stringify(selected), executionBefore),
  );
  if (failures.length !== 0)
    throw new AggregateError(failures, "Native build argument policy failures");
}

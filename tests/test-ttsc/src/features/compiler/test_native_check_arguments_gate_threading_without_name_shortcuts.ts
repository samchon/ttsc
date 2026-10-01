import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import type createLint from "../../../../../packages/lint/src/createTtscPlugin";
import { TestProject } from "../../../../utils/src/TestProject";
import { BuildExecution } from "../../../../../packages/ttsc/src/compiler/internal/build/BuildExecution";
import { NativePluginArguments } from "../../../../../packages/ttsc/src/compiler/internal/build/NativePluginArguments";
import type { ITtscLoadedNativePlugin } from "../../../../../packages/ttsc/src/structures/internal/ITtscLoadedNativePlugin";
import type { TtscBuildOptions } from "../../../../../packages/ttsc/src/structures/internal/TtscBuildOptions";

/**
 * Verifies optional native threading arguments require declared host support.
 *
 * A formatter's changed text proves command execution, but not that the host
 * received the threading option. The actual argv composer must retain both
 * knobs for a capable host and omit them for an unsupported host regardless
 * of a built-in-looking label.
 *
 * 1. Resolve an actual config without loading plugins or invoking a compiler.
 * 2. Compose check/fix/format argv under true, false and absent capabilities.
 * 3. Check full core payload, optional knobs, command precedence and immutability.
 *
 * @evidence contracts/testing.md#behavioral-verification Reads the real authored lint factory declaration, then calls actual createNativeCheckArgs for capability/name/option controls and asserts exact command/threading rows, full baseline argv and unchanged input options/plugin records.
 * @evidence contracts/testing.md#independent-expectations The native protocol requires --singleThreaded and --checkers=2 only when threadingArgs is true, and format precedes fix. Literal projected plugin JSON and explicit fixture paths independently establish the baseline payload.
 * @evidence contracts/testing.md#distinguishing-cases Rows cover threadingArgs true, true under a renamed plugin, false under the built-in-looking name @ttsc/lint, an empty capability record and an absent record; singleThreaded alone, checkers alone, both, explicit false and neither; check, fix and format commands, and format winning when fix and format are both set. Whether a real host accepts the flags is not exercised.
 * @evidence contracts/testing.md#execution-ownership A unit test: it builds a throwaway config project, resolves the execution context with plugins disabled and process.execPath as an unused binary path, loads the lint package's descriptor factory to read its declared capabilities, and calls NativePluginArguments.createNativeCheckArgs; no compiler or native host is started.
 */
export function test_native_check_arguments_gate_threading_without_name_shortcuts(): void {
  const root = TestProject.physicalPath(TestProject.createProject({
    "tsconfig.json": JSON.stringify({ compilerOptions: {}, include: ["src"] }),
    "src/main.ts": "export const value = 1;\n",
    "lint.config.json": JSON.stringify({ rules: {} }),
  }));
  const selected = BuildExecution.resolveExecutionContext({ cwd: root, plugins: false, binary: process.execPath });
  assert.equal(selected.pluginSetupFailure, undefined);
  const descriptorPath = path.join(TestProject.WORKSPACE_ROOT, "packages", "lint", "src", "createTtscPlugin.ts");
  const factory = (createRequire(import.meta.url)(descriptorPath) as { default: typeof createLint }).default;
  const descriptor = factory({
    binary: "", cwd: root, dirname: path.dirname(descriptorPath), filename: descriptorPath,
    plugin: { transform: "@ttsc/lint" }, projectRoot: root, tsconfig: path.join(root, "tsconfig.json"),
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
  const baseline = NativePluginArguments.createNativeCheckArgs(execution, options, plugin);
  const expectedBaseline = [
    "format",
    "--tsconfig=" + path.join(root, "tsconfig.json"),
    '--plugins-json=[{"config":{"transform":"@unit/host","configFile":"native.config.json"},"name":"owner","stage":"check"}]',
    "--cwd=" + root,
    "--project-context-json=" + JSON.stringify({
      invocationCwd: root,
      logicalConfigPath: path.join(root, "tsconfig.json"),
      logicalProjectRoot: root,
      physicalConfigPath: fs.realpathSync.native(path.join(root, "tsconfig.json")),
      physicalProjectRoot: fs.realpathSync.native(root),
    }),
    "--singleThreaded",
    "--checkers=2",
  ];
  const rows: readonly [string, TtscBuildOptions, ITtscLoadedNativePlugin, string, string[]][] = [
    ["supported-both", options, plugin, "format", ["--singleThreaded", "--checkers=2"]],
    ["renamed-supported", options, { ...plugin, name: "unrelated-third-party" }, "format", ["--singleThreaded", "--checkers=2"]],
    ["built-in-label-unsupported", options, { ...plugin, name: "@ttsc/lint", capabilities: { threadingArgs: false } }, "format", []],
    ["absent-capability", options, { ...plugin, capabilities: {} }, "format", []],
    ["absent-record", options, { ...plugin, capabilities: undefined }, "format", []],
    ["single-only", { singleThreaded: true }, plugin, "check", ["--singleThreaded"]],
    ["checkers-only", { checkers: 2 }, plugin, "check", ["--checkers=2"]],
    ["explicit-false", { singleThreaded: false }, plugin, "check", []],
    ["no-options", {}, plugin, "check", []],
    ["fix", { fix: true, singleThreaded: true }, plugin, "fix", ["--singleThreaded"]],
    ["format-before-fix", { fix: true, format: true, checkers: 2 }, plugin, "format", ["--checkers=2"]],
  ];
  const actual = rows.map(([id, input, host]) => {
    const args = NativePluginArguments.createNativeCheckArgs({ ...selected, nativePlugins: [host] }, input, host);
    return { id, command: args[0], threading: args.filter((arg) => arg === "--singleThreaded" || arg.startsWith("--checkers=")) };
  });
  assert.deepEqual(actual, rows.map(([id, , , command, threading]) => ({ id, command, threading })));
  assert.deepEqual(baseline, expectedBaseline);
  assert.deepEqual({ plugin, options }, before);
}

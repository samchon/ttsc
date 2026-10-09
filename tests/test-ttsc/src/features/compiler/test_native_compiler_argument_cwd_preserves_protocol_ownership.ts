import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { BuildExecution } from "../../../../../packages/ttsc/src/compiler/internal/build/BuildExecution";
import { NativePluginArguments } from "../../../../../packages/ttsc/src/compiler/internal/build/NativePluginArguments";
import { TsgoArguments } from "../../../../../packages/ttsc/src/compiler/internal/build/TsgoArguments";
import { CompilerProjectSelection } from "../../../../../packages/ttsc/src/compiler/internal/project/CompilerProjectSelection";
import { clearInheritedTsgoArgs } from "../../../../../packages/ttsc/src/compiler/internal/sharedHost/clearInheritedTsgoArgs";
import { SidecarEnvironment } from "../../../../../packages/ttsc/src/compiler/internal/sharedHost/SidecarEnvironment";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies paired compiler argv/cwd transport and selected native host context.
 *
 * 1. Resolve an actual response-selected B context from an A argument frame.
 * 2. Compose host environments and commands without launching their binaries.
 * 3. Assert selected authority, protocol negotiation and live phase argv.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual resolveExecutionContext, composeNativePluginEnv and native/direct argv composers expose B project identity with A compiler argument base, clear unrelated channels and preserve the current phase payload.
 * @evidence contracts/testing.md#independent-expectations Authored A/B configs and literal response/JSON payloads independently establish B Program authority, A relative argument base and exact inherited/caller ownership outcomes.
 * @evidence contracts/testing.md#distinguishing-cases Declared versus legacy capability, same cwd, absent and empty payload, caller-preserved paired channels, Windows-equivalent environment spelling, changed phase arguments, unsafe scalar tails and response generation changes distinguish all publication branches.
 * @evidence contracts/testing.md#execution-ownership This source unit reads a tracked temporary fixture and uses the current Node executable only as an existing identity. Plugins are explicitly disabled during context acquisition; pure composers start no native process, watch, build or installation.
 */
export function test_native_compiler_argument_cwd_preserves_protocol_ownership(): void {
  const root = TestProject.physicalPath(
    TestProject.tmpdir("ttsc-compiler-argument-cwd-"),
  );
  const a = path.join(root, "A");
  const b = path.join(root, "B");
  for (const directory of [a, b]) {
    fs.mkdirSync(directory);
    fs.writeFileSync(path.join(directory, "tsconfig.json"), '{"files":[]}');
  }
  const response = path.join(a, "args.rsp");
  fs.writeFileSync(response, "--project ../B/tsconfig.json --outDir products");
  const options = {
    cwd: a,
    tsconfig: "tsconfig.json",
    passthrough: ["@args.rsp"],
    binary: process.execPath,
    plugins: false as const,
  };
  const execution = BuildExecution.resolveExecutionContext(options);
  assert.equal(execution.projectRoot, b);
  assert.equal(execution.compilerSelection.compilerArgsCwd, a);
  const plugin = {
    binary: process.execPath,
    source: "/authored/source",
    config: {},
    kind: "executable" as const,
    stage: "check" as const,
    capabilities: { compilerArgsCwd: true as const },
  };
  const compose = (payload?: string, capable = true) =>
    BuildExecution.composeNativePluginEnv(
      { TTSC_TSGO_ARGS: '["--strict"]', TTSC_TSGO_ARGS_CWD: "/outer" },
      undefined,
      execution,
      process.execPath,
      capable ? plugin : { ...plugin, capabilities: undefined },
      payload,
    );
  const env = compose('["@args.rsp"]');
  assert.equal(env.TTSC_TSGO_ARGS, '["@args.rsp"]');
  assert.equal(env.TTSC_TSGO_ARGS_CWD, a);
  const args = NativePluginArguments.createNativeCheckArgs(execution, options, plugin);
  assert.ok(args.includes("--cwd=" + b));
  assert.ok(args.includes("--tsconfig=" + path.join(b, "tsconfig.json")));
  assert.throws(() => compose('["@args.rsp"]', false), /separate compiler argument cwd/);
  assert.equal(compose("[]", false).TTSC_TSGO_ARGS_CWD, undefined);
  assert.equal(compose(undefined, false).TTSC_TSGO_ARGS, undefined);
  assert.equal(compose(undefined, false).TTSC_TSGO_ARGS_CWD, undefined);
  const same = {
    ...execution,
    compilerSelection: { ...execution.compilerSelection, compilerArgsCwd: b },
  };
  const legacy = BuildExecution.composeNativePluginEnv(
    {}, undefined, same, process.execPath,
    { ...plugin, capabilities: undefined }, '["--strict"]',
  );
  assert.equal(legacy.TTSC_TSGO_ARGS, '["--strict"]');
  assert.equal(legacy.TTSC_TSGO_ARGS_CWD, undefined);
  const caller = { TTSC_TSGO_ARGS: "[]", TTSC_TSGO_ARGS_CWD: a };
  const retained = { ...caller };
  clearInheritedTsgoArgs(retained, caller);
  assert.deepEqual(retained, caller);
  const aliases = SidecarEnvironment.merge({
    TTSC_TSGO_ARGS_CWD: "/outer", ttsc_tsgo_args_cwd: "/other",
  });
  clearInheritedTsgoArgs(aliases, undefined);
  assert.equal(SidecarEnvironment.read(aliases, "TTSC_TSGO_ARGS_CWD"), undefined);
  assert.equal(aliases.ttsc_tsgo_args_cwd, process.platform === "win32" ? undefined : "/other");
  const live = TsgoArguments.createTsgoBuildArgs(
    execution, { ...options, passthrough: ["@args.rsp", "--strict"] },
    { listEmittedFiles: false },
  );
  assert.ok(live.includes("--strict"));
  assert.deepEqual(live.slice(-2), ["-p", execution.tsconfig]);
  assert.deepEqual(
    CompilerProjectSelection.readGuard(execution.compilerSelection, ["--outDir"]), [],
  );
  fs.writeFileSync(response, "--project tsconfig.json");
  assert.throws(() => compose('["@args.rsp"]'), /changed after project selection/);
}

import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { BatchWorkspace } from "../batch/BatchWorkspace";
import { assertRuntimeCliCorpus } from "../batch/runtimeCliCorpus";
import { assertRuntimeNodeCorpus } from "../batch/runtimeNodeCorpus";

/**
 * Verifies one public runtime loads the shared transformed graph.
 *
 * Native string decoding, resolved JSON and unchanged neighboring values reach
 * one real ttsx entry. Unremoved configured discard calls throw, so successful
 * values cannot hide missing stripping. Every value belongs to this one graph.
 *
 * 1. Capture the source/config bytes and invoke the public ttsx entry once.
 * 2. Compare its one actual JSON payload against all original literal rows.
 * 3. Require source/config preservation and absent adjacent JavaScript output.
 *
 * @evidence contracts/testing.md#behavioral-verification The real ttsx process must return status0 and exactly one full labeled payload with contract42, copied JSON42/retained and all661 native JSX string values. Configured discard.call would throw if the actual strip transform were missing.
 * @evidence contracts/testing.md#independent-expectations The source's authored42/retained values and pre-print UTF-16 rows establish expectations, not the runtime's own output. Exact original input bytes establish nonmutation.
 * @evidence contracts/testing.md#distinguishing-cases Quoted/expression/ordinary JSX strings, JSON alias versus unchanged neighbor and configured throwing call versus retained console.info share the same module graph.
 * @evidence contracts/testing.md#execution-ownership This selected function invokes TestProject.spawn exactly once. Every remaining operation reads bytes or compares literal values; it invokes no legacy test or profile launcher.
 * @evidence contracts/e2e.md#necessary-boundary Public ttsx connects native transforms, source publication and actual Node loading. Go rule units cannot establish the loaded graph's observed values or source preservation.
 * @evidence contracts/e2e.md#shared-execution One unchanged consumer and one runtime process carry all independent value cases, using the same producer/tool inputs as the other boundary sessions.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Native errors are outside the positive tsconfig population. The source/config stay immutable and synchronous process error/signal/null status fails; unknown closure retains the common input owner.
 * @evidence contracts/e2e.md#preserved-coverage Keeps the native factory value matrix and combined utility alias/strip/runtime observations in one real loaded graph. The original ESNext member-initialization effects run in both .mts/.cts modules in the same upfront Program; the contrary module-package .cts value is loaded alongside the .mts public entry. Source dirname, imported class root and both asset reads preserve their independent physical identities. This does not separately certify a CTS CLI argv lane or other lifecycle/configuration transitions.
 */
export async function test_e2e_runtime_batch(): Promise<void> {
  const workspace = await BatchWorkspace.open();
  const config = fs.readFileSync(path.join(workspace.root, "tsconfig.json"));
  const source = fs.readFileSync(path.join(workspace.root, "src/runtime.mts"));
  const baseline = fs.readdirSync(workspace.root).filter((name) => name !== "node_modules" && name !== "program-runs.bin").sort();
  let result: ReturnType<typeof TestProject.spawn>;
  const base = path.join(workspace.root, "runtime-base.json");
  const selected = workspace.installationOnly ? [] : [
    "-P", "runtime-owned.json", "--rootDir", ".",
    "--outDir", "distx", "--declaration", "--declarationDir", "typesx",
    "--incremental", "--tsBuildInfoFile", "state/run.tsbuildinfo", "--outFile", "bundle.js",
    "--noEmit", "--emitDeclarationOnly", "--target", "es2019", "@runtime-args.txt",
  ];
  if (!workspace.installationOnly) fs.renameSync(path.join(workspace.root, "tsconfig.json"), base);
  try {
    result = TestProject.spawn(process.execPath, [workspace.installedTtsx, ...selected, workspace.installationOnly ? "src/installation-runtime.ts" : "src/runtime.mts", ...(workspace.installationOnly ? [] : ["--config", "x", "--port", "3", "--help"])], {
      cwd: workspace.root,
      env: { TTSC_CACHE_DIR: workspace.cache, TTSC_BINARY: undefined, TTSC_TSGO_BINARY: undefined },
    });
  } finally {
    if (!workspace.installationOnly) fs.renameSync(base, path.join(workspace.root, "tsconfig.json"));
  }
  assert.deepEqual(fs.readdirSync(workspace.root).filter((name) => name !== "node_modules" && name !== "program-runs.bin").sort(), baseline);
  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, result.stderr);
  const payload = BatchWorkspace.readPayload(result.stdout);
  if (workspace.installationOnly) {
    assert.equal((payload as { answer: unknown }).answer, 42);
    BatchWorkspace.assertValues((payload as { values: unknown }).values, workspace.expected);
  } else {
  BatchWorkspace.assertResult(payload, workspace.expected);
  assertRuntimeCliCorpus((payload as { cliPolicyRuntime: unknown }).cliPolicyRuntime);
  assertRuntimeNodeCorpus((payload as { nodeCompatible: unknown }).nodeCompatible);
  assert.deepEqual((payload as { requireBindings: unknown }).requireBindings, ["@lib/message", "local:@lib/message", "imported:@lib/message", "ok", "ok"]);
  const mixed = (payload as { mixedRuntime: unknown }).mixedRuntime;
  assert.deepEqual(mixed, {
    contraryCommonjs: "cts-runner-ok",
    mtsImport: "mts-runner-ok",
    standardEsm: "Hello Class Foo\nHello Function getBar\nabc",
    standardCommonjs: "Hello Class Foo\nHello Function getBar\nabc",
    memberEsm: "11 method\nstatic:run,class:Foo,field:#value,accessor:count",
    memberCommonjs: "11 method\nstatic:run,class:Foo,field:#value,accessor:count",
    adapterFactories: ["function", "function", "function", "function"],
    answers: [42, 42],
    proposalValue: 42,
    startupMarkers: ["ran", "entry-ran", "ENTRY", "explicit-runner-project"],
    mainMessage: "main:value",
    optionalChainPreserved: true,
  });
  const locations = (payload as { sourceLocations: { marker: string; template: string; directory: string; classRoot: string } }).sourceLocations;
  assert.equal(locations.marker, "source-relative-dirname");
  assert.equal(locations.template, "dirname-preserved");
  assert.equal(fs.realpathSync.native(locations.directory), fs.realpathSync.native(path.join(workspace.root, "src")));
  assert.equal(fs.realpathSync.native(locations.classRoot), fs.realpathSync.native(workspace.root));
  const helpers = (payload as { publicHelpers: unknown }).publicHelpers;
  assert.deepEqual(helpers, { memoryFile: "export const value = 1;\n", decoded: { value: 1 }, scoped: "@scope/package", builtin: null });
  }
  assert.deepEqual(fs.readFileSync(path.join(workspace.root, "tsconfig.json")), config);
  assert.deepEqual(fs.readFileSync(path.join(workspace.root, "src/runtime.mts")), source);
  assert.equal(fs.existsSync(path.join(workspace.root, "src/runtime.mjs")), false);
}









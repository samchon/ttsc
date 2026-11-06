import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { BuildExecution } from "../../../../../packages/ttsc/src/compiler/internal/build/BuildExecution";
import { RuntimeBuildCache } from "../../../../../packages/ttsc/src/compiler/internal/build/RuntimeBuildCache";
import { RuntimeBuildInputs } from "../../../../../packages/ttsc/src/compiler/internal/build/RuntimeBuildInputs";
import type { TtscBuildResult } from "../../../../../packages/ttsc/src/structures/internal/TtscBuildResult";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies discovery-cache temperature cannot discard a completed descriptor's
 * input proof or turn missing and contradictory witnesses into valid reuse.
 *
 * 1. Record a fresh result with one real descriptor input and restore it when
 *    current discovery needs no additional input.
 * 2. Edit only the retained descriptor input while keeping the execution key.
 * 3. Refuse missing content, missing physical proof and conflicting claims.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual generation recording, cache restoration and admission replay native file bytes and physical paths. Producer counts prove discovery-only differences reuse while an input edit rebuilds; incomplete current descriptor proof must prevent lookup eligibility and contradictory retained proof must fail admission.
 * @evidence contracts/testing.md#independent-expectations Literal authored 7/8 values, direct native SHA-256/realpath and expected producer counts define the oracle. The fixed execution snapshot models equivalent resolved native execution independently of cache metadata.
 * @evidence contracts/testing.md#distinguishing-cases Cold extra reads versus warm empty discovery, changed retained input, unavailable content, unavailable physical identity and conflicting claims distinguish population variability from lost proof. A forwarded configuration takes its valid proof from the consuming native result; missing native proof still refuses reuse. The Runtime E2E separately exercises actual typed lint discovery and native execution.
 * @evidence contracts/testing.md#execution-ownership The named source unit calls actual proof/cache owners over an existing dependency installation and owned TestProject files. Context resolution launches no compiler, installer or host; the supplied producer writes literal output, and TestProject owns root cleanup.
 */
export function test_runtime_descriptor_proof_survives_discovery_cache_changes(): void {
  const root = TestProject.physicalPath(
    TestProject.createProject({
      "package.json": '{"private":true}',
      "tsconfig.json": '{"compilerOptions":{},"include":["src"]}',
      "src/main.ts": "export const value = 7;",
      "descriptor-input.json": "7",
    }),
  );
  fs.symlinkSync(
    TestProject.physicalPath(
      path.join(TestProject.WORKSPACE_ROOT, "node_modules"),
    ),
    path.join(root, "node_modules"),
    "junction",
  );
  const selected = BuildExecution.resolveExecutionContext({
    cwd: root,
    plugins: false,
    env: { TTSC_TSGO_BINARY: undefined },
  });
  const input = path.join(root, "descriptor-input.json");
  const hash = () =>
    crypto.createHash("sha256").update(fs.readFileSync(input)).digest("hex");
  const emitDir = path.join(root, "proof-output");
  fs.mkdirSync(emitDir);
  const result: TtscBuildResult = {
    status: 0,
    stdout: "",
    stderr: "",
    diagnostics: [],
    emittedSources: {
      [path.join(emitDir, "main.js")]: [path.join(root, "src/main.ts")],
    },
  };
  const factory = (
    observed: boolean,
    missing?: "hash" | "physical",
    deferred = false,
  ) =>
    RuntimeBuildInputs.create(
      {
        emit: true,
        isolateOutputsTo: emitDir,
        runtimeCacheDir: path.join(root, "runtime-builds"),
      },
      {
        ...selected,
        pluginLoad: {
          project: selected.project,
          nativePlugins: [],
          pluginSources: {},
          deferredHostInputs: deferred ? [input] : [],
          discoveryInputsComplete: true,
          descriptorReadsDeclared: true,
          hostInputs: observed ? [input] : [],
          hostInputHashes:
            observed && !deferred && missing !== "hash"
              ? { [input]: hash() }
              : {},
          hostInputRealpaths:
            observed && !deferred && missing !== "physical"
              ? { [input]: fs.realpathSync.native(input) }
              : {},
        },
      },
    )!;
  const cold = factory(true);
  const warm = factory(false);
  let builds = 0;
  const run = (name: string, proof: typeof cold) => {
    const directory = path.join(root, name);
    fs.mkdirSync(directory);
    RuntimeBuildCache.run({
      directory: path.join(root, "cache"),
      emitDir: directory,
      capture: () => "same resolved execution",
      admit: proof.admit,
      build: () => {
        builds++;
        const output = path.join(directory, "main.js");
        fs.writeFileSync(
          output,
          `exports.value = ${fs.readFileSync(input, "utf8")};`,
        );
        return proof.record({
          ...result,
          emittedSources: { [output]: [path.join(root, "src/main.ts")] },
        });
      },
    });
    return fs.readFileSync(path.join(directory, "main.js"), "utf8");
  };
  assert.equal(run("cold", cold), "exports.value = 7;");
  assert.equal(run("warm", warm), "exports.value = 7;");
  assert.equal(builds, 1);
  fs.writeFileSync(input, "8");
  assert.equal(run("changed", factory(true)), "exports.value = 8;");
  assert.equal(builds, 2);
  for (const missing of ["hash", "physical"] as const) {
    assert.equal(factory(true, missing), undefined, missing);
  }
  const current = factory(true);
  const conflicting = current.record({
    ...result,
    hostInputs: [input],
    hostInputHashes: { [input]: "0".repeat(64) },
    hostInputRealpaths: { [input]: fs.realpathSync.native(input) },
  });
  assert.equal(current.admit(conflicting, emitDir), false);
  assert.equal(Object.hasOwn(conflicting.hostInputHashes!, input), false);
  const forwarded = factory(true, undefined, true);
  const native = {
    ...result,
    hostInputs: [input],
    hostInputHashes: { [input]: hash() },
    hostInputRealpaths: { [input]: fs.realpathSync.native(input) },
  };
  assert.equal(forwarded.admit(forwarded.record(native), emitDir), true);
  assert.equal(
    forwarded.admit(
      forwarded.record({ ...native, hostInputHashes: {} }),
      emitDir,
    ),
    false,
  );
}

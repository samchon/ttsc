import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { E2eProcessTrace } from "../../../../../utils/src/E2eProcessTrace";

/**
 * Observes public-hook resolution and completeness in the same actual child.
 * The historical donor's inverse-capability wrapper expectation is superseded
 * by the maintained contract: no private replacement, and incomplete authority
 * when require.resolve cannot be observed through the public hook.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs maintained recorder.cjs in an actual Node child; observes successful present resolution, missing resolution refusal, private-slot identity and recorder completeness. A complete observation must retain the present hash and own missing null input.
 * @evidence contracts/testing.md#independent-expectations An independently installed public hook counts actual require.resolve calls before the recorder is installed and is deregistered in finally. Literal present bytes/missing candidate and unchanged private function identity establish the expectations. This is runtime hook behavior for the same root, not a general native classifier oracle.
 * @evidence contracts/testing.md#distinguishing-cases Same present/missing input pair is retained on both capability outcomes. Observed hook support requires complete hashes; unavailable support requires explicit incomplete authority, never false successful hash coverage or a private wrapper.
 * @evidence contracts/testing.md#execution-ownership Authored internal survivor profile for the approved runtime family, not currently registered or executed. The test-e2e family callback will invoke this operation after the legacy baseline; original donor remains selected until actual survivor evidence permits removal.
 * @evidence contracts/e2e.md#necessary-boundary Actual Node public hook dispatch and maintained recorder share a child/module process. A synthetic hook result or isolated recorder data unit cannot establish the runtime dispatch/completeness connection.
 * @evidence contracts/e2e.md#shared-execution One actual child observes independent public-hook dispatch and recorder behavior sequentially; the probe deregisters before recorder installation. No parent capability child, compiler build or consumer install is added here; family producer preparation is separate.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Fresh tracked allocation contains original present bytes and absent later.js; it is retained before physical spelling. Synchronous result requires no error, no signal and status0, not arbitrary descendant join. Child termination owns its public-hook lifetime and private slots are never patched.
 * @evidence contracts/e2e.md#preserved-coverage Original present hash typeof string and missing own null hash are preserved whenever observation is complete. Present resolution and MODULE_NOT_FOUND remain independently asserted even when observation is incomplete. Private-slot nonreplacement supersedes only the unsupported inverse-capability historical premise; donor inputs/assertions remain intact until actual survivor proof. AUTHORED/UNEXECUTED, no runtime or registration certification.
 */
export function runSupportedResolutionRecorderProfile(): void {
  const allocatedRoot = TestProject.tmpdir("ttsc-recorder-require-resolve-");
  TestProject.retainTemporaryDirectory(allocatedRoot, "Resolution observer descendants are not joined");
  const root = fs.realpathSync.native(allocatedRoot);
  const present = path.join(root, "present.js");
  const missing = path.join(root, "later.js");
  fs.writeFileSync(present, "module.exports = 1;\n");
  assert.equal(fs.existsSync(missing), false);
  const recorderPath = path.resolve(import.meta.dirname, "../../../../../../packages/ttsc/driver/resolutioninputs/recorder.cjs");
  const script = [
    `const Module = require("node:module");`,
    `const path = require("node:path");`,
    `const { createResolutionInputRecorder, observeResolutions } = require(${JSON.stringify(recorderPath)});`,
    `const resolve = Module.createRequire(path.join(${JSON.stringify(root)}, "config.js")).resolve;`,
    `const before = Module._resolveFilename;`,
    `let consulted = false;`,
    `let probe;`,
    `try {`,
    `  if (typeof Module.registerHooks === "function") probe = Module.registerHooks({ resolve(specifier, context, nextResolve) { if (specifier !== "./ttsc-public-hook-probe") return nextResolve(specifier, context); consulted = true; return { shortCircuit: true, url: require("node:url").pathToFileURL(${JSON.stringify(present)}).href }; } });`,
    `  try { resolve("./ttsc-public-hook-probe"); } catch (error) { if (error.code !== "MODULE_NOT_FOUND") throw error; }`,
    `} finally { probe?.deregister(); }`,
    `const recorder = createResolutionInputRecorder({ extensions: [".js", ".json"] });`,
    `observeResolutions(recorder);`,
    `const wrapped = Module._resolveFilename !== before;`,
    `const resolved = resolve("./present.js");`,
    `let missingCode;`,
    `try { resolve("./later.js"); } catch (error) { missingCode = error.code; }`,
    `const { hashes, complete } = recorder.finish();`,
    `process.stdout.write(JSON.stringify({ hashes, complete, consulted, wrapped, resolved, missingCode }));`,
  ].join("\n");
  const result = E2eProcessTrace.spawnSync(process.execPath, ["-e", script], { cwd: root, encoding: "utf8" });
  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  assert.equal(result.status, 0, result.stderr);
  const observed = JSON.parse(result.stdout) as {
    hashes: Record<string, string | null>;
    complete: boolean;
    consulted: boolean;
    wrapped: boolean;
    resolved: string;
    missingCode?: string;
  };
  assert.equal(typeof observed.consulted, "boolean");
  assert.equal(typeof observed.complete, "boolean");
  assert.equal(observed.wrapped, false);
  assert.equal(observed.resolved, present);
  assert.equal(observed.missingCode, "MODULE_NOT_FOUND");
  assert.equal(observed.complete, observed.consulted);
  if (observed.complete) {
    assert.equal(typeof observed.hashes[present], "string");
    assert.ok(Object.prototype.hasOwnProperty.call(observed.hashes, missing));
    assert.equal(observed.hashes[missing], null);
  }
}

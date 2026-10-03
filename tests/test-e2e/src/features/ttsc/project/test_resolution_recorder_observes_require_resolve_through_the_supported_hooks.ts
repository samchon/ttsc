import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import nodeChildProcessForTrace from "node:child_process";
import { E2eProcessTrace } from "../../../../../utils/src/E2eProcessTrace";
const child_process = { ...nodeChildProcessForTrace, ...E2eProcessTrace };
import fs from "node:fs";
import path from "node:path";

import { RuntimeLoaderCapabilities } from "../../../../../../packages/ttsc/lib/launcher/internal/runtime/RuntimeLoaderCapabilities.js";

/**
 * Verifies the shared resolution recorder records a `require.resolve` a config
 * makes, wrapping no private loader slot where the hooks already see it.
 *
 * The banner and strip config loaders each replaced `Module._resolveFilename`
 * to record resolutions a resolve hook missed (samchon/ttsc#1523). A resolve
 * hook sees every `import` and `require()`; only `require.resolve` bypasses it,
 * and only on some releases. The maintained recorder uses the public hook and
 * marks observations incomplete when its capability probe cannot establish
 * that `require.resolve` consults it. This historical test still expects a
 * private wrapper on that branch; the supported survivor is recorded below.
 *
 * 1. In a child process, create a recorder and let it observe resolutions.
 * 2. Resolve a present file and a missing candidate through `require.resolve`.
 * 3. Assert the present file is an input with its content, the missing one an
 *    input proven absent, and the resolver was wrapped exactly where
 *    `require.resolve` does not consult the hooks.
 *
 * @evidenceExclude contracts/testing.md#behavioral-verification Historical private-wrapper expectation conflicts with current public-hook/incomplete-observation contract when the capability is false. Original present/missing and wrapper assertions remain, but no completed supported behavioral verification is certified on that branch.
 * @evidenceExclude contracts/testing.md#independent-expectations Authored present/missing bytes are independent inputs, but the inverse parent capability is not a supported private-wrapper expectation. Parent and child probe anchors differ, and the original returned payload omits completeness; no unknown observation is certified as capability success.
 * @evidence contracts/testing.md#distinguishing-cases 1. In a child process, create a recorder and let it observe resolutions. 2. Resolve a present file and a missing candidate through `require.resolve`. 3. Assert the present file is an input with its content, the missing one an input proven absent, and the resolver was wrapped exactly where `require.resolve` does not consult the hooks.
 * @evidence contracts/testing.md#execution-ownership The test-e2e runner starts an actual Node child loading maintained recorder.cjs and separately calls the parent built capability owner. Original child-owned hooks end with the child; supported body runSupportedResolutionRecorderProfile observes completeness and private-slot nonreplacement in the same child. It is authored but not registered or executed, not certified by source existence.
 * @evidence contracts/e2e.md#necessary-boundary The actual child or host operation exercises the transport and execution result named in this case; direct in-process decision helpers cannot establish that process outcome.
 * @evidence contracts/e2e.md#shared-execution One actual child resolver interval and separate parent capability probe share the selected runtime and authored fixture. They are not one total process, compiler/Go preparation, cache-hit proof or a false-capability branch execution certificate.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Exact tracked allocation is retained before the physical root spelling is taken. Child sync success checks error/signal separately; returned output is not arbitrary descendant join. Source public hooks leave private slots unchanged; historical inverse-capability premise is superseded by private-slot nonreplacement in the supported survivor; original donor assertion remains until actual survival evidence.
 * @evidence contracts/e2e.md#preserved-coverage Original present hash typeof string, missing own null hash and inverse-parent-capability wrapper assertion remain. Original payload has no completeness and no exact digest assertion. Unsupported historical premise is disclosed, not erased through skip/API/false success; Supported owner is src/internal/ttsc/internal/runSupportedResolutionRecorderProfile.ts::runSupportedResolutionRecorderProfile: same-child independent public-hook observation, complete/incomplete authority and private-slot nonreplacement. Original present/missing recorder assertions apply only to complete authority, with successful present resolution/missing refusal always observed. Unsupported private-wrapper premise is explicitly superseded, not deleted from the donor. Body AUTHORED, registration/runtime/survival pending and donor retained.
 */
export const test_resolution_recorder_observes_require_resolve_through_the_supported_hooks =
  () => {
    const allocatedRoot = TestProject.tmpdir("ttsc-recorder-require-resolve-");
    TestProject.retainTemporaryDirectory(allocatedRoot, "Resolution observer descendants are not joined");
    const root = fs.realpathSync.native(allocatedRoot);
    fs.writeFileSync(path.join(root, "present.js"), "module.exports = 1;\n");
    const recorder = path.resolve(
      import.meta.dirname,
      "../../../../../../packages/ttsc/driver/resolutioninputs/recorder.cjs",
    );
    const script = [
      `const Module = require("node:module");`,
      `const path = require("node:path");`,
      `const { createResolutionInputRecorder, observeResolutions } = require(${JSON.stringify(recorder)});`,
      `const recorder = createResolutionInputRecorder({ extensions: [".js", ".json"] });`,
      `const before = Module._resolveFilename;`,
      `observeResolutions(recorder);`,
      `const wrapped = Module._resolveFilename !== before;`,
      `const resolve = Module.createRequire(path.join(${JSON.stringify(root)}, "config.js")).resolve;`,
      `resolve("./present.js");`,
      `try { resolve("./later.js"); } catch {}`,
      `const { hashes } = recorder.finish();`,
      `process.stdout.write(JSON.stringify({ hashes, wrapped }));`,
    ].join("\n");
    const result = child_process.spawnSync(process.execPath, ["-e", script], {
      cwd: root,
      encoding: "utf8",
    });
    assert.equal(result.error, undefined);
    assert.equal(result.signal, null);
    assert.equal(result.status, 0, result.stderr);
    const { hashes, wrapped } = JSON.parse(result.stdout) as {
      hashes: Record<string, string | null>;
      wrapped: boolean;
    };
    assert.equal(
      typeof hashes[path.join(root, "present.js")],
      "string",
      "the resolved file is an input with its content",
    );
    assert.ok(
      Object.prototype.hasOwnProperty.call(
        hashes,
        path.join(root, "later.js"),
      ) && hashes[path.join(root, "later.js")] === null,
      "the missing candidate is an input proven absent",
    );
    assert.equal(
      wrapped,
      !RuntimeLoaderCapabilities.requireResolveConsultsHooks(),
    );
  };

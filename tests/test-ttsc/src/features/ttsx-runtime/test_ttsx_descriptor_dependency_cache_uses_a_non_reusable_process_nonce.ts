import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import { dependencyCacheKey } from "../../../../../packages/ttsc/src/launcher/internal/runtime/dependencyCacheKey";
import { dependencyCacheRoot } from "../../../../../packages/ttsc/src/launcher/internal/runtime/dependencyCacheRoot";
import os from "node:os";
import path from "node:path";

/**
 * Verifies supplied descriptor nonces distinguish dependency addresses while
 * ordinary requests ignore them, and descriptor output anchors its cache root.
 *
 * Descriptor dependency addresses must not rely on recyclable numeric PIDs.
 * The descriptor lane instead includes a supplied per-process nonce,
 * while ordinary ttsx workers retain their cross-process sharing key. The
 * evaluator's dependency cache also belongs beside its result so the parent's
 * existing recursive temp cleanup can own the isolated generation. This unit
 * supplies nonce strings; it does not observe nonce generation, PID recycling,
 * a compiled emit, or actual parent cleanup.
 *
 * 1. Compare ordinary and descriptor keys across two evaluator nonces.
 * 2. Resolve the evaluator result's owned cache root.
 * 3. Assert ordinary key equality, evaluator key differences and owned placement.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual key and root functions distinguish shared ordinary builds from isolated descriptor evaluations without launching the runtime.
 * @evidence contracts/testing.md#independent-expectations Equality for ordinary requests, inequality for different descriptor identities and the result-adjacent directory follow the documented evaluator ownership contract.
 * @evidence contracts/testing.md#distinguishing-cases The same project with descriptor mode off ignores nonce changes; enabling it distinguishes both nonces and the ordinary key, and descriptor output selects its owned cache directory.
 * @evidence contracts/testing.md#execution-ownership This named source unit imports the authored key and root owners directly; no built package, native producer or child host is required.
 */
export function test_ttsx_descriptor_dependency_cache_uses_a_non_reusable_process_nonce() {
    const tsconfig = path.join(TestProject.WORKSPACE_ROOT, "tsconfig.json");
    const ordinaryA = dependencyCacheKey(tsconfig, {
      descriptorLoad: false,
      descriptorNonce: "process-a",
    });
    const ordinaryB = dependencyCacheKey(tsconfig, {
      descriptorLoad: false,
      descriptorNonce: "process-b",
    });
    const descriptorA = dependencyCacheKey(tsconfig, {
      descriptorLoad: true,
      descriptorNonce: "process-a",
    });
    const descriptorB = dependencyCacheKey(tsconfig, {
      descriptorLoad: true,
      descriptorNonce: "process-b",
    });

    assert.equal(ordinaryA, ordinaryB);
    assert.notEqual(descriptorA, descriptorB);
    assert.notEqual(descriptorA, ordinaryA);

    const evaluationDir = path.join(os.tmpdir(), "ttsc-descriptor-evaluation");
    const result = path.join(evaluationDir, "descriptor.json");
    assert.equal(
      dependencyCacheRoot({
        TTSC_PLUGIN_DESCRIPTOR_LOAD: "1",
        TTSC_PLUGIN_DESCRIPTOR_OUT: result,
      }),
      path.join(evaluationDir, "dependency-cache"),
    );
}

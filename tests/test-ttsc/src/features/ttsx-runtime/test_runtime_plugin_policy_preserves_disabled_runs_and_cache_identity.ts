import assert from "node:assert/strict";

import { dependencyCacheKey } from "../../../../../packages/ttsc/src/launcher/internal/runtime/dependencyCacheKey";
import { selectRuntimePluginPolicy } from "../../../../../packages/ttsc/src/launcher/internal/runtime/selectRuntimePluginPolicy";

/**
 * Verifies runtime builds retain disabled plugin policy across project
 * boundaries and cannot reuse a generation compiled with enabled discovery.
 *
 * The entry's no-plugins policy also governs dependency and isolated-root
 * builds. Descriptor evaluation independently disables loading to prevent
 * self-hosting. Their selected policy must distinguish otherwise identical
 * cache requests.
 *
 * 1. Select ordinary, disabled-run and descriptor policies without mutating
 *    manifests.
 * 2. Compare equal-policy requests and requests that differ only in plugin policy.
 * 3. Preserve isolated-root and descriptor-generation distinctions under both
 *    policies.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual policy selector preserves disabled manifests regardless of position and descriptor selection without modifying supplied objects; the actual key distinguishes enabled and disabled compilation identities while preserving equivalent requests.
 * @evidence contracts/testing.md#independent-expectations A run disabling plugins must prevent later loading, while ordinary runs retain project discovery. Emission with and without transforms is not equivalent work, so literal false/undefined expectations and key inequality follow from those contracts rather than snapshots.
 * @evidence contracts/testing.md#distinguishing-cases Empty and multiple ordinary manifests permit discovery; disabled manifests first, middle and last block it, and descriptor mode blocks both empty and disabled populations. Equal selected policy shares keys across manifest order, while compiler, project versus isolated root, and descriptor nonce differences remain distinct.
 * @evidence contracts/testing.md#execution-ownership This named source unit calls the authored selection and cache-key operations directly. No runtime hook installation, compiler, native artifact, global replacement or filesystem fixture is required.
 */
export function test_runtime_plugin_policy_preserves_disabled_runs_and_cache_identity(): void {
  const ordinary: Readonly<{ plugins?: false }> = Object.freeze({});
  const disabled = Object.freeze({ plugins: false as const });
  const populations = [
    [],
    [ordinary],
    [ordinary, ordinary],
    [disabled, ordinary, ordinary],
    [ordinary, disabled, ordinary],
    [ordinary, ordinary, disabled],
  ].map((population) => Object.freeze(population));
  const expected = [undefined, undefined, undefined, false, false, false];
  for (let index = 0; index < populations.length; ++index) {
    const population = populations[index]!;
    const before = population.slice();
    assert.equal(selectRuntimePluginPolicy(population, false), expected[index]);
    assert.equal(selectRuntimePluginPolicy(population, true), false);
    assert.deepEqual(population, before);
    assert.equal(ordinary.plugins, undefined);
    assert.equal(disabled.plugins, false);
  }

  for (const plugins of [undefined, false] as const) {
    const base = {
      compilerIdentity: "compiler-a",
      descriptorLoad: false,
      plugins,
    };
    const project = dependencyCacheKey("project/tsconfig.json", base);
    assert.equal(
      project,
      dependencyCacheKey("project/tsconfig.json", { ...base }),
    );
    assert.notEqual(
      project,
      dependencyCacheKey("project/tsconfig.json", {
        ...base,
        plugins: plugins === false ? undefined : false,
      }),
    );
    assert.notEqual(
      project,
      dependencyCacheKey("project/tsconfig.json", {
        ...base,
        compilerIdentity: "compiler-b",
      }),
    );
    assert.notEqual(project, dependencyCacheKey("other/tsconfig.json", base));
    const root = dependencyCacheKey("project/tsconfig.json", {
      ...base,
      root: "root.ts\0content-a",
    });
    assert.notEqual(project, root);
    assert.notEqual(
      root,
      dependencyCacheKey("project/tsconfig.json", {
        ...base,
        root: "root.ts\0content-b",
      }),
    );
    const descriptorA = dependencyCacheKey("project/tsconfig.json", {
      ...base,
      descriptorLoad: true,
      descriptorNonce: "evaluation-a",
    });
    const descriptorB = dependencyCacheKey("project/tsconfig.json", {
      ...base,
      descriptorLoad: true,
      descriptorNonce: "evaluation-b",
    });
    assert.notEqual(descriptorA, descriptorB);
    assert.notEqual(descriptorA, project);
  }
  const disabledFirst = selectRuntimePluginPolicy(populations[3]!, false);
  const disabledLast = selectRuntimePluginPolicy(populations[5]!, false);
  assert.equal(
    dependencyCacheKey("project/tsconfig.json", { plugins: disabledFirst }),
    dependencyCacheKey("project/tsconfig.json", { plugins: disabledLast }),
  );
}

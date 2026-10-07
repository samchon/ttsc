import assert from "node:assert/strict";
import path from "node:path";

import { resolveOptions } from "../../../../../packages/unplugin/src/core/options/resolveOptions";
import { rollupDeliveryOptions } from "../../../../../packages/unplugin/src/core/rollup/rollupDeliveryOptions";
import { createTransformCacheKey } from "../../../../../packages/unplugin/src/core/transform/cache/createTransformCacheKey";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies source-root selection separates cached generations and host deliveries.
 *
 * A wrapper config can describe siblings under a common root. Those output
 * coordinates differ from the config-directory default, even with identical
 * compiler settings and plugins.
 *
 * 1. Compare omitted and explicit config-directory roots.
 * 2. Contrast that root with a common ancestor under identical compile options.
 * 3. Preserve equivalence of native absolute and relative root spellings.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls actual createTransformCacheKey and rollupDeliveryOptions; equal native root identities share generation keys while different roots separate both generation and persistent delivery option identities.
 * @evidence contracts/testing.md#independent-expectations The adapter contract defaults to the config directory and allows a common ancestor override. Different source coordinates require different reusable output identities; relative and absolute spellings of one root denote the same selection.
 * @evidence contracts/testing.md#distinguishing-cases Omitted/default, ancestor override, same-root relative spelling and equal compiler/plugin/alias values isolate the root dimension. Shared compile identity has its own same-compiler/different-root unit contrast; actual sibling source delivery remains in the Vite batch.
 * @evidence contracts/testing.md#execution-ownership This source unit invokes option and key owners on a real temporary directory tree without a compiler, installation, watcher or product host. TestProject owns the temporary tree through its normal cleanup.
 */
export function test_project_root_separates_generation_and_delivery_options(): void {
  const root = TestProject.createProject({ "backend/tsconfig.json": '{"files":[]}' });
  const backend = path.join(root, "backend");
  const tsconfig = path.join(backend, "tsconfig.json");
  const compile = { aliasPaths: {}, compilerOptions: {}, tsconfig };
  const defaultKey = createTransformCacheKey(compile);
  assert.equal(createTransformCacheKey({ ...compile, projectRoot: backend }), defaultKey);
  const commonKey = createTransformCacheKey({ ...compile, projectRoot: root });
  assert.notEqual(commonKey, defaultKey);
  const relative = path.relative(process.cwd(), root);
  assert.equal(createTransformCacheKey({ ...compile, projectRoot: relative }), commonKey);
  const options = resolveOptions({ project: tsconfig, projectRoot: root });
  assert.notEqual(
    rollupDeliveryOptions(options, {}),
    rollupDeliveryOptions({ ...options, projectRoot: backend }, {}),
  );
  assert.equal(
    rollupDeliveryOptions(options, {}),
    rollupDeliveryOptions({ ...options, projectRoot: relative }, {}),
  );
}

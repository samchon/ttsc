import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { MYTYPE_V2 } from "../../../internal/adapter-webpack/MYTYPE_V2";
import { buildOnce } from "../../../internal/adapter-webpack/buildOnce";
import { createTypeEdgeProject } from "../../../internal/adapter-webpack/createTypeEdgeProject";
import { createWebpackConfig } from "../../../internal/adapter-webpack/createWebpackConfig";

/**
 * Verifies a reference-graph edge invalidates the consumer in webpack's kept
 * filesystem cache.
 *
 * The consumer reaches the type file only through a type-only import, so
 * webpack has no module edge to it. The graph edge the producer emits is
 * registered as a dependency, and that is the only way a kept cache learns to
 * rebuild the consumer without deleting the cache.
 *
 * 1. Create the type-edge project with a graph producer and build it with a
 *    filesystem cache.
 * 2. Rewrite the type file with a new interface.
 * 3. Build again and assert the output embeds the new interface.
 *
 * @evidence contracts/testing.md#behavioral-verification Initial bundle has ID: STRING without age; second build from kept filesystem cache embeds AGE: NUMBER after type edit.
 * @evidence contracts/testing.md#independent-expectations Authored V1/V2 declaration literals fix required consumer output independently of cache bookkeeping.
 * @evidence contracts/testing.md#distinguishing-cases Graph-present type-only edit versus graph-absent stale control.
 * @evidence contracts/testing.md#execution-ownership Native-plugin E2E entry test_webpack_filesystem_cache_rebuilds_through_a_type_only_edge is discovered under native-plugins/adapters by src/index.ts and @ttsc/test-unplugin start; its body owns the cases above.
 * @evidence contracts/e2e.md#necessary-boundary Actual webpack filesystem snapshots/cache restoration receive compiler graph invalidation through built loader.
 * @evidence contracts/e2e.md#shared-execution One fixture/config and kept filesystem cache serve both builds; separate compiler lifetimes prove persisted restoration.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private fixture project paths separate mutable inputs and project cache identity from other entries. buildOnce closes successful compilers and preserves configured cache; early failure is not protected by finally, a cleanup limitation. Cache roots are private; tracked roots end at process exit.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: initial bundle has ID: STRING without age; second build from kept filesystem cache embeds AGE: NUMBER after type edit. No portable assertion is transferred or waived; the stated boundary and oracle limitations remain.
 */
export async function test_webpack_filesystem_cache_rebuilds_through_a_type_only_edge(): Promise<void> {
  const root = createTypeEdgeProject(true);
  const config = await createWebpackConfig(root);

  const first = await buildOnce(config);
  assert.match(first, /ID: STRING/);
  assert.doesNotMatch(first, /AGE: NUMBER/);

  fs.writeFileSync(path.join(root, "src", "mytype.ts"), MYTYPE_V2, "utf8");
  const second = await buildOnce(config);
  assert.match(
    second,
    /AGE: NUMBER/,
    "the kept filesystem cache must rebuild the consumer through the type-only edge",
  );
}

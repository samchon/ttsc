import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { MYTYPE_V2 } from "../../../../internal/unplugin/internal/adapter-webpack/MYTYPE_V2";
import { buildOnce } from "../../../../internal/unplugin/internal/adapter-webpack/buildOnce";
import { createTypeEdgeProject } from "../../../../internal/unplugin/internal/adapter-webpack/createTypeEdgeProject";
import { createWebpackConfig } from "../../../../internal/unplugin/internal/adapter-webpack/createWebpackConfig";

/**
 * Verifies the control baseline: without a reference graph, webpack's kept
 * filesystem cache serves the stale consumer.
 *
 * This is the reproduction the graph exists to fix. With no graph and no
 * plugin-reported dependencies, webpack restores the consumer module untouched
 * after its type file changes. If this control ever turns fresh, the graph
 * scenarios stop being evidence.
 *
 * 1. Create the type-edge project without a graph producer and build it with a
 *    filesystem cache.
 * 2. Rewrite the type file with a new interface.
 * 3. Build again and assert the output still embeds the old interface.
 *
 * @evidence contracts/testing.md#behavioral-verification Without graph, initial ID: STRING remains after type edit and second bundle lacks AGE: NUMBER.
 * @evidence contracts/testing.md#independent-expectations Fixture V1/V2 contents define staleness; intentionally stale control verifies graph-positive test is informative.
 * @evidence contracts/testing.md#distinguishing-cases No graph or reported dependency with kept filesystem cache; positive twin owns fresh result.
 * @evidence contracts/testing.md#execution-ownership Native-plugin E2E entry test_webpack_filesystem_cache_control_serves_stale_without_a_graph is discovered under native-plugins/adapters by src/index.ts and @ttsc/test-e2e start; its body owns the cases above.
 * @evidence contracts/e2e.md#necessary-boundary Actual webpack persistent-cache restore loses the erased type-only module edge by design.
 * @evidence contracts/e2e.md#shared-execution One fixture/config and kept filesystem cache serve both builds; separate compiler lifetimes prove persisted restoration. The shared family borrows the positive twin's successfully closed project after restoring V1, removing the graph option and clearing the earlier webpack cache. This control keeps its own cache unchanged across both builds.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private fixture project paths separate mutable inputs and project cache identity from other entries. buildOnce closes successful compilers and preserves configured cache; early failure is not protected by finally, a cleanup limitation. Cache roots are private; tracked roots end at process exit.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: without graph, initial ID: STRING remains after type edit and second bundle lacks AGE: NUMBER. No portable assertion is transferred or waived; the stated boundary and oracle limitations remain.
 */
export async function test_webpack_filesystem_cache_control_serves_stale_without_a_graph(
  preparedRoot?: string,
): Promise<void> {
  const root = preparedRoot ?? createTypeEdgeProject(false);
  const config = await createWebpackConfig(root);

  const first = await buildOnce(config);
  assert.match(first, /ID: STRING/);

  fs.writeFileSync(path.join(root, "src", "mytype.ts"), MYTYPE_V2, "utf8");
  const second = await buildOnce(config);
  assert.doesNotMatch(
    second,
    /AGE: NUMBER/,
    "control scenario unexpectedly rebuilt: the positive test no longer proves the graph channel",
  );
}

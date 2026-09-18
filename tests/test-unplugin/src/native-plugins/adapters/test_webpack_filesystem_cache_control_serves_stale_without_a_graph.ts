import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { MYTYPE_V2 } from "../../internal/adapter-webpack/MYTYPE_V2";
import { buildOnce } from "../../internal/adapter-webpack/buildOnce";
import { createTypeEdgeProject } from "../../internal/adapter-webpack/createTypeEdgeProject";
import { createWebpackConfig } from "../../internal/adapter-webpack/createWebpackConfig";

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
 */
export async function test_webpack_filesystem_cache_control_serves_stale_without_a_graph(): Promise<void> {
  const root = createTypeEdgeProject(false);
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

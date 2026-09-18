import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { MYTYPE_V2 } from "../../internal/adapter-webpack/MYTYPE_V2";
import { buildOnce } from "../../internal/adapter-webpack/buildOnce";
import { createTypeEdgeProject } from "../../internal/adapter-webpack/createTypeEdgeProject";
import { createWebpackConfig } from "../../internal/adapter-webpack/createWebpackConfig";

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

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { MYTYPE_V2 } from "../../internal/adapter-webpack/MYTYPE_V2";
import { buildOnce } from "../../internal/adapter-webpack/buildOnce";
import { createTypeEdgeProject } from "../../internal/adapter-webpack/createTypeEdgeProject";
import { createWebpackConfig } from "../../internal/adapter-webpack/createWebpackConfig";

/**
 * Verifies the reproduction baseline the graph exists to fix: without a graph
 * (and no plugin-reported dependencies), webpack's kept filesystem cache
 * restores the consumer module untouched after the type file changes, so the
 * second build still embeds the stale interface. If this control ever turns
 * fresh, the positive scenario above stops being evidence.
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

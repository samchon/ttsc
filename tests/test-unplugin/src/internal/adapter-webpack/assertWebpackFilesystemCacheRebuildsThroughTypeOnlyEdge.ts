import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { MYTYPE_V2 } from "./MYTYPE_V2";
import { buildOnce } from "./buildOnce";
import { createTypeEdgeProject } from "./createTypeEdgeProject";
import { createWebpackConfig } from "./createWebpackConfig";

/**
 * Asserts the fixed behavior: with a producer emitting the reference graph,
 * editing the type file invalidates the consumer module in webpack's kept
 * filesystem cache, so the second build embeds the new interface without any
 * cache deletion.
 */
export async function assertWebpackFilesystemCacheRebuildsThroughTypeOnlyEdge(): Promise<void> {
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

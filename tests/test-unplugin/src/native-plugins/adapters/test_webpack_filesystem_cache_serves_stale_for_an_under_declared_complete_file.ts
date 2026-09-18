import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { MYTYPE_V2 } from "../../internal/adapter-webpack/MYTYPE_V2";
import { buildOnce } from "../../internal/adapter-webpack/buildOnce";
import { createTypeEdgeProject } from "../../internal/adapter-webpack/createTypeEdgeProject";
import { createWebpackConfig } from "../../internal/adapter-webpack/createWebpackConfig";

/**
 * Verifies an under-declared complete list makes webpack's kept filesystem
 * cache serve stale code (samchon/ttsc#720).
 *
 * The producer emits the reference-graph edge, so
 * `test_webpack_filesystem_cache_rebuilds_through_a_type_only_edge` proves the
 * same project rebuilds soundly. The only difference is the declaration: the
 * plugin vouches that `src/main.ts`'s reported dependency list is complete
 * while reporting nothing, even though it reads `src/mytype.ts`. The host
 * honors the claim and drops the graph edge. This is the responsibility
 * transfer made observable: the platform behaves as documented, and the stale
 * output is the plugin's bug.
 *
 * 1. Create the type-edge project whose plugin declares an empty complete list,
 *    and build it.
 * 2. Rewrite the type file with a new interface.
 * 3. Build again and assert the output still embeds the old interface.
 */
export async function test_webpack_filesystem_cache_serves_stale_for_an_under_declared_complete_file(): Promise<void> {
  const root = createTypeEdgeProject(true, true);
  const config = await createWebpackConfig(root);

  const first = await buildOnce(config);
  assert.match(first, /ID: STRING/);

  fs.writeFileSync(path.join(root, "src", "mytype.ts"), MYTYPE_V2, "utf8");
  const second = await buildOnce(config);
  assert.doesNotMatch(
    second,
    /AGE: NUMBER/,
    "an under-declared complete list must drop the graph edge: the host does not audit the declaration",
  );
}

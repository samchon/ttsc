import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { buildOnce } from "../../internal/adapter-webpack/buildOnce";
import { createTypeEdgeProject } from "../../internal/adapter-webpack/createTypeEdgeProject";
import { createWebpackConfig } from "../../internal/adapter-webpack/createWebpackConfig";

/**
 * Verifies webpack compilers that run one after another in a process share one
 * generation, and release it when none follows (samchon/ttsc#1396).
 *
 * Webpack calls the adapter factory once per compiler, and `next build
 * --webpack` runs its server, edge, and client compilers in one process, each
 * shut down before the next is created. Each compiler owned a cache and
 * compiled the same program again. Equal options now share one process-wide
 * cache, kept for a short grace after its last compiler shuts down.
 *
 * 1. Run two compilers, each with its own adapter instance, one after the other,
 *    and assert the project compiled once.
 * 2. Let the grace pass, run a third, and assert the project compiles again.
 */
export async function test_webpack_sequential_compilers_share_one_generation(): Promise<void> {
  const runLog = path.join(
    TestProject.tmpdir("ttsc-unplugin-webpack-sequential-log-"),
    "compiles.bin",
  );
  const root = createTypeEdgeProject(true, false, runLog);
  const compiles = () => (fs.existsSync(runLog) ? fs.statSync(runLog).size : 0);
  const build = async () => {
    const config = await createWebpackConfig(root);
    // Only ttsc's generation may carry a result from one compiler to the next.
    delete config.cache;
    return buildOnce(config);
  };

  await build();
  await build();
  assert.equal(compiles(), 1, "the second compiler reuses the generation");

  await new Promise((resolve) => setTimeout(resolve, 2_500));
  await build();
  assert.equal(compiles(), 2, "a generation no compiler takes up is released");
}

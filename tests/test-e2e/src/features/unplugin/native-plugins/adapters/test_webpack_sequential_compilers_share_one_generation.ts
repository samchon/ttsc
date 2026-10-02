import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { buildOnce } from "../../../../internal/unplugin/internal/adapter-webpack/buildOnce";
import { createTypeEdgeProject } from "../../../../internal/unplugin/internal/adapter-webpack/createTypeEdgeProject";
import { createWebpackConfig } from "../../../../internal/unplugin/internal/adapter-webpack/createWebpackConfig";

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
 *
 * @evidence contracts/testing.md#behavioral-verification Two separate sequential real compilers run with no webpack cache yet total one compile; third after grace totals two.
 * @evidence contracts/testing.md#independent-expectations Native fixture log counts one byte per compile and webpack cache is removed to isolate adapter reuse.
 * @evidence contracts/testing.md#distinguishing-cases Immediate successive compiler shutdown/start versus 2.5-second idle interval.
 * @evidence contracts/testing.md#execution-ownership Native-plugin E2E entry test_webpack_sequential_compilers_share_one_generation is discovered under native-plugins/adapters by src/index.ts and @ttsc/test-e2e start; its body owns the cases above.
 * @evidence contracts/e2e.md#necessary-boundary Actual webpack factories and compiler shutdown lifecycle exercise process-wide generation grace.
 * @evidence contracts/e2e.md#shared-execution Related deliveries reuse fixture and loaded adapter; additional passes/builds own the lifecycle, configuration or host differences above. Fixture builders reuse native artifacts through shared TTSC_CACHE_DIR.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private fixture project paths separate mutable inputs and project cache identity from other entries. buildOnce closes successful compilers and preserves configured cache; early failure is not protected by finally, a cleanup limitation. Cache roots are private; tracked roots end at process exit.
 * @evidence contracts/e2e.md#preserved-coverage Retained assertions: two separate sequential real compilers run with no webpack cache yet total one compile; third after grace totals two. No portable assertion is transferred or waived; the stated boundary and oracle limitations remain.
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

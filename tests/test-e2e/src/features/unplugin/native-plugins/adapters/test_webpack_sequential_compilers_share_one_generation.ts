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
 * @evidence contracts/e2e.md#shared-execution The shared experiment borrows the type-edge project and actual native run log only after the watch/compiler close callbacks and exact original type-byte restoration. Three real compiler lifetimes remain necessary; only duplicate fixture materialization is shared.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Standalone preparation stays private. Borrowed preparation supplies the same graph/count plugin configuration and restored V1 bytes after the earlier compiler has closed. Literal1/2 use the actual pre-build log size as interval baseline without clearing it. buildOnce closes successful compilers; early failure still lacks finally cleanup and blocks later shared mutation. Only successful return permits the parent's kept-cache positive/control profiles.
 * @evidence contracts/e2e.md#preserved-coverage Two separate sequential real compilers with webpack cache removed require observed interval count1; the third after original2500ms grace requires interval count2. Standalone baseline is zero. Earlier watch recompilations are not counted as this profile, and no native build reuse is inferred. Original donors remain; actual survival is unverified.
 */
export async function test_webpack_sequential_compilers_share_one_generation(
  prepared?: { root: string; runLog: string },
): Promise<void> {
  const runLog = prepared?.runLog ?? path.join(
    TestProject.tmpdir("ttsc-unplugin-webpack-sequential-log-"),
    "compiles.bin",
  );
  const root = prepared?.root ?? createTypeEdgeProject(true, false, runLog);
  const compiles = () => (fs.existsSync(runLog) ? fs.statSync(runLog).size : 0);
  const baseline = compiles();
  const build = async () => {
    const config = await createWebpackConfig(root);
    // Only ttsc's generation may carry a result from one compiler to the next.
    delete config.cache;
    return buildOnce(config);
  };

  await build();
  await build();
  assert.equal(compiles() - baseline, 1, "the second compiler reuses the generation");

  await new Promise((resolve) => setTimeout(resolve, 2_500));
  await build();
  assert.equal(compiles() - baseline, 2, "a generation no compiler takes up is released");
}

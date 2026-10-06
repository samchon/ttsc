import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { ITtscCompilerTransformation } from "ttsc";

import { createTtscTransformCache } from "../../../../../packages/unplugin/src/core/transform/cache/createTtscTransformCache";
import { resetTtscTransformCache } from "../../../../../packages/unplugin/src/core/transform/cache/resetTtscTransformCache";
import { selectCachedGenerationAction } from "../../../../../packages/unplugin/src/core/transform/cache/selectCachedGenerationAction";
import { TestProject } from "../../../../utils/src/TestProject";
import { observeValidationUnitGeneration } from "../../internal/transform-project-cache/observeValidationUnitGeneration";

/**
 * A failed Program belongs to all its diagnostic inputs, including a sibling
 * outside the delivered module's graph closure. Literal consumer metadata and
 * real bytes distinguish steady failure replay from actual repair; no native
 * compiler or watcher is represented by this unit.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual cached delivery action serves unchanged failed inputs, captures after a disconnected sibling is repaired, serves a fresh checkpoint and captures after its external declaration is repaired.
 * @evidence contracts/testing.md#independent-expectations Authored bad/repaired source bytes and literal serve/capture decisions establish the diagnostic-generation scope independently of the selector.
 * @evidence contracts/testing.md#distinguishing-cases A graph declaring only the delivered module cannot narrow a failed whole Program. In-project sibling and excluded node_modules declaration repairs are independent, while unchanged failed bytes retain the same Promise.
 * @evidence contracts/testing.md#execution-ownership TestExecutor selects this named test-unplugin source unit. It calls production snapshot validation over real filesystem inputs; Metro's selected E2E body owns actual failure publication and native repair delivery.
 */
export function test_failed_generation_replay_preserves_whole_program_repair(): void {
  const root = TestProject.tmpdir("ttsc-failed-program-repair-");
  TestProject.writeFiles(root, {
    "package.json": '{"private":true}',
    "tsconfig.json": '{"include":["src"]}',
    "src/mod0.ts": "export const value = 1;\n",
    "src/disconnected.ts": "export type Broken = MissingType;\n",
    "node_modules/types/index.d.ts": "export type ExternalBroken = MissingType;\n",
  });
  const config = path.join(root, "tsconfig.json");
  const external = path.join(root, "node_modules/types/index.d.ts");
  const result = (): ITtscCompilerTransformation.IFailure => ({
    type: "failure",
    typescript: {},
    diagnostics: [],
    graph: { edges: { "src/mod0.ts": [] }, globals: [], configs: ["tsconfig.json"] },
    dependencies: { "src/mod0.ts": [external] },
    hostInputs: [config],
    hostInputHashes: { [config]: createHash("sha256").update(fs.readFileSync(config)).digest("hex") },
    hostInputRealpaths: { [config]: fs.realpathSync.native(config) },
  });
  const cache = createTtscTransformCache();
  try {
    let observed = observeValidationUnitGeneration(root, result());
    let generation = Promise.resolve(observed);
    cache.set("failed", generation);
    const action = () => selectCachedGenerationAction({
      cache, cached: observed, generation, key: "failed", epoch: undefined,
      file: path.join(root, "src/mod0.ts"), source: fs.readFileSync(path.join(root, "src/mod0.ts"), "utf8"),
    });
    assert.equal(action(), "serve");
    assert.equal(cache.get("failed"), generation);
    fs.writeFileSync(path.join(root, "src/disconnected.ts"), "export type Repaired = string;\n");
    assert.equal(action(), "capture");
    assert.equal(cache.has("failed"), false);
    observed = observeValidationUnitGeneration(root, result());
    generation = Promise.resolve(observed);
    cache.set("failed", generation);
    assert.equal(action(), "serve");
    fs.writeFileSync(external, "export type ExternalRepaired = number;\n");
    assert.equal(action(), "capture");
    assert.equal(cache.has("failed"), false);
  } finally {
    resetTtscTransformCache(cache);
  }
}

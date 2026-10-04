import type { ITtscCompilerTransformation } from "ttsc";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { createTtscTransformCache } from "../../../../../packages/unplugin/src/core/transform/cache/createTtscTransformCache";
import { resetTtscTransformCache } from "../../../../../packages/unplugin/src/core/transform/cache/resetTtscTransformCache";
import { selectCachedGenerationAction } from "../../../../../packages/unplugin/src/core/transform/cache/selectCachedGenerationAction";
import { transformFilesystem } from "../../../../../packages/unplugin/src/core/transform/cache/transformFilesystem";
import { TRANSFORM_RESULT_FILESYSTEM } from "../../../../../packages/unplugin/src/core/transform/cache/TRANSFORM_RESULT_FILESYSTEM";
import { TestProject } from "../../../../utils/src/TestProject";
import { createTickPinnedFilesystem } from "../../internal/transform-project-cache/createTickPinnedFilesystem";
import { observeValidationUnitGeneration } from "../../internal/transform-project-cache/observeValidationUnitGeneration";
import { PINNED_TICK } from "../../internal/transform-project-cache/PINNED_TICK";

/**
 * Verifies complete proof reads unchanged stamps rather than trusting an
 * unfinished tick.
 *
 * Four unchanged modules share a literal consumer generation. Same-length
 * source, external, global and manifest rewrites change bytes under identical pinned
 * metadata view, forcing actual cache eviction and a capture request. Fresh
 * consumer checkpoints supply inputs, not a simulated compiler response.
 *
 * 1. Create four modules with external declarations, pin the native metadata view
 *    and record a consumer checkpoint, requiring every module to be served.
 * 2. Rewrite one source with same-length bytes under identical metadata and
 *    require the cache to evict its generation and request a capture.
 * 3. Record a new checkpoint, rewrite an external input the same way and require
 *    another eviction and capture. Repeat for a global declaration and a
 *    same-size manifest key-order change, with the manifest mtime ahead of ctime.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual selectCachedGenerationAction and complete snapshot validators serve four unchanged modules, then evict the recorded Promise independently for sibling source, external graph, global declaration and universal manifest rewrites under unchanged timestamps.
 * @evidence contracts/testing.md#independent-expectations Literal serve then capture decisions and unequal cache identities follow from changed bytes, independently of metadata equality. The supported cache-local clock view pins all metadata ticks while native bytes are actually rewritten; fresh fixture snapshots are inputs only.
 * @evidence contracts/testing.md#distinguishing-cases Stable four-module serving contrasts with same-length source and out-of-walk edits, a number-to-string global edit, and JSON key reordering without a size change. Manifest mtime is one tick ahead of pinned ctime throughout, so it cannot justify skipping a different input's content comparison. Each fresh checkpoint serves all four modules before the next isolated edit. There are no notification trackers; this does not certify silent-watcher authority.
 * @evidence contracts/testing.md#execution-ownership This synchronous source unit runs actual selectCachedGenerationAction and complete-snapshot validators through the cache-local tick-pinned filesystem, counting decision results zero through four. No compiler, host, native clock acquisition or silent watcher proof runs; the shared native producer/consumer connection belongs to tests/test-e2e/src/features/test_e2e_metro_batch.ts#test_e2e_metro_batch.
 */
export function test_transformttsc_same_tick_rewrite_replaces_the_snapshot_generation(): void {
  const root = fs.realpathSync.native(TestProject.tmpdir("ttsc-pinned-snapshot-unit-"));
  TestProject.writeFiles(root, {
    "tsconfig.json": '{"include":["src"]}',
    "package.json": '{"private":true,"type":"commonjs"}',
    "node_modules/global0/index.d.ts": "declare const ambient0: number;\n",
  });
  const modules: string[] = [];
  for (let index = 0; index < 4; index += 1) {
    const file = path.join(root, "src", "mod" + index + ".ts");
    TestProject.writeFiles(root, {
      ["src/mod" + index + ".ts"]: 'export const value' + index + ': string = "PROBE";\n',
      ["node_modules/dep" + index + "/index.d.ts"]: "export declare const dep" + index + ": number;\n",
    });
    modules.push(file);
  }
  const pinned = createTickPinnedFilesystem({
    device: fs.lstatSync(root, { bigint: true }).dev,
    watch: "refused",
  });
  const cache = createTtscTransformCache(pinned.operations);
  const manifest = path.join(root, "package.json");
  pinned.modificationStamps.set(manifest, PINNED_TICK + 1n);
  let captures = 0;
  const metadata = (file: string) => {
    const stat = transformFilesystem(cache).lstat(file);
    return [stat.ctimeNs, stat.mtimeNs, stat.size, stat.ino];
  };
  const checkpoint = () => {
    const config = path.join(root, "tsconfig.json");
    const result: ITtscCompilerTransformation.ISuccess = {
      type: "success",
      typescript: Object.fromEntries(modules.map((file) => [path.relative(root, file), "export const input = 1;\n"])),
      graph: {
        edges: Object.fromEntries(modules.map((file) => [path.relative(root, file), Array.from({ length: 4 }, (_, index) => "node_modules/dep" + index + "/index.d.ts")])),
        globals: ["node_modules/global0/index.d.ts"], configs: ["tsconfig.json"],
      },
      hostInputs: [config, manifest],
      hostInputHashes: Object.fromEntries([config, manifest].map((file) => [file, createHash("sha256").update(fs.readFileSync(file)).digest("hex")])),
      hostInputRealpaths: Object.fromEntries([config, manifest].map((file) => [file, fs.realpathSync.native(file)])),
    };
    TRANSFORM_RESULT_FILESYSTEM.set(result, transformFilesystem(cache));
    const observed = observeValidationUnitGeneration(root, result);
    cache.set("fixture", Promise.resolve(observed));
    return observed;
  };
  try {
    let observed = checkpoint();
    const decide = (file: string) => {
      const action = selectCachedGenerationAction({
        cache, cached: observed, epoch: undefined, file,
        generation: cache.get("fixture")!, key: "fixture",
        source: fs.readFileSync(file, "utf8"),
      });
      if (action === "capture") captures += 1;
      return action;
    };
    for (const file of modules) assert.equal(decide(file), "serve");
    assert.equal(captures, 0);
    const firstGeneration = [...cache.values()][0];
    const sourceMetadata = metadata(modules[2]!);
    fs.writeFileSync(path.join(root, "src", "mod2.ts"), 'export const value2: string = "PROBF";\n', "utf8");
    assert.deepEqual(metadata(modules[2]!), sourceMetadata);
    assert.equal(decide(modules[1]!), "capture");
    assert.notEqual([...cache.values()][0], firstGeneration, "the walk must re-read a project file whose tick never provably ended");
    assert.equal(captures, 1);
    observed = checkpoint();
    for (const file of modules) assert.equal(decide(file), "serve");
    const externalGeneration = [...cache.values()][0];
    const externalFile = path.join(root, "node_modules", "dep0", "index.d.ts");
    const externalMetadata = metadata(externalFile);
    fs.writeFileSync(externalFile, "export declare const dep0: string;\n", "utf8");
    assert.deepEqual(metadata(externalFile), externalMetadata);
    assert.equal(decide(modules[0]!), "capture");
    assert.notEqual([...cache.values()][0], externalGeneration, "the out-of-walk re-check must re-read an unseparated external input");
    assert.equal(captures, 2);
    observed = checkpoint();
    for (const file of modules) assert.equal(decide(file), "serve");
    assert.equal(transformFilesystem(cache).lstat(manifest).mtimeNs, PINNED_TICK + 1n);
    assert.equal(transformFilesystem(cache).lstat(manifest).ctimeNs, PINNED_TICK);
    const globalGeneration = cache.get("fixture");
    const globalFile = path.join(root, "node_modules", "global0", "index.d.ts");
    const globalMetadata = metadata(globalFile);
    fs.writeFileSync(globalFile, "declare const ambient0: string;\n");
    assert.deepEqual(metadata(globalFile), globalMetadata);
    assert.equal(decide(modules[0]!), "capture");
    assert.notEqual(cache.get("fixture"), globalGeneration);
    assert.equal(captures, 3);
    observed = checkpoint();
    for (const file of modules) assert.equal(decide(file), "serve");
    const manifestGeneration = cache.get("fixture");
    const manifestMetadata = metadata(manifest);
    const beforeManifest = fs.readFileSync(manifest, "utf8");
    const reorderedManifest = '{"type":"commonjs","private":true}';
    assert.equal(Buffer.byteLength(reorderedManifest), Buffer.byteLength(beforeManifest));
    assert.notEqual(reorderedManifest, beforeManifest);
    fs.writeFileSync(manifest, reorderedManifest);
    assert.deepEqual(metadata(manifest), manifestMetadata);
    assert.equal(decide(modules[0]!), "capture");
    assert.notEqual(cache.get("fixture"), manifestGeneration);
    assert.equal(captures, 4);
    observed = checkpoint();
    for (const file of modules) assert.equal(decide(file), "serve");
    assert.equal(captures, 4);
  } finally {
    resetTtscTransformCache(cache);
  }
}

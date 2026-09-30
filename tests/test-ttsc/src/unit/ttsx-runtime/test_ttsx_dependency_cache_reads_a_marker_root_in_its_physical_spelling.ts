import { TestProject } from "../../../../utils/src/TestProject";

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { readDependencyCache } from "../../../../../packages/ttsc/src/launcher/internal/runtime/readDependencyCache";

/**
 * Verifies a dependency-cache marker's `rootDir` is read in its physical
 * spelling, whatever spelling it was written in.
 *
 * `rootDir` never gated reuse, so a marker naming a symlinked directory was
 * always a hit; it just handed `serveBuiltDependency` a root that
 * `path.relative` could not place the served source under, dropping the
 * exact-mirror lane for every file of that dependency. The reader is where an
 * old spelling has to be tolerated, because the persistent fallback cache under
 * the system temp directory outlives the process that wrote the marker.
 *
 * 1. Seed a complete generation whose marker names `src`, a symlink to the real
 *    `sources` directory.
 * 2. Read the cache.
 * 3. Assert the hit reports the real directory, which is its own physical path.
 *
 * @evidence contracts/testing.md#behavioral-verification The real reader resolves a published linked root to its filesystem identity while retaining a valid cache hit.
 * @evidence contracts/testing.md#independent-expectations Native realpath supplies the independent physical identity; the marker deliberately uses a different alias.
 * @evidence contracts/testing.md#distinguishing-cases A valid generation with linked root hits and reports the target identity; unsupported link creation remains an explicit execution limitation.
 * @evidence contracts/testing.md#execution-ownership The named source-unit entry calls authored production functions directly; temporary fixture files are inputs, with no compiler build, consumer installation or product host.
 */
export function test_ttsx_dependency_cache_reads_a_marker_root_in_its_physical_spelling() {
    const root = TestProject.tmpdir("ttsx-depcache-root-");
    const cacheDir = path.join(root, "entry");
    const metaPath = path.join(root, "entry.json");
    const generation = "e".repeat(32);
    const generationDir = path.join(cacheDir, `gen-${generation}`);
    const realRoot = path.join(root, "sources");
    const linkedRoot = path.join(root, "src");

    fs.mkdirSync(generationDir, { recursive: true });
    fs.writeFileSync(
      path.join(generationDir, "index.js"),
      "exports.value = 'built';\n",
    );
    fs.mkdirSync(realRoot, { recursive: true });
    try {
      fs.symlinkSync(realRoot, linkedRoot, "junction");
    } catch {
      // Without symlink permission the two spellings never diverge, and the
      // contract this pins cannot be exercised.
      return;
    }

    fs.writeFileSync(
      metaPath,
      JSON.stringify({
        generation,
        moduleOptions: { module: "commonjs" },
        emittedSources: {},
        outputs: ["index.js"],
        rootDir: linkedRoot,
      }),
      "utf8",
    );

    const built = readDependencyCache(cacheDir, metaPath);
    assert.notEqual(built, null, "the seeded generation should be a hit");
    assert.equal(
      built!.rootDir,
      fs.realpathSync.native(built!.rootDir),
      "a marker root must be read in the spelling the served sources carry",
    );
    assert.equal(built!.rootDir, fs.realpathSync.native(realRoot));
}
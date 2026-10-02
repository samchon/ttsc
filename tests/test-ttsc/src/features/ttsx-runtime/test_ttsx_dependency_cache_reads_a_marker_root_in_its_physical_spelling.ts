import { TestProject } from "../../../../utils/src/TestProject";

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { readDependencyCache } from "../../../../../packages/ttsc/src/launcher/internal/runtime/readDependencyCache";

/**
 * Verifies a dependency-cache marker's `rootDir` is read in its physical
 * spelling when the marker names an existing directory alias.
 *
 * `rootDir` never gated reuse, so a marker naming a symlinked directory was
 * always a hit; it just handed `serveBuiltDependency` a root that
 * `path.relative` could not place the served source under, dropping the
 * exact-mirror lane for every file of that dependency. The reader is where an
 * old alias spelling is tolerated without asserting a persistent fallback
 * cache, a serving operation or cross-process reuse was exercised here.
 *
 * 1. Seed a complete generation whose marker names `src`, a symlink to the real
 *    `sources` directory.
 * 2. Read the cache.
 * 3. Assert the hit reports the real directory, which is its own physical path.
 *
 * @evidence contracts/testing.md#behavioral-verification The real reader resolves a published linked root to its filesystem identity while retaining a valid cache hit.
 * @evidence contracts/testing.md#independent-expectations Native realpath supplies the independent physical identity; the marker deliberately uses a different alias.
 * @evidence contracts/testing.md#distinguishing-cases A valid generation with a native directory alias hits and reports the independently observed target identity, distinct from its marker spelling. Windows uses a directory junction and POSIX a directory symlink; refused native preparation fails, not skips or proves a product failure.
 * @evidence contracts/testing.md#execution-ownership The named source-unit entry calls authored production functions directly; temporary fixture files are inputs, with no compiler build, consumer installation or product host.
 */
export function test_ttsx_dependency_cache_reads_a_marker_root_in_its_physical_spelling(): void {
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
    fs.symlinkSync(
      realRoot,
      linkedRoot,
      process.platform === "win32" ? "junction" : "dir",
    );
    const physicalRoot = fs.realpathSync.native(realRoot);
    assert.equal(fs.lstatSync(linkedRoot).isSymbolicLink(), true);
    assert.equal(fs.realpathSync.native(linkedRoot), physicalRoot);
    assert.notEqual(linkedRoot, physicalRoot);

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
    assert.equal(built!.rootDir, physicalRoot);
}

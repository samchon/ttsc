import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { readDependencyCache } from "../../../../../packages/ttsc/src/launcher/internal/runtime/readDependencyCache";

/**
 * Verifies a cache reader never combines an old generation's metadata with a
 * newer generation's partially-written emit.
 *
 * Reproduces the issue's second race: a valid marker still names generation A
 * while a rebuilding holder populates generation B and has not yet published
 * B's marker. Because the marker is bound to one generation and B lands in its
 * own directory, `readDependencyCache` keeps returning the complete A until the
 * atomic marker swap points at B — never a mix of A's metadata and B's partial
 * files.
 *
 * 1. Seed a complete generation A with a published marker.
 * 2. Seed generation B without publishing its marker; the reader observes A only.
 * 3. Atomically swap the fixture marker; the reader now observes the
 *    complete B and never a directory that lacks emitted JavaScript.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual readDependencyCache returns published complete A while B exists without a marker, then B after an atomic fixture marker rename; a marker naming C with no emitted output misses.
 * @evidence contracts/testing.md#independent-expectations Literal distinct generation ids and authored output files define publication identity. A marker names exactly one generation, so an unpublished sibling cannot supply emitted sources and an absent advertised output cannot be a hit.
 * @evidence contracts/testing.md#distinguishing-cases Complete A with unpublished B, complete B after marker replacement and advertised-but-absent C output retain all three original reader distinctions. The writer's native protocol and real owner contention are owned by the fenced dependency-cache E2Es rather than claimed by this fixture writer.
 * @evidence contracts/testing.md#execution-ownership This named source unit invokes the authored reader directly at the same quiescent filesystem stages formerly produced by a barrier child. That child executed fixture writes rather than a product publisher, so removing it preserves every original observation without building artifacts, installing a consumer or starting a product host.
 */
export function test_ttsx_dependency_cache_reader_never_mixes_metadata_with_a_partial_emit() {
    const root = TestProject.tmpdir("ttsx-depcache-publish-");
    const cacheDir = path.join(root, "entry");
    const metaPath = path.join(root, "entry.json");
    const genA = "a".repeat(32);
    const genB = "b".repeat(32);
    const genADir = path.join(cacheDir, `gen-${genA}`);

    // Seed a complete generation A.
    fs.mkdirSync(genADir, { recursive: true });
    fs.writeFileSync(path.join(genADir, "index.js"), "exports.value = 'A';\n");
    fs.writeFileSync(
      metaPath,
      JSON.stringify({
        generation: genA,
        moduleOptions: { module: "commonjs" },
        emittedSources: {},
        outputs: ["index.js"],
        rootDir: "/root",
      }),
      "utf8",
    );

    const genBDir = path.join(cacheDir, `gen-${genB}`);
    fs.mkdirSync(genBDir, { recursive: true });
    fs.writeFileSync(path.join(genBDir, "index.js"), "exports.value = 'B';\n");

    // Marker still names A: the reader must return the complete A, never a
    // BuiltProject pointing at the partially-written B directory.
    const midRebuild = readDependencyCache(cacheDir, metaPath);
    assert.notEqual(midRebuild, null, "reader should still hit generation A");
    assert.equal(midRebuild!.emitDir, genADir);

    const temporaryMarker = metaPath + ".tmp";
    fs.writeFileSync(temporaryMarker, JSON.stringify({
      generation: genB, moduleOptions: { module: "commonjs" },
      emittedSources: {}, outputs: ["index.js"], rootDir: "/root",
    }));
    fs.renameSync(temporaryMarker, metaPath);

    // After the atomic swap the reader observes the complete B.
    const afterPublish = readDependencyCache(cacheDir, metaPath);
    assert.notEqual(afterPublish, null, "reader should hit generation B");
    assert.equal(afterPublish!.emitDir, path.join(cacheDir, `gen-${genB}`));

    // Negative twin: a marker that names a generation whose directory holds no
    // emitted JavaScript (a failed/partial generation) is never a hit.
    const genC = "c".repeat(32);
    fs.mkdirSync(path.join(cacheDir, `gen-${genC}`), { recursive: true });
    fs.writeFileSync(
      metaPath,
      JSON.stringify({
        generation: genC,
        moduleOptions: { module: "commonjs" },
        emittedSources: {},
        outputs: ["index.js"],
        rootDir: "/root",
      }),
      "utf8",
    );
    assert.equal(readDependencyCache(cacheDir, metaPath), null);
  }

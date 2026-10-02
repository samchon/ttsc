import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { readDependencyCache } from "../../../../../packages/ttsc/src/launcher/internal/runtime/readDependencyCache";

/**
 * Verifies the reader selects the advertised generation, ignores an unpublished
 * sibling, and misses when the advertised directory has no JavaScript.
 *
 * Authored sequential snapshots model publication states: the marker names A
 * while B already has JavaScript, then a fixture rename publishes B, then the
 * marker advertises an empty C. The actual reader is exercised at each state;
 * no rebuilding holder, product publisher, concurrent race or partial B write
 * is executed.
 *
 * 1. Seed a complete generation A with a published marker.
 * 2. Seed generation B without publishing its marker; the reader observes A only.
 * 3. Atomically swap the fixture marker; the reader now observes the
 *    JavaScript-bearing B.
 * 4. Advertise empty generation C and assert the reader misses.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual readDependencyCache returns published complete A while B exists without a marker, then B after an atomic fixture marker rename; a marker naming C with no emitted output misses.
 * @evidence contracts/testing.md#independent-expectations Literal distinct generation ids and authored output files define publication identity. A marker names exactly one generation, so an unpublished sibling cannot supply emitted sources and an absent advertised output cannot be a hit.
 * @evidence contracts/testing.md#distinguishing-cases Three states are read: complete generation A while an unpublished generation B directory exists (A is returned), B after the marker is replaced by a temp-file rename (B is returned), and a marker naming generation C whose directory holds no emitted file (miss). The marker is written by the test itself, so real writer ordering and concurrent owners are not exercised.
 * @evidence contracts/testing.md#execution-ownership Unit test discovered once under src/features/ttsx-runtime; it writes the marker and generation directories itself in a TestProject.tmpdir, in sequence in one process, and calls readDependencyCache at each stage. No child process, product publisher, artifact build or host runs.
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
        rootDir: root,
      }),
      "utf8",
    );

    const genBDir = path.join(cacheDir, `gen-${genB}`);
    fs.mkdirSync(genBDir, { recursive: true });
    fs.writeFileSync(path.join(genBDir, "index.js"), "exports.value = 'B';\n");

    // Marker still names A: the reader must return the complete A, never a
    // BuiltProject pointing at the unpublished B directory.
    const midRebuild = readDependencyCache(cacheDir, metaPath);
    assert.notEqual(midRebuild, null, "reader should still hit generation A");
    assert.equal(midRebuild!.emitDir, genADir);

    const temporaryMarker = metaPath + ".tmp";
    fs.writeFileSync(temporaryMarker, JSON.stringify({
      generation: genB, moduleOptions: { module: "commonjs" },
      emittedSources: {}, outputs: ["index.js"], rootDir: root,
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
        rootDir: root,
      }),
      "utf8",
    );
    assert.equal(readDependencyCache(cacheDir, metaPath), null);
  }

import { TestProject } from "@ttsc/testing";

import {
  assert,
  dependencyCacheLibraryPath,
  fs,
  path,
  readDependencyCache,
  spawnNodeWorker,
  waitForCondition,
} from "../../internal/dependency-cache";

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
 * 2. A holder builds generation B, writes its first file, and halts at a
 *    barrier before publishing B's marker; the reader observes A only.
 * 3. Release the holder to swap the marker atomically; the reader now observes
 *    the complete B and never a directory that lacks emitted JavaScript.
 */
export const test_ttsx_dependency_cache_reader_never_mixes_metadata_with_a_partial_emit =
  async () => {
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
      JSON.stringify({ generation: genA, moduleOption: "commonjs", rootDir: "/root" }),
      "utf8",
    );

    const barrierFile = path.join(root, "partial-b");
    const releaseFile = path.join(root, "publish-b");
    const builderScript = path.join(root, "builder.cjs");
    // The library is required only so the worker fails loudly if the built
    // module is missing; the atomic swap it performs mirrors
    // `publishDependencyMeta` exactly.
    fs.writeFileSync(
      builderScript,
      [
        `const fs = require("node:fs");`,
        `const path = require("node:path");`,
        `require(${JSON.stringify(dependencyCacheLibraryPath())});`,
        `const cacheDir = ${JSON.stringify(cacheDir)};`,
        `const metaPath = ${JSON.stringify(metaPath)};`,
        `const genB = ${JSON.stringify(genB)};`,
        `const genBDir = path.join(cacheDir, "gen-" + genB);`,
        `fs.mkdirSync(genBDir, { recursive: true });`,
        // First file of generation B, marker not yet published.
        `fs.writeFileSync(path.join(genBDir, "index.js"), "exports.value = 'B';\\n");`,
        `fs.writeFileSync(${JSON.stringify(barrierFile)}, "partial\\n", "utf8");`,
        `const deadline = Date.now() + 120000;`,
        `while (!fs.existsSync(${JSON.stringify(releaseFile)})) {`,
        `  if (Date.now() > deadline) throw new Error("timed out waiting to publish");`,
        `  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);`,
        `}`,
        `const tmp = metaPath + ".tmp";`,
        `fs.writeFileSync(tmp, JSON.stringify({ generation: genB, moduleOption: "commonjs", rootDir: "/root" }), "utf8");`,
        `fs.renameSync(tmp, metaPath);`,
        ``,
      ].join("\n"),
      "utf8",
    );

    const builder = spawnNodeWorker({ script: builderScript });
    await waitForCondition(
      () => fs.existsSync(barrierFile),
      "generation B partial emit",
    );

    // Marker still names A: the reader must return the complete A, never a
    // BuiltProject pointing at the partially-written B directory.
    const midRebuild = readDependencyCache(cacheDir, metaPath);
    assert.notEqual(midRebuild, null, "reader should still hit generation A");
    assert.equal(midRebuild!.emitDir, genADir);

    fs.writeFileSync(releaseFile, "publish\n", "utf8");
    const built = await builder;
    assert.equal(built.status, 0, built.stderr);

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
      JSON.stringify({ generation: genC, moduleOption: "commonjs", rootDir: "/root" }),
      "utf8",
    );
    assert.equal(readDependencyCache(cacheDir, metaPath), null);
  };

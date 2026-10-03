import { TestProject } from "../../../../utils/src/TestProject";

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { readDependencyCache } from "../../../../../packages/ttsc/src/launcher/internal/runtime/readDependencyCache";

/**
 * Verifies a dependency-cache marker that carries no `moduleOptions` object is
 * rejected rather than read as "no options".
 *
 * The marker gained `moduleOptions` when the format classifier started needing
 * `target` as well as `module`. A marker written before that says nothing about
 * either. The reader must reject that missing schema even when the referenced
 * generation contains JavaScript. This unit observes the cache miss and
 * acceptance after the options object is supplied, without running a rebuild,
 * format classification, or a cross-version process.
 *
 * 1. Seed a complete generation whose marker uses the superseded field name.
 * 2. Read the cache.
 * 3. Assert the read misses, then assert the same generation hits once its marker
 *    carries an object, so the rejection is the field's doing and not the
 *    generation's.
 *
 * @evidence contracts/testing.md#behavioral-verification The real reader rejects a legacy schema and accepts the identical generation only after moduleOptions is supplied.
 * @evidence contracts/testing.md#independent-expectations The published marker schema independently requires an options object; equal generation bytes rule out unrelated cache corruption.
 * @evidence contracts/testing.md#distinguishing-cases Absent options miss and present CommonJS options hit with the exact generation path.
 * @evidence contracts/testing.md#execution-ownership The named source-unit entry calls authored production functions directly; temporary fixture files are inputs, with no compiler build, consumer installation or product host.
 */
export function test_ttsx_dependency_cache_rejects_a_marker_without_module_options() {
    const root = TestProject.tmpdir("ttsx-depcache-schema-");
    const cacheDir = path.join(root, "entry");
    const metaPath = path.join(root, "entry.json");
    const generation = "d".repeat(32);
    const generationDir = path.join(cacheDir, `gen-${generation}`);

    fs.mkdirSync(generationDir, { recursive: true });
    fs.writeFileSync(
      path.join(generationDir, "index.js"),
      "exports.value = 'legacy';\n",
    );

    fs.writeFileSync(
      metaPath,
      JSON.stringify({
        generation,
        moduleOption: "commonjs",
        emittedSources: {},
        outputs: ["index.js"],
        rootDir: root,
      }),
      "utf8",
    );
    assert.equal(
      readDependencyCache(cacheDir, metaPath),
      null,
      "a marker without moduleOptions must not be reused",
    );

    fs.writeFileSync(
      metaPath,
      JSON.stringify({
        generation,
        moduleOptions: { module: "commonjs" },
        emittedSources: {},
        outputs: ["index.js"],
        rootDir: root,
      }),
      "utf8",
    );
    const reused = readDependencyCache(cacheDir, metaPath);
    assert.notEqual(
      reused,
      null,
      "the same generation must hit once described",
    );
    assert.equal(reused!.emitDir, generationDir);
    assert.deepEqual(reused!.moduleOptions, { module: "commonjs" });
}

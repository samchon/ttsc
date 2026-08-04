import { TestProject } from "@ttsc/testing";

import {
  assert,
  fs,
  path,
  readDependencyCache,
} from "../../internal/dependency-cache";

/**
 * Verifies a dependency-cache marker that carries no `moduleOptions` object is
 * rejected rather than read as "no options".
 *
 * The marker gained `moduleOptions` when the format classifier started needing
 * `target` as well as `module`. A marker written before that says nothing about
 * either, and the persistent fallback cache under the system temp directory
 * outlives an upgrade, so an older marker can meet newer code. Treating its
 * silence as an empty option set would derive the modern default and classify a
 * CommonJS emit as an ES module — a wrong format taken from a complete, valid
 * looking generation. Rejecting it costs one rebuild and cannot be wrong.
 *
 * 1. Seed a complete generation whose marker uses the superseded field name.
 * 2. Read the cache.
 * 3. Assert the read misses, then assert the same generation hits once its marker
 *    carries an object, so the rejection is the field's doing and not the
 *    generation's.
 */
export const test_ttsx_dependency_cache_rejects_a_marker_without_module_options =
  () => {
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
        rootDir: "/root",
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
        rootDir: "/root",
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
  };

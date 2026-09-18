import { TestProject } from "@ttsc/testing";

import {
  assert,
  fs,
  path,
  readDependencyCache,
} from "../../internal/dependency-cache";

/**
 * Verifies a dependency-cache marker that carries no output record is rejected
 * rather than trusted.
 *
 * Ownership of a dependency file is decided against the record a build takes of
 * its own outputs, not against the disk at lookup time (samchon/ttsc#1382). A
 * marker written before the record existed says nothing about what its
 * generation compiled, and the persistent fallback cache under the system temp
 * directory outlives an upgrade, so such a marker can meet newer code. Reusing
 * it would decide ownership from nothing; rejecting it costs one rebuild.
 *
 * 1. Seed a complete generation whose marker has no `outputs`, then one whose
 *    `outputs` is not a list of strings.
 * 2. Read the cache after each.
 * 3. Assert both reads miss, then assert the same generation hits with its record,
 *    which the read hands back unchanged.
 */
export const test_ttsx_dependency_cache_rejects_a_marker_without_an_output_record =
  () => {
    const root = TestProject.tmpdir("ttsx-depcache-outputs-");
    const cacheDir = path.join(root, "entry");
    const metaPath = path.join(root, "entry.json");
    const generation = "f".repeat(32);
    const generationDir = path.join(cacheDir, `gen-${generation}`);

    fs.mkdirSync(path.join(generationDir, "lib"), { recursive: true });
    fs.writeFileSync(
      path.join(generationDir, "lib", "index.js"),
      "exports.value = 'recorded';\n",
    );
    const marker = (outputs: unknown): void =>
      fs.writeFileSync(
        metaPath,
        JSON.stringify({
          generation,
          moduleOptions: { module: "commonjs" },
          ...(outputs === undefined ? {} : { outputs }),
          rootDir: root,
        }),
        "utf8",
      );

    marker(undefined);
    assert.equal(
      readDependencyCache(cacheDir, metaPath),
      null,
      "a marker without an output record must not be reused",
    );

    marker(["lib/index.js", 1]);
    assert.equal(
      readDependencyCache(cacheDir, metaPath),
      null,
      "a malformed output record must not be reused",
    );

    marker(["lib/index.js"]);
    const reused = readDependencyCache(cacheDir, metaPath);
    assert.notEqual(reused, null, "the same generation must hit once recorded");
    assert.equal(reused!.emitDir, generationDir);
    assert.deepEqual(reused!.outputs, ["lib/index.js"]);
  };

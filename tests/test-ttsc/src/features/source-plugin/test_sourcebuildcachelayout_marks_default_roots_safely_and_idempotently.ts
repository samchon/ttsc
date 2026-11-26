import { resolveSourceBuildCachePaths } from "../../../../../packages/ttsc/src/plugin/internal/source/resolveSourceBuildCachePaths";
import { TestProject } from "../../../../utils/src/TestProject";
import {
  SourceBuildCacheLayout,
  assert,
  fs,
  path,
} from "../../internal/source-build-unit";

/**
 * Verifies SourceBuildCacheLayout: marks default roots safely and idempotently.
 *
 * Concurrent first writers may race to publish the ownership marker. Repeating
 * the operation must accept the ordinary file, while a pre-existing directory
 * at the marker path must never be followed or silently trusted.
 *
 * 1. Create an empty cache root and assert the one-snapshot predicate accepts it.
 * 2. Mark it twice and assert the published marker remains accepted.
 * 3. Replace the marker with a directory and assert marking rejects it.
 * 4. Redirect the default cache parent into src and verify placement and
 *    publication both refuse it without writing anything there.
 *
 * @evidence contracts/testing.md#behavioral-verification SourceBuildCacheLayout marks an empty fixture cache twice and rejects a marker directory. A real symlink or junction is refused at default selection and marker publication while the destination remains empty.
 * @evidence contracts/testing.md#independent-expectations The persisted workspace-marker contract independently requires empty/marked roots to be accepted and a directory marker to be rejected.
 * @evidence contracts/testing.md#distinguishing-cases Empty, marked and directory-marker states exercise the existing ownership contract. A redirected cache parent exercises pre-write physical containment independently of the marker shape.
 * @evidence contracts/testing.md#execution-ownership A unit test calling SourceBuildCacheLayout.markDefaultWorkspaceCacheRoot and its predicate directly on a temp directory; no consumer, native build or host is involved.
 */
export const test_sourcebuildcachelayout_marks_default_roots_safely_and_idempotently =
  () => {
    const workspace = TestProject.tmpdir("ttsc-workspace-cache-marker-");
    const root = path.join(workspace, "node_modules", ".cache", "ttsc");
    fs.mkdirSync(root, { recursive: true });
    assert.equal(
      SourceBuildCacheLayout.isEmptyOrMarkedDefaultWorkspaceCacheRoot(root),
      true,
    );

    SourceBuildCacheLayout.markDefaultWorkspaceCacheRoot(root);
    SourceBuildCacheLayout.markDefaultWorkspaceCacheRoot(root);
    assert.equal(
      SourceBuildCacheLayout.isEmptyOrMarkedDefaultWorkspaceCacheRoot(root),
      true,
    );

    const marker = path.join(root, ".workspace-root");
    fs.rmSync(marker);
    fs.mkdirSync(marker);
    assert.equal(
      SourceBuildCacheLayout.isEmptyOrMarkedDefaultWorkspaceCacheRoot(root),
      false,
    );
    assert.throws(
      () => SourceBuildCacheLayout.markDefaultWorkspaceCacheRoot(root),
      /unsafe workspace cache marker/,
    );

    const visible = path.join(workspace, "src");
    const cacheParent = path.dirname(root);
    fs.mkdirSync(visible);
    fs.rmSync(cacheParent, { recursive: true });
    fs.symlinkSync(
      visible,
      cacheParent,
      process.platform === "win32" ? "junction" : "dir",
    );
    try {
      assert.throws(
        () => resolveSourceBuildCachePaths(workspace, undefined, {}),
        /unsafe default workspace cache directory/,
      );
      assert.throws(
        () => SourceBuildCacheLayout.markDefaultWorkspaceCacheRoot(root),
        /unsafe default workspace cache directory/,
      );
      assert.deepEqual(fs.readdirSync(visible), []);
    } finally {
      fs.unlinkSync(cacheParent);
    }
  };

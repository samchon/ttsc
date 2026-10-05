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
 *
 * @evidence contracts/testing.md#behavioral-verification SourceBuildCacheLayout marks an empty fixture cache twice and rejects a marker directory; the three literal predicate results and unsafe-marker throw detect unsafe ownership admission.
 * @evidence contracts/testing.md#independent-expectations The persisted workspace-marker contract independently requires empty/marked roots to be accepted and a directory marker to be rejected.
 * @evidence contracts/testing.md#distinguishing-cases Three states in sequence on one root: empty, marked twice (second call accepts the existing marker file), and a directory sitting at the marker path, which makes the predicate false and the mark call throw. Concurrent publication and symlink markers are not exercised.
 * @evidence contracts/testing.md#execution-ownership A unit test calling SourceBuildCacheLayout.markDefaultWorkspaceCacheRoot and its predicate directly on a temp directory; no consumer, native build or host is involved.
 */
export const test_sourcebuildcachelayout_marks_default_roots_safely_and_idempotently =
  () => {
    const root = TestProject.tmpdir("ttsc-workspace-cache-marker-");
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
  };

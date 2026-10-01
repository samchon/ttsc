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
 * @evidence contracts/testing.md#distinguishing-cases Empty, repeatedly marked and directory-collision states exercise initial publication, idempotent reuse and unsafe metadata; process-owner races remain in native lock boundaries.
 * @evidence contracts/testing.md#execution-ownership test_sourcebuildcachelayout_marks_default_roots_safely_and_idempotently is a named source-unit entry discovered in src/features/source-plugin; direct owning operations use disposable fixture directories without installing a consumer, building native code or starting a product host.
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

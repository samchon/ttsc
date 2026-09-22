import { TestProject } from "@ttsc/testing";

import {
  SourceBuildCacheLayout,
  assert,
  fs,
  path,
} from "../../internal/source-build";

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

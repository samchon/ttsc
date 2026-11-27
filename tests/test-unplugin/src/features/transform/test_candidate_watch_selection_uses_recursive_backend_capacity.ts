import assert from "node:assert/strict";
import path from "node:path";

import { selectNotifiableAbsentInputs } from "../../../../../packages/unplugin/src/core/transform/envelope/selectNotifiableAbsentInputs";
import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../packages/unplugin/src/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import { createCachedDeliveryUnitFixture } from "../../internal/transform-project-cache/createCachedDeliveryUnitFixture";

/**
 * Verifies the directory limit applies where the backend can allocate one
 * watcher per directory.
 *
 * 1. Author absent file observations in 513 distinct project directories.
 * 2. Check native recursive selection and the supplied per-directory view.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual candidate selection accepts the recorded candidate spellings when the native broker is available and declines the oversized selection for a custom watcher.
 * @evidence contracts/testing.md#independent-expectations The authored 513 distinct directories exceed the 512 allocation policy. Independently joined native paths define the selected candidates.
 * @evidence contracts/testing.md#distinguishing-cases The candidate corpus is identical between supported native Windows or macOS recursion and a supplied watch capability. Other native hosts also retain the per-directory limit.
 * @evidence contracts/testing.md#execution-ownership One unit calls the source selector over the ordinary fixture. The supplied watch function must never run because selection does not acquire handles.
 */
export function test_candidate_watch_selection_uses_recursive_backend_capacity(): void {
  const fixture = createCachedDeliveryUnitFixture();
  const projectRoot = fixture.good.projectRoot;
  const candidates = Array.from({ length: 513 }, (_, index) =>
    path.join("dependencies", `d${index}`, "model.ts"),
  );
  const result = {
    ...fixture.good.result,
    graph: {
      edges: {},
      globals: [],
      configs: [],
      candidates: { "src/main.ts": candidates },
      inputObservations: Object.fromEntries(
        candidates.map((file) => [file, { fileExists: false }]),
      ),
    },
  };
  try {
    const native = selectNotifiableAbsentInputs({
      filesystem: DEFAULT_FILESYSTEM_OPERATIONS,
      projectRoot,
      result,
    });
    if (process.platform === "win32" || process.platform === "darwin") {
      assert.deepEqual(
        native.candidates,
        candidates.map((file) => path.join(projectRoot, file)).sort(),
      );
    } else {
      assert.deepEqual(native, { candidates: [], watched: [] });
    }
    assert.deepEqual(
      selectNotifiableAbsentInputs({
        filesystem: {
          ...DEFAULT_FILESYSTEM_OPERATIONS,
          watch: () => assert.fail("selection does not open watchers"),
        },
        projectRoot,
        result,
      }),
      { candidates: [], watched: [] },
    );
  } finally {
    fixture.dispose();
  }
}

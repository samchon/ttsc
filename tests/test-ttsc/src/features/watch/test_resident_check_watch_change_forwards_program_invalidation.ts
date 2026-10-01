import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import path from "node:path";

import { residentCheckRequest } from "../../../../../packages/ttsc/src/compiler/internal/build/residentCheckRequest";
import { PendingResidentCheckWatchChanges } from "../../../../../packages/ttsc/src/launcher/internal/PendingResidentCheckWatchChanges";

/**
 * Verifies project-input invalidation survives the CLI watch debounce.
 *
 * The topology emits a WatchInputChange, runTtsc coalesces it into a
 * ResidentCheckWatchChange, and the build coordinator serializes the same
 * signal into the resident request. Full reload remains stronger, while an
 * ordinary content edit carries changed/external paths without invalidation.
 *
 * 1. Coalesce invalidating and data-only project-input events.
 * 2. Forward the resulting paths and invalidation bit to the sidecar request.
 * 3. Prove a full reload dominates and drains all narrower pending state.
 *
 * @evidence contracts/testing.md#behavioral-verification PendingResidentCheckWatchChanges and residentCheckRequest retain invalidation and changed/external paths, drain state and make full reload dominate.
 * @evidence contracts/testing.md#independent-expectations Authored event kinds and literal expected request objects establish that invalidation survives coalescing while content-only edits remain warm.
 * @evidence contracts/testing.md#distinguishing-cases Invalidating and data-only project-input events coalesce into different resident requests, and a full reload dominates and drains every narrower pending change.
 * @evidence contracts/testing.md#execution-ownership This matching src/features/watch entry exercises the owning operations directly on isolated fixture inputs; no product host, native artifact build or consumer installation executes.
 */
export const test_resident_check_watch_change_forwards_program_invalidation =
  (): void => {
    const root = TestProject.tmpdir("ttsc-resident-watch-change-");
    const json = path.join(root, "api", "openapi.json");
    const markdown = path.join(root, "docs", "spec.md");
    const pending = new PendingResidentCheckWatchChanges();

    pending.push({ invalidate: true, kind: "project", path: json });
    pending.push({ kind: "project", path: markdown });
    const topologyChange = pending.take();
    assert.deepEqual(topologyChange, {
      invalidate: true,
      changed: [json, markdown].sort(),
      external: [json, markdown].sort(),
    });
    assert.deepEqual(residentCheckRequest(topologyChange, root), {
      invalidate: true,
      changed: [json, markdown].sort(),
      external: [json, markdown].sort(),
    });
    assert.deepEqual(pending.take(), {}, "taking a cycle must drain its state");

    pending.push({ kind: "project", path: json });
    assert.deepEqual(
      residentCheckRequest(pending.take(), root),
      { changed: [json], external: [json] },
      "content-only JSON edits must remain warm external updates",
    );

    pending.push({ invalidate: true, kind: "project" });
    assert.deepEqual(
      residentCheckRequest(pending.take(), root),
      { invalidate: true },
      "filename-less membership invalidation must survive without a path",
    );

    pending.push({ invalidate: true, kind: "project", path: json });
    pending.push({ kind: "config", path: path.join(root, "tsconfig.json") });
    assert.deepEqual(
      pending.take(),
      { reload: true },
      "execution reload must dominate and clear narrower pending state",
    );
  };

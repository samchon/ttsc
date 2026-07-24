import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import path from "node:path";

import { residentCheckRequest } from "../../../../../packages/ttsc/lib/compiler/internal/runBuild.js";
import { PendingResidentCheckWatchChanges } from "../../../../../packages/ttsc/lib/launcher/internal/runTtsc.js";

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

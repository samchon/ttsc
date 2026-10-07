import assert from "node:assert/strict";
import path from "node:path";

import { residentCheckRequest } from "../../../../../packages/ttsc/src/compiler/internal/build/residentCheckRequest";
import { PendingResidentCheckWatchChanges } from "../../../../../packages/ttsc/src/launcher/internal/PendingResidentCheckWatchChanges";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies classified watch changes survive coalescing and wire conversion.
 *
 * Direct accumulator and wire-adapter calls preserve the classified signal.
 * Full reload remains stronger, while an ordinary content edit carries paths
 * without invalidation. This unit does not run the topology or CLI scheduler.
 *
 * 1. Coalesce invalidating and data-only events, including duplicate paths.
 * 2. Normalize relative aliases into independently specified wire paths.
 * 3. Exercise each reload trigger and prove draining starts a fresh batch.
 *
 * @evidence contracts/testing.md#behavioral-verification PendingResidentCheckWatchChanges and residentCheckRequest retain invalidation and changed/external paths, drain state and make full reload dominate.
 * @evidence contracts/testing.md#independent-expectations Authored event kinds and literal expected request objects define changed/external membership and escalation independently. Native root joins specify the absolute destinations of dot/parent aliases without asking the adapter to compute its own expectations.
 * @evidence contracts/testing.md#distinguishing-cases Invalidating/data-only/compiler events, repeated spellings, project membership for the same compiler path, config/plugin/explicit/unnamed-compiler reload, reload followed by narrower events, post-drain batches, relative aliases and empty/false wire fields distinguish separate branches; input arrays remain unchanged.
 * @evidence contracts/testing.md#execution-ownership This matching src/features/watch entry calls the actual accumulator and wire adapter directly. Independent scenario failures aggregate; no topology, CLI scheduler, sidecar, native artifact build or consumer installation executes.
 */
export const test_resident_check_watch_change_forwards_program_invalidation =
  (): void => {
    const root = TestProject.tmpdir("ttsc-resident-watch-change-");
    const json = path.join(root, "api", "openapi.json");
    const markdown = path.join(root, "docs", "spec.md");
    const pending = new PendingResidentCheckWatchChanges();
    const failures: Error[] = [];
    const check = (name: string, verify: () => void): void => {
      try {
        verify();
      } catch (cause) {
        failures.push(new Error(name, { cause }));
      }
    };

    check("original invalidation and reload distinctions", () => {
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
      assert.deepEqual(
        pending.take(),
        {},
        "taking a cycle must drain its state",
      );

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
    });

    check("duplicate paths and independent external membership", () => {
      const batch = new PendingResidentCheckWatchChanges();
      batch.push({ kind: "compiler", path: markdown });
      batch.push({ kind: "compiler", path: json });
      batch.push({ kind: "compiler", path: json });
      assert.deepEqual(batch.take(), { changed: [json, markdown] });
      batch.push({ kind: "compiler", path: json });
      batch.push({ kind: "project", path: json });
      batch.push({ kind: "project", path: json });
      assert.deepEqual(batch.take(), { changed: [json], external: [json] });
      assert.deepEqual(batch.take(), {});
      batch.push({ kind: "compiler", path: markdown });
      assert.deepEqual(batch.take(), { changed: [markdown] });
    });

    for (const trigger of ["config", "plugin", "explicit", "compiler"] as const)
      check(`reload trigger ${trigger}`, () => {
        const batch = new PendingResidentCheckWatchChanges();
        batch.push({ invalidate: true, kind: "project", path: json });
        if (trigger === "explicit") batch.push(undefined, true);
        else batch.push({ kind: trigger });
        batch.push({ invalidate: true, kind: "project", path: markdown });
        batch.push({ kind: "compiler", path: json });
        assert.deepEqual(batch.take(), { reload: true });
        assert.deepEqual(batch.take(), {});
        batch.push({ kind: "project", path: markdown });
        assert.deepEqual(batch.take(), {
          changed: [markdown],
          external: [markdown],
        });
      });

    check("wire alias normalization and input preservation", () => {
      const changed = [
        "docs/../api/openapi.json",
        json,
        "./docs/spec.md",
        "api/./openapi.json",
      ];
      const external = ["./docs/spec.md", markdown];
      const input = { changed, external, invalidate: false, reload: true };
      assert.deepEqual(residentCheckRequest(input, root), {
        changed: [json, markdown],
        external: [markdown],
      });
      assert.deepEqual(input, {
        changed: [
          "docs/../api/openapi.json",
          json,
          "./docs/spec.md",
          "api/./openapi.json",
        ],
        external: ["./docs/spec.md", markdown],
        invalidate: false,
        reload: true,
      });
      assert.deepEqual(
        residentCheckRequest(
          { changed: [], external: [], invalidate: false },
          root,
        ),
        {},
      );
      assert.deepEqual(residentCheckRequest({ reload: true }, root), {});
      assert.deepEqual(residentCheckRequest({}, root), {});
    });
    if (failures.length)
      throw new AggregateError(
        failures,
        "resident watch change distinctions failed",
      );
  };

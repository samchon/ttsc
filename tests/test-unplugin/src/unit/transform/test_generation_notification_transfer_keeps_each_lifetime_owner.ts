import assert from "node:assert/strict";
import path from "node:path";

import { createTtscTransformCache } from "../../../../../packages/unplugin/src/core/transform/cache/createTtscTransformCache";
import { transformFilesystem } from "../../../../../packages/unplugin/src/core/transform/cache/transformFilesystem";
import { generationNotificationsAvailable, retainGenerationNotifications } from "../../../../../packages/unplugin/src/core/transform/generation/retainGenerationNotifications";
import { createHostInputMutationTracker } from "../../../../../packages/unplugin/src/core/transform/tracker/createHostInputMutationTracker";
import { createProjectMutationTracker } from "../../../../../packages/unplugin/src/core/transform/tracker/createProjectMutationTracker";
import { createCachedDeliveryUnitFixture } from "../../internal/transform-project-cache/createCachedDeliveryUnitFixture";
import { observeValidationUnitGeneration } from "../../internal/transform-project-cache/observeValidationUnitGeneration";

/**
 * Verify notification admission transfers every qualified observer and no unqualified one.
 *
 * Supported filesystem providers construct actual tracker objects and can
 * refuse registration at a chosen phase. The transfer operation then consumes
 * its production policies and sampled availability. This source unit proves
 * handle identity and cleanup ownership, not a native compiler publication.
 *
 * 1. Construct real trackers with each registration phase healthy or refused.
 * 2. Apply retention policies and inspect each transferred handle and flag.
 * 3. Close the trackers and assert every acquired observer retires.
 *
 * @evidence contracts/testing.md#behavioral-verification The production availability sampler and notification transfer gate attach exact project/host/candidate handles only when membership retention, notification policy, stable snapshot and all present observer health qualify together; a lone candidate's cleanup flag remains independently retained.
 * @evidence contracts/testing.md#independent-expectations Literal all-false or exact-presence ownership flags follow the conjunction of the four admission premises. Actual tracker constructors report phase-specific refused registration, and the provider's opened/closed ledger independently verifies all acquired handles retire after each variant.
 * @evidence contracts/testing.md#distinguishing-cases Healthy three-handle transfer contrasts with each of three individual registration failures, disabled membership retention, polling policy, incomplete snapshot, no candidate and candidate-only retention. A failed sibling must withdraw every attachment; absent optional trackers are not fabricated failures.
 * @evidence contracts/testing.md#execution-ownership This named source unit invokes actual tracker constructors and synchronous production transfer owners over consumer snapshot data without native compilation or OS-event success claims. The surviving native candidate coverage case owns compiler-to-observer assembly; source unit output flags retain the capture caller's individual finally-cleanup responsibilities.
 */
export async function test_generation_notification_transfer_keeps_each_lifetime_owner(): Promise<void> {
  const failures: Error[] = [];
  for (const variant of ["healthy", "project-failed", "host-failed", "candidate-failed", "membership-off", "polling", "incomplete", "no-candidate", "candidate-only"] as const) {
    const fixture = createCachedDeliveryUnitFixture();
    const root = path.dirname(path.dirname(fixture.file));
    const config = path.join(root, "tsconfig.json");
    const candidate = path.join(root, "node_modules", "probe", "index.ts");
    let phase = "project";
    let opened = 0;
    let closed = 0;
    const cache = createTtscTransformCache({
      watch: () => {
        if (variant === phase + "-failed") {
          const error = new Error("watch registration refused") as NodeJS.ErrnoException;
          error.code = "ENOSPC";
          throw error;
        }
        opened += 1;
        let active = true;
        return { close: () => { if (active) { active = false; closed += 1; } } };
      },
    });
    const filesystem = transformFilesystem(cache);
    const cached = observeValidationUnitGeneration(root, fixture.good.result);
    const trackers: Awaited<ReturnType<typeof createProjectMutationTracker>>[] = [];
    try {
      const project = await createProjectMutationTracker(cached.projectDirectories!, new Set([fixture.file]), filesystem, cached.membershipPolicy);
      trackers.push(project);
      phase = "host";
      const host = await createHostInputMutationTracker([config], filesystem, new Set([config]), "all", root);
      trackers.push(host);
      phase = "candidate";
      const absent = await createHostInputMutationTracker([candidate], filesystem, new Set([candidate]), "rename", root);
      trackers.push(absent);
      const selectedProject = variant === "candidate-only" ? undefined : project;
      const selectedHost = variant === "candidate-only" ? undefined : host;
      const selectedCandidate = variant === "no-candidate" ? undefined : absent;
      const available = generationNotificationsAvailable(selectedProject, selectedHost, selectedCandidate);
      assert.equal(available, !variant.endsWith("-failed"));
      const retained = retainGenerationNotifications({
        cached, project: selectedProject, host: selectedHost, candidate: selectedCandidate,
        retainProjectMembership: variant !== "membership-off",
        retainNotifications: variant !== "polling",
        stableProjectSnapshot: variant !== "incomplete",
        notificationsAvailable: available,
      });
      const admitted = ["healthy", "no-candidate", "candidate-only"].includes(variant);
      assert.deepEqual(retained, {
        project: admitted && selectedProject !== undefined,
        host: admitted && selectedHost !== undefined,
        candidate: admitted && selectedCandidate !== undefined,
      });
      assert.equal(cached.projectMutationTracker, admitted ? selectedProject : undefined);
      assert.equal(cached.hostInputMutationTracker, admitted ? selectedHost : undefined);
      assert.equal(cached.candidateMutationTracker, admitted ? selectedCandidate : undefined);
    } catch (error) {
      failures.push(new Error(variant, { cause: error }));
    } finally {
      for (const tracker of trackers) tracker.close();
      fixture.dispose();
    }
    try { assert.equal(closed, opened, variant + ": every actual acquired observer retires"); }
    catch (error) { failures.push(new Error(variant + " cleanup", { cause: error })); }
  }
  if (failures.length !== 0) throw new AggregateError(failures, "Notification transfer variants failed");
}

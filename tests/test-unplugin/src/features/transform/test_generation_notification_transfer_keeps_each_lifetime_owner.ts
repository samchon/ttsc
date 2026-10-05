import assert from "node:assert/strict";
import path from "node:path";

import { createTtscTransformCache } from "../../../../../packages/unplugin/src/core/transform/cache/createTtscTransformCache";
import { transformFilesystem } from "../../../../../packages/unplugin/src/core/transform/cache/transformFilesystem";
import { envelopeDerivation } from "../../../../../packages/unplugin/src/core/transform/envelope/envelopeDerivation";
import { createGenerationProofFailures } from "../../../../../packages/unplugin/src/core/transform/generation/createGenerationProofFailures";
import { projectWalkStable } from "../../../../../packages/unplugin/src/core/transform/generation/projectWalkStable";
import { recordProjectSnapshotFailures } from "../../../../../packages/unplugin/src/core/transform/generation/recordProjectSnapshotFailures";
import {
  generationNotificationsAvailable,
  retainGenerationNotifications,
} from "../../../../../packages/unplugin/src/core/transform/generation/retainGenerationNotifications";
import { collectProjectInputSnapshot } from "../../../../../packages/unplugin/src/core/transform/project/collectProjectInputSnapshot";
import { createHostInputMutationTracker } from "../../../../../packages/unplugin/src/core/transform/tracker/createHostInputMutationTracker";
import { createProjectMutationTracker } from "../../../../../packages/unplugin/src/core/transform/tracker/createProjectMutationTracker";
import { createCachedDeliveryUnitFixture } from "../../internal/transform-project-cache/createCachedDeliveryUnitFixture";
import { observeValidationUnitGeneration } from "../../internal/transform-project-cache/observeValidationUnitGeneration";

/**
 * Verifies notification admission transfers every qualified observer and no
 * unqualified one.
 *
 * Supported filesystem providers construct actual tracker objects and can
 * refuse registration at a chosen phase. The transfer operation then consumes
 * its production policies and sampled availability. This source unit proves
 * handle identity and cleanup ownership, not a native compiler publication.
 *
 * 1. Construct real trackers with each registration phase healthy or refused.
 * 2. Apply retention policies and inspect each transferred handle and flag.
 * 3. Deliver two later notification events, then the same event to the project
 *    witness, and distinguish stable walks from a project membership failure.
 * 4. Close the trackers and assert every acquired observer retires.
 *
 * @evidence contracts/testing.md#behavioral-verification The production availability sampler and notification transfer gate attach exact project/host/candidate handles only when membership retention, notification policy, stable snapshot and all present observer health qualify together; a lone candidate's cleanup flag remains independently retained.
 *   In the healthy variant, two actual host/candidate constructor callbacks receive rename(null) while the project witness stays quiet; projectWalkStable accepts unchanged native before/after walks. Delivering the same event to the constructed project tracker refutes them, and recordProjectSnapshotFailures records only the project membership event.
 * @evidence contracts/testing.md#independent-expectations Expected ownership flags are computed in the test from an authored list of admitted variants (healthy, no-candidate, candidate-only) and from which trackers were passed in, mirroring the conjunction of the four admission premises rather than reading it from the owner. Actual tracker constructors report phase-specific refused registration, and the provider's opened/closed ledger independently verifies all acquired handles retire after each variant.
 *   Literal two delivered notification callbacks, stable true versus false, and the exact singleton project/project-membership-event/root failure distinguish observer roles independently of native compilation. Native walks supply unchanged observations, not the expected verdict.
 * @evidence contracts/testing.md#distinguishing-cases Healthy three-handle transfer contrasts with each of three individual registration failures, disabled membership retention, polling policy, incomplete snapshot, no candidate and candidate-only retention. A failed sibling must withdraw every attachment; absent optional trackers are not fabricated failures.
 *   Later host/candidate event witnesses contrast with the project witness under identical file bytes and directory observations; those later tracker mutations still remain available for notification transfer rather than being erased.
 * @evidence contracts/testing.md#execution-ownership Unit test: nine variants run in one loop, each with its own temporary fixture and a counting watch seam. They call the real createProjectMutationTracker and createHostInputMutationTracker, generationNotificationsAvailable and retainGenerationNotifications over a handwritten generation observed from real fixture files. No compiler runs and no OS notification is awaited; the loop collects failures per variant into an AggregateError.
 *   The caller explicitly assigns observer roles and invokes supported callbacks. This row owns the project comparison/diagnostic and notification transfer policies, not capture phase acquisition, SDK publication, per-compile open/close assembly or OS delivery authority.
 */
export async function test_generation_notification_transfer_keeps_each_lifetime_owner(): Promise<void> {
  const failures: Error[] = [];
  for (const variant of [
    "healthy",
    "project-failed",
    "host-failed",
    "candidate-failed",
    "membership-off",
    "polling",
    "incomplete",
    "no-candidate",
    "candidate-only",
  ] as const) {
    const fixture = createCachedDeliveryUnitFixture();
    const root = path.dirname(path.dirname(fixture.file));
    const config = path.join(root, "tsconfig.json");
    const candidate = path.join(root, "node_modules", "probe", "index.ts");
    let phase = "project";
    let opened = 0;
    let closed = 0;
    const listeners = new Map<
      string,
      ((eventType: string, filename: string | null) => void)[]
    >();
    const cache = createTtscTransformCache({
      watch: (_directory, listener) => {
        if (variant === phase + "-failed") {
          const error = new Error(
            "watch registration refused",
          ) as NodeJS.ErrnoException;
          error.code = "ENOSPC";
          throw error;
        }
        opened += 1;
        const phaseListeners = listeners.get(phase) ?? [];
        phaseListeners.push(listener);
        listeners.set(phase, phaseListeners);
        let active = true;
        return {
          close: () => {
            if (active) {
              active = false;
              closed += 1;
            }
          },
        };
      },
    });
    const filesystem = transformFilesystem(cache);
    const cached = observeValidationUnitGeneration(root, fixture.good.result);
    const trackers: Awaited<ReturnType<typeof createProjectMutationTracker>>[] =
      [];
    try {
      const project = await createProjectMutationTracker(
        cached.projectDirectories!,
        new Set([fixture.file]),
        filesystem,
        cached.membershipPolicy,
      );
      trackers.push(project);
      phase = "host";
      const host = await createHostInputMutationTracker(
        [config],
        filesystem,
        new Set([config]),
        "all",
        root,
      );
      trackers.push(host);
      phase = "candidate";
      const absent = await createHostInputMutationTracker(
        [candidate],
        filesystem,
        new Set([candidate]),
        "rename",
        root,
      );
      trackers.push(absent);
      if (variant === "healthy") {
        const identities = envelopeDerivation(cached).identityContext;
        const before = collectProjectInputSnapshot(
          root,
          identities,
          filesystem,
          undefined,
          { policy: cached.membershipPolicy },
        );
        assert.equal(before.complete, true);
        let deliveredPostEvents = 0;
        for (const role of ["host", "candidate"]) {
          const callbacks = listeners.get(role)!;
          assert.equal(
            callbacks.length,
            1,
            role + ": one supplied observation handle",
          );
          queueMicrotask(() => {
            callbacks[0]!("rename", null);
            ++deliveredPostEvents;
          });
        }
        await new Promise<void>((resolve) => {
          queueMicrotask(resolve);
        });
        assert.equal(deliveredPostEvents, 2);
        assert.equal(host.membershipChanged, true);
        assert.equal(absent.membershipChanged, true);
        assert.ok(host.changes.size > 0);
        assert.ok(absent.changes.size > 0);
        assert.equal(project.membershipChanged, false);
        const snapshot = collectProjectInputSnapshot(
          root,
          identities,
          filesystem,
          undefined,
          { policy: cached.membershipPolicy },
        );
        assert.equal(snapshot.complete, true);
        assert.deepEqual(snapshot.hashes, before.hashes);
        const comparison = {
          before,
          snapshot,
          configStable: true,
          declared: undefined,
          projectRoot: root,
          tracker: project,
        };
        assert.equal(
          projectWalkStable(comparison),
          true,
          "post-window notification events do not refute the project witness",
        );
        const projectCallbacks = listeners.get("project")!;
        assert.equal(projectCallbacks.length, 1);
        projectCallbacks[0]!("rename", null);
        assert.equal(project.membershipChanged, true);
        assert.equal(
          projectWalkStable(comparison),
          false,
          "the same event on the project witness refutes unchanged walks",
        );
        const proofFailures = createGenerationProofFailures();
        recordProjectSnapshotFailures(proofFailures, {
          before,
          snapshot,
          declared: undefined,
          identities,
          projectRoot: root,
          tracker: project,
        });
        assert.deepEqual(proofFailures.entries, [
          {
            domain: "project",
            kind: "project-membership-event",
            path: root,
          },
        ]);
        assert.equal(proofFailures.omitted, 0);
        assert.equal(
          proofFailures.entries.some(
            (failure) =>
              failure.kind === "host-input-event" ||
              failure.kind === "candidate-event",
          ),
          false,
        );
      }
      const selectedProject =
        variant === "candidate-only" ? undefined : project;
      const selectedHost = variant === "candidate-only" ? undefined : host;
      const selectedCandidate = variant === "no-candidate" ? undefined : absent;
      const available = generationNotificationsAvailable(
        selectedProject,
        selectedHost,
        selectedCandidate,
      );
      assert.equal(available, !variant.endsWith("-failed"));
      const retained = retainGenerationNotifications({
        cached,
        project: selectedProject,
        host: selectedHost,
        candidate: selectedCandidate,
        retainProjectMembership: variant !== "membership-off",
        retainNotifications: variant !== "polling",
        stableProjectSnapshot: variant !== "incomplete",
        notificationsAvailable: available,
      });
      const admitted = ["healthy", "no-candidate", "candidate-only"].includes(
        variant,
      );
      assert.deepEqual(retained, {
        project: admitted && selectedProject !== undefined,
        host: admitted && selectedHost !== undefined,
        candidate: admitted && selectedCandidate !== undefined,
      });
      assert.equal(
        cached.projectMutationTracker,
        admitted ? selectedProject : undefined,
      );
      assert.equal(
        cached.hostInputMutationTracker,
        admitted ? selectedHost : undefined,
      );
      assert.equal(
        cached.candidateMutationTracker,
        admitted ? selectedCandidate : undefined,
      );
      if (variant === "healthy") {
        assert.equal(cached.hostInputMutationTracker!.membershipChanged, true);
        assert.equal(cached.candidateMutationTracker!.membershipChanged, true);
        assert.ok(cached.hostInputMutationTracker!.changes.size > 0);
        assert.ok(cached.candidateMutationTracker!.changes.size > 0);
      }
    } catch (error) {
      failures.push(new Error(variant, { cause: error }));
    } finally {
      for (const tracker of trackers) tracker.close();
      fixture.dispose();
    }
    try {
      assert.equal(
        closed,
        opened,
        variant + ": every actual acquired observer retires",
      );
    } catch (error) {
      failures.push(new Error(variant + " cleanup", { cause: error }));
    }
  }
  if (failures.length !== 0)
    throw new AggregateError(failures, "Notification transfer variants failed");
}

import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import { type WatchInputChange } from "../../../../../../packages/ttsc/lib/launcher/internal/watch/WatchInputChange.js";
import { WatchTopology } from "../../../../../../packages/ttsc/lib/launcher/internal/watch/WatchTopology.js";
import { E2eProcessTrace } from "../../../../../utils/src/E2eProcessTrace";
import { TestFailureLedger } from "../../../../../utils/src/TestFailureLedger";
import { TestLifetime } from "../../../../../utils/src/TestLifetime";
import { waitFor } from "../../../../../utils/src/internal/waitFor";

const trace = createRequire(import.meta.url)(E2eProcessTrace.runtimePath) as {
  begin(): string | undefined;
  record(
    event: string,
    invocation: string | undefined,
    fields: Record<string, unknown>,
  ): void;
};

/**
 * Verifies config attention survives a failed refresh and physical replacement.
 *
 * Real subscriptions must survive parse failure and same-byte replacement.
 *
 * 1. Delete the active config and observe a config change despite parse failure.
 * 2. Recreate and atomically replace it, preserving the same watch session.
 * 3. Prove an ordinary write remains observable after the replacement.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual WatchTopology config callbacks and parse errors verify deletion, recreation, atomic replacement and later content edits. Opt-in observations record the actual initial refresh return, each mutation and wait boundary, callback counts and finally close calls; they do not certify an unobserved native release or replace an assertion.
 * @evidence contracts/testing.md#independent-expectations The authored active tsconfig must report deletion, recreation, atomic replacement and a later content edit as config attention. Counters recorded before each mutation require a new callback; the deletion must also expose its parse error. Observations cannot identify an unrecorded synchronous boundary.
 * @evidence contracts/testing.md#distinguishing-cases 1. Delete the active config and observe a config change despite parse failure. 2. Recreate and atomically replace it, preserving the same watch session. 3. Prove an ordinary write remains observable after the replacement.
 * @evidence contracts/testing.md#execution-ownership The scenarios batch's original named wrapper owns this scene through its static contained actor, which refreshes actual tsgo inputs and drives native subscriptions through the built synchronous WatchTopology. Portable event-planning decisions remain in source units.
 * @evidence contracts/e2e.md#necessary-boundary The real compiler input/output population must agree with native observer registration and notification classification for this authored layout. Direct path planning cannot establish tsgo membership, actual delivered events or subscription survival across mutations.
 * @evidence contracts/e2e.md#shared-execution One topology session serves the original mutation sequence with the prepared compiler. One contained Node actor lets its parent enforce failure even during synchronous refresh; the existing native carrier joins that actor and descendants without a new compiler build or per-mutation host.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity A private TestProject root separates mutable config and source bytes. Subscription closure and lifetime disposal are independently attempted before the scene reports its ordered original failures, and the parent native owner adjudicates retirement before releasing actor inputs. One shared absolute deadline rejects incomplete observation; it does not certify joined cleanup, and unknown retirement retains owned storage.
 * @evidence contracts/e2e.md#preserved-coverage Every original mutation, config callback assertion and deletion error check remains here, including identical recreation/replacement bytes and three unchanged 250ms settling windows. Original error classification stays intact; explicit lifetime failure bounds waits while phase observations distinguish actual entries and returns.
 */
export const case_watch_topology_reports_deleted_config_and_recreation =
  async (deadline?: number): Promise<void> => {
    // Polling has no implicit deadline: a missing callback otherwise prevents
    // finally from running. Share the parent's failure deadline without treating
    // cancellation as proof that a synchronous refresh or its native child joined.
    const lifetime = new TestLifetime({
      name: "config-recovery",
      timeoutMs: 120_000,
      deadline,
    });
    // A cleanup exception must preserve an earlier observation failure, including
    // a thrown undefined. Record each original reason before attempting the next
    // cleanup, then report distinct reasons in that same order.
    const failures = new TestFailureLedger();
    try {
      const root = TestProject.tmpdir("ttsc-watch-config-recovery-");
      const source = path.join(root, "src", "main.ts");
      const config = path.join(root, "tsconfig.json");
      fs.mkdirSync(path.dirname(source), { recursive: true });
      fs.writeFileSync(source, "export const value = 1;\n", "utf8");
      const configText = JSON.stringify({ files: ["src/main.ts"] });
      fs.writeFileSync(config, configText, "utf8");

      const changes: WatchInputChange[] = [];
      const invocation = trace.begin();
      let phase = "initial-refresh";
      const observe = (event: string, detail: Record<string, unknown> = {}): void => {
        lifetime.checkpoint(phase);
        trace.record("watch-topology-observation", invocation, {
          pid: process.pid,
          data: {
            name: "config-recovery",
            root,
            phase,
            event,
            changes: changes.length,
            configChanges: configChangeCount(changes),
            ...detail,
          },
        });
      };
      let topologyFailure: Error | undefined;
      let allowMissingConfig = false;
      const owner = {
        signal: lifetime.signal,
        check: () => {
          if (topologyFailure) throw topologyFailure;
          lifetime.assertActive();
        },
      };
      const errors: unknown[] = [];
      const topology = new WatchTopology(
        {
          cwd: root,
          files: [],
          projectRoot: root,
          tsconfig: config,
        },
        {
          onError: (location, error) => {
            errors.push(error);
            observe("error", {
              location,
              message:
                error instanceof Error
                  ? error.message
                  : "Non-Error topology failure",
            });
            if (
              !allowMissingConfig ||
              !(error instanceof Error) ||
              !error.message.includes("tsconfig.json")
            )
              topologyFailure ??= new Error(`watch error on ${location}`, {
                cause: error,
              });
          },
          onInputChange: (change) => {
            changes.push(change);
            observe("input-change", { kind: change.kind, path: change.path });
          },
          onTopologyChange: () => undefined,
        },
      );
      try {
        observe("refresh-entered");
        topology.refresh(false);
        observe("refresh-returned");
        phase = "config-deletion";
        lifetime.checkpoint(phase);
        allowMissingConfig = true;
        fs.rmSync(config);
        observe("mutation-done");
        observe("await-entered");
        await waitFor(
          () => changes.some((change) => change.kind === "config"),
          "config deletion",
          owner,
        );
        observe("await-fulfilled");
        owner.check();
        assert.ok(errors.length > 0, "the failed refresh must remain observable");

        const deletionCount = changes.filter(
          (change) => change.kind === "config",
        ).length;
        phase = "config-recreation";
        lifetime.checkpoint(phase);
        fs.writeFileSync(config, configText, "utf8");
        allowMissingConfig = false;
        observe("mutation-done");
        observe("await-entered");
        await waitFor(
          () =>
            changes.filter((change) => change.kind === "config").length >
            deletionCount,
          "config recreation",
          owner,
        );
        observe("await-fulfilled");
        owner.check();
        await settle();

        const replacement = path.join(root, "tsconfig.next.json");
        phase = "replacement-preparation";
        lifetime.checkpoint(phase);
        fs.writeFileSync(replacement, configText, "utf8");
        observe("mutation-done");
        await settle();
        const beforeReplacement = configChangeCount(changes);
        phase = "atomic-config-replacement";
        lifetime.checkpoint(phase);
        fs.renameSync(replacement, config);
        observe("mutation-done");
        observe("await-entered");
        await waitFor(
          () => configChangeCount(changes) > beforeReplacement,
          "atomic config replacement",
          owner,
        );
        observe("await-fulfilled");
        owner.check();
        await settle();

        const beforeOrdinaryWrite = configChangeCount(changes);
        phase = "post-replacement-config-edit";
        lifetime.checkpoint(phase);
        fs.appendFileSync(config, "\n", "utf8");
        observe("mutation-done");
        observe("await-entered");
        await waitFor(
          () => configChangeCount(changes) > beforeOrdinaryWrite,
          "post-replacement config edit",
          owner,
        );
        observe("await-fulfilled");
        owner.check();
      } catch (error) {
        failures.add(error);
      } finally {
        failures.capture(() => {
          phase = "topology-close";
          observe("close-entered");
          topology.close();
          observe("close-returned");
        });
      }
    } catch (error) {
      failures.add(error);
    } finally {
      for (const failure of lifetime.finish()) failures.add(failure);
    }
    failures.throwIfFailed("Config recovery observation and cleanup failed");
  };

function configChangeCount(changes: readonly WatchInputChange[]): number {
  return changes.filter((change) => change.kind === "config").length;
}

function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 250));
}

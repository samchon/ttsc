import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { type WatchInputChange } from "../../../../../packages/ttsc/lib/launcher/internal/watch/WatchInputChange.js";
import { WatchTopology } from "../../../../../packages/ttsc/lib/launcher/internal/watch/WatchTopology.js";
import { WATCH_EVENT_DEADLINE_MS } from "../../internal/watch";

/**
 * Verifies a failed topology refresh still schedules the resident config lane.
 *
 * 1. Delete the active config and observe a config change despite parse failure.
 * 2. Recreate and atomically replace it, preserving the same watch session.
 * 3. Prove an ordinary write remains observable after the replacement.
 *
 * @evidence contracts/testing.md#behavioral-verification This case drives the real WatchTopology: a failed topology refresh still schedules the resident config lane. 1. Delete the active config and observe a config change despite parse failure. 2. Recreate and atomically replace it, preserving the same watch session. 3. Prove an ordinary write remains observable after the replacement.
 * @evidence contracts/testing.md#independent-expectations Authored tsconfig options, source imports and declared input paths establish which files are compiler inputs, products or reload dependencies. Literal event-kind/path assertions and quiet negative twins enforce those independently specified roles rather than snapshotting topology output.
 * @evidence contracts/testing.md#distinguishing-cases 1. Delete the active config and observe a config change despite parse failure. 2. Recreate and atomically replace it, preserving the same watch session. 3. Prove an ordinary write remains observable after the replacement.
 * @evidence contracts/testing.md#execution-ownership This named src/features/watch entry refreshes the real tsgo compiler population and drives native filesystem subscriptions through WatchTopology; the source units own direct event planning and injected watcher decisions.
 * @evidence contracts/e2e.md#necessary-boundary The real compiler input/output population must agree with native observer registration and notification classification for this authored layout. Direct path planning cannot establish tsgo membership, actual delivered events or subscription survival across mutations.
 * @evidence contracts/e2e.md#shared-execution The case reuses its built compiler and one Node test process; each topology session serves its authored mutation sequence. Distinct roots/options need their own compiler-population request, and an explicitly new session retains the initial-versus-newly-admitted input distinction; watcher registration installs or builds nothing.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Private TestProject roots separate mutable config, source, output and declared-input state. Each topology owns its subscriptions and existing finally paths close them. Event counters reset only between asserted transitions; actual cold registration and config recovery remain unprimed.
 * @evidence contracts/e2e.md#preserved-coverage 1. Delete the active config and observe a config change despite parse failure. 2. Recreate and atomically replace it, preserving the same watch session. 3. Prove an ordinary write remains observable after the replacement. Every original assertion and authored layout remains in this named entry; no change to timeout, capability guard, input, expected event or quiet negative twin is made by these acknowledgments.
 */
export const test_watch_topology_reports_deleted_config_and_recreation =
  async (): Promise<void> => {
    const root = TestProject.tmpdir("ttsc-watch-config-recovery-");
    const source = path.join(root, "src", "main.ts");
    const config = path.join(root, "tsconfig.json");
    fs.mkdirSync(path.dirname(source), { recursive: true });
    fs.writeFileSync(source, "export const value = 1;\n", "utf8");
    const configText = JSON.stringify({ files: ["src/main.ts"] });
    fs.writeFileSync(config, configText, "utf8");

    const changes: WatchInputChange[] = [];
    const errors: unknown[] = [];
    const topology = new WatchTopology(
      {
        cwd: root,
        files: [],
        projectRoot: root,
        tsconfig: config,
      },
      {
        onError: (_location, error) => errors.push(error),
        onInputChange: (change) => changes.push(change),
        onTopologyChange: () => undefined,
      },
    );
    try {
      topology.refresh(false);
      fs.rmSync(config);
      await waitFor(
        () => changes.some((change) => change.kind === "config"),
        "config deletion",
      );
      assert.ok(errors.length > 0, "the failed refresh must remain observable");

      const deletionCount = changes.filter(
        (change) => change.kind === "config",
      ).length;
      fs.writeFileSync(config, configText, "utf8");
      await waitFor(
        () =>
          changes.filter((change) => change.kind === "config").length >
          deletionCount,
        "config recreation",
      );
      await settle();

      const replacement = path.join(root, "tsconfig.next.json");
      fs.writeFileSync(replacement, configText, "utf8");
      await settle();
      const beforeReplacement = configChangeCount(changes);
      fs.renameSync(replacement, config);
      await waitFor(
        () => configChangeCount(changes) > beforeReplacement,
        "atomic config replacement",
      );
      await settle();

      const beforeOrdinaryWrite = configChangeCount(changes);
      fs.appendFileSync(config, "\n", "utf8");
      await waitFor(
        () => configChangeCount(changes) > beforeOrdinaryWrite,
        "post-replacement config edit",
      );
    } finally {
      topology.close();
    }
  };

function configChangeCount(changes: readonly WatchInputChange[]): number {
  return changes.filter((change) => change.kind === "config").length;
}

function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 250));
}

async function waitFor(predicate: () => boolean, label: string): Promise<void> {
  const deadline = Date.now() + WATCH_EVENT_DEADLINE_MS;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.fail(`timed out waiting for ${label}`);
}

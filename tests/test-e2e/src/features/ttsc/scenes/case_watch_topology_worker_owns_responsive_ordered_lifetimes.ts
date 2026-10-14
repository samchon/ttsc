import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import { once } from "node:events";
import fs from "node:fs";
import path from "node:path";
import { MessageChannel, Worker } from "node:worker_threads";

import { AsyncWatchTopology } from "../../../../../../packages/ttsc/lib/launcher/internal/watch/AsyncWatchTopology.js";
import type { WatchInputChange } from "../../../../../../packages/ttsc/lib/launcher/internal/watch/WatchInputChange.js";

/**
 * Verifies packaged watch topology owns responsive and ordered worker
 * lifetimes.
 *
 * Direct core calls cannot prove thread separation, cloned publications,
 * callback/reply ordering or actual worker-loss settlement.
 *
 * 1. Reuse one packaged topology worker for plugin/project publications, changed
 *    and unchanged events, blocked operations and recoverable failures.
 * 2. Run launcher timers while compiler/case operations remain blocked, then
 *    release them and join concurrent idle barriers with normal shutdown.
 * 3. Reset the same project and open one replacement lifetime, terminate it during
 *    a blocked listing, and assert terminal ownership and joined close.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual packaged facade/core/dispatcher and MessageChannel transport preserve pre-build baselines, callback-before-idle ordering, same-size restored-mtime content edits, responsiveness and failure settlement.
 * @evidence contracts/testing.md#independent-expectations Authored bytes and declarations require one plugin and one project change; unchanged repeats require none. A gate cannot complete before the test releases it, and terminated threads cannot answer operations. The same failure object must reach pending and later requests.
 * @evidence contracts/testing.md#distinguishing-cases Preserves plugin/project publication, bigint-map cloning, content changes and quiet twins, listing/case gates, listing failure/recovery, clone failure/recovery, concurrent idle/close, rejected post-close work and pending thread loss.
 * @evidence contracts/testing.md#execution-ownership The scenarios batch owns this scene and its static fixture. It runs built production worker transport with recorded subscriptions and supplied compiler/case operations; pure topology queue logic remains in test-ttsc units.
 * @evidence contracts/e2e.md#necessary-boundary Real worker startup, structured cloning, FIFO callback transport, launcher-loop independence and actual thread exit connect packaged components; direct unit calls cannot establish those connections.
 * @evidence contracts/e2e.md#shared-execution One copied project and its packaged owners serve all rows. The first worker shares publication, responsiveness and recoverable failures; only terminal-loss coverage needs a second lifetime because normal joined close and unexpected death are mutually exclusive endings. No install, native build or compiler host is added.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity A private TestProject root owns all mutable bytes, gates and message ports. Normal close joins before the static project is recopied for terminal loss; each gate releases in finally, each control port closes, and fixture removal follows actual worker joining.
 * @evidence contracts/e2e.md#preserved-coverage All assertions from the three former worker units survive in this shared scene: content/publication/FIFO/quiet/bigint, listing/case responsiveness and recovery, clone/terminal failure ownership and concurrent normal close. E2E runner selection replaces their unit entries rather than duplicating transport checks.
 */
export async function case_watch_topology_worker_owns_responsive_ordered_lifetimes(): Promise<void> {
  const root = TestProject.physicalPath(
    TestProject.tmpdir("ttsc-topology-worker-"),
  );
  const fixtures = path.join(
    TestProject.WORKSPACE_ROOT,
    "tests/test-e2e/fixtures/ttsc/watch-topology-worker",
  );
  const changes: WatchInputChange[] = [];
  const failures: unknown[] = [];
  const errors: unknown[] = [];
  fs.cpSync(path.join(fixtures, "project"), root, { recursive: true });
  const open = () => {
    const channel = new MessageChannel();
    const shared = new SharedArrayBuffer(16);
    const gate = new Int32Array(shared);
    let worker!: Worker;
    const topology = new AsyncWatchTopology(
      { cwd: root, files: [], tsconfig: path.join(root, "tsconfig.json") },
      {
        onError: (_location, error) => errors.push(error),
        onFailure: (error) => failures.push(error),
        onInputChange: (change) => changes.push(change),
        onTopologyChange: () => undefined,
      },
      (options) =>
        (worker = new Worker(path.join(fixtures, "worker.mjs"), {
          workerData: {
            options,
            shared,
            control: channel.port2,
            workspace: TestProject.WORKSPACE_ROOT,
          },
          transferList: [channel.port2],
        })),
    );
    return { topology, gate, channel, worker };
  };
  try {
    const first = open();
    try {
      const { topology, gate, channel } = first;
      await topology.refresh(false);
      await topology.whenIdle();
      const plugin = path.join(root, "plugin");
      const pluginSource = path.join(plugin, "main.go");
      const document = path.join(root, "docs/rule.md");
      await topology.setExtraInputs([plugin], {
        root: path.join(root, "cache"),
        references: new Map([[fs.statSync(root, { bigint: true }).dev, 0n]]),
        version: "transport",
      });
      await topology.setProjectInputs({
        root,
        files: [document],
        globs: [],
        reloadFiles: [],
        reloadDirectories: [],
      });
      await topology.whenIdle();
      changes.length = 0;
      const deliver = async (entry: string) => {
        const delivered = once(channel.port1, "message");
        channel.port1.postMessage({ path: entry, event: "change" });
        await delivered;
        await topology.whenIdle();
      };
      const pluginStamp = fs.statSync(pluginSource);
      fs.writeFileSync(pluginSource, "package other\n");
      fs.utimesSync(pluginSource, pluginStamp.atime, pluginStamp.mtime);
      await deliver(pluginSource);
      assert.equal(
        changes.filter((change) => change.kind === "plugin").length,
        1,
      );
      const documentStamp = fs.statSync(document);
      fs.writeFileSync(document, "other\n");
      fs.utimesSync(document, documentStamp.atime, documentStamp.mtime);
      await deliver(document);
      assert.equal(
        changes.filter((change) => change.kind === "project").length,
        1,
      );
      const consumed = changes.length;
      await deliver(pluginSource);
      await deliver(document);
      assert.equal(changes.length, consumed);
      for (const operation of [1, 2]) {
        Atomics.store(gate, 1, 0);
        Atomics.store(gate, 0, operation);
        let completed = false;
        const refreshing = topology.refresh(false).then(() => {
          completed = true;
        });
        try {
          const entered = Atomics.waitAsync(gate, 1, 0);
          if (entered.async) await entered.value;
          await new Promise<void>((resolve) => setTimeout(resolve, 0));
          assert.equal(
            completed,
            false,
            "blocked operation completed before release",
          );
        } finally {
          Atomics.store(gate, 0, 0);
          Atomics.notify(gate, 0);
          await refreshing;
        }
      }
      Atomics.store(gate, 3, 1);
      await assert.rejects(
        topology.refresh(false),
        (error: unknown) =>
          typeof error === "object" &&
          error !== null &&
          "message" in error &&
          error.message === "owned listing failure",
      );
      await topology.refresh(false);
      await topology.whenIdle();
      const inputs = { root, files: [document], globs: [] };
      await assert.rejects(
        topology.setProjectInputs({
          ...inputs,
          uncloneable: () => undefined,
        } as typeof inputs),
        { name: "DataCloneError" },
      );
      await topology.setProjectInputs(inputs);
      await Promise.all([
        topology.whenIdle(),
        topology.whenIdle(),
        topology.close(),
      ]);
      assert.deepEqual(errors, []);
      assert.deepEqual(failures, []);
      await assert.rejects(topology.refresh(false), /closing/);
    } finally {
      Atomics.store(first.gate, 0, 0);
      Atomics.notify(first.gate, 0);
      try {
        await first.topology.close();
      } finally {
        first.channel.port1.close();
      }
    }
    fs.cpSync(path.join(fixtures, "project"), root, { recursive: true });
    const second = open();
    try {
      const { topology, gate, worker } = second;
      await topology.refresh(false);
      await topology.whenIdle();
      Atomics.store(gate, 0, 1);
      const refreshing = topology.refresh(false);
      const rejected = assert.rejects(
        refreshing,
        (error: unknown) => failures[0] === error,
      );
      const entered = Atomics.waitAsync(gate, 1, 0);
      if (entered.async) await entered.value;
      await worker.terminate();
      await rejected;
      assert.equal(failures.length, 1);
      await assert.rejects(
        topology.whenIdle(),
        (error: unknown) => error === failures[0],
      );
      await assert.rejects(
        topology.close(),
        (error: unknown) => error === failures[0],
      );
      assert.equal(failures.length, 1);
      assert.deepEqual(errors, []);
    } finally {
      Atomics.store(second.gate, 0, 0);
      Atomics.notify(second.gate, 0);
      await second.topology.close().catch(() => undefined);
      second.channel.port1.close();
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

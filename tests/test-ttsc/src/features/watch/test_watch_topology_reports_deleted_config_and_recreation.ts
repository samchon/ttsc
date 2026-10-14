import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { type WatchInputChange } from "../../../../../packages/ttsc/src/launcher/internal/watch/WatchInputChange";
import { WatchTopology } from "../../../../../packages/ttsc/src/launcher/internal/watch/WatchTopology";
import { watchDirectoryThroughFsWatch } from "../../../../../packages/ttsc/src/launcher/internal/watch/watchDirectoryThroughFsWatch";
import {
  deliverWatchEvent,
  recordWatchers,
} from "../../../../utils/src/RecordedWatchers";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies config deletion, recreation and replacement in one source session.
 *
 * Directory attention must reconcile a replaced config even when it names only the vanished temporary entry.
 *
 * 1. Remove the actual config and retain its failed refresh and config report.
 * 2. Recreate and atomically replace it through the same recorded subscriptions.
 * 3. Edit the replacement and require another config transition.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual source topology parses changed configs and survives deletion, recreation, replacement and ordinary editing in one session; refresh errors remain observable. Additional real-file replacements independently deliver target, unnamed and vanished-old-name attention through recorded subscriptions and require a new config callback after the owned decision queue drains. Malformed old-name-only replacements retain the original parse error and actual config attention, then recover through the same owner.
 * @evidence contracts/testing.md#independent-expectations Authored source membership and literal config bytes establish independent expected config transitions and failed-refresh errors. Distinct native bigint identities establish a real same-byte replacement; the reload-file contract requires a new config callback. Supplied compiler-reader refusals require the exact original Error or undefined and cannot create config attention without movement or a selected fallback path. Explicit callback delivery proves source classification, not native event delivery.
 * @evidence contracts/testing.md#distinguishing-cases Missing config parsing, restored config, rename replacement and ordinary changed bytes remain separate stimuli and retain every original assertion. Target rename, unnamed attention and vanished-old-name rename/change each contrast unchanged config attention with a distinct same-byte owner replacement and a later ordinary write. Old-name-only malformed replacement also contrasts its first changed state, unchanged failed refresh, valid recovery and later ordinary edit. POSIX must retire and replace the config's per-file handle, then retain that new handle on unchanged change attention and ordinary editing; Windows retains directory-only ownership. Each native-platform branch is executed only on that platform, and every acquired recorded watcher closes.
 * @evidence contracts/testing.md#execution-ownership Source topology and adapter consume recorded callbacks with independently supplied compiler membership; no native compiler or OS subscription executes here. The existing configured CLI boundary owns real membership and native session survival.
 */
export const test_watch_topology_reports_deleted_config_and_recreation =
  async (): Promise<void> => {
    const root = TestProject.physicalPath(
      TestProject.tmpdir("ttsc-watch-config-recovery-"),
    );
    const source = path.join(root, "src", "main.ts");
    const config = path.join(root, "tsconfig.json");
    fs.mkdirSync(path.dirname(source), { recursive: true });
    fs.writeFileSync(source, "export const value = 1;\n", "utf8");
    const configText = JSON.stringify({ files: ["src/main.ts"] });
    fs.writeFileSync(config, configText, "utf8");

    const { openDirectoryWatch, openFileWatch, watchers } = recordWatchers(
      watchDirectoryThroughFsWatch,
    );
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
      openDirectoryWatch,
      openFileWatch,
      fs.readdirSync,
      () => [source],
    );
    try {
      topology.refresh(false);
      fs.rmSync(config);
      deliverWatchEvent(watchers, config, "rename");
      await waitFor(
        () => changes.some((change) => change.kind === "config"),
        "config deletion",
      );
      assert.ok(errors.length > 0, "the failed refresh must remain observable");

      const deletionCount = changes.filter(
        (change) => change.kind === "config",
      ).length;
      fs.writeFileSync(config, configText, "utf8");
      deliverWatchEvent(watchers, config, "rename");
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
      const previousOwner = fs.statSync(config);
      const replacementOwner = fs.statSync(replacement);
      assert.notEqual(
        `${replacementOwner.dev}:${replacementOwner.ino}`,
        `${previousOwner.dev}:${previousOwner.ino}`,
        "native replacement fixture must have a distinct physical owner",
      );
      fs.renameSync(replacement, config);
      deliverWatchEvent(watchers, config, "rename");
      await waitFor(
        () => configChangeCount(changes) > beforeReplacement,
        "atomic config replacement",
      );
      await settle();

      const beforeOrdinaryWrite = configChangeCount(changes);
      fs.appendFileSync(config, "\n", "utf8");
      deliverWatchEvent(watchers, config, "change");
      await waitFor(
        () => configChangeCount(changes) > beforeOrdinaryWrite,
        "post-replacement config edit",
      );
      assert.ok(
        changes.every(
          (change) => change.kind === "config" && change.path === config,
        ),
      );
    } finally {
      topology.close();
      assert.ok(watchers.every((watcher) => watcher.active === false));
    }
    for (const delivery of ["target", "unnamed", "old-name", "old-name-change"] as const)
      await verifyReplacementAttention(delivery);
  };

async function verifyReplacementAttention(
  delivery: "target" | "unnamed" | "old-name" | "old-name-change",
): Promise<void> {
  const root = TestProject.physicalPath(TestProject.tmpdir("ttsc-config-attention-"));
  const config = path.join(root, "tsconfig.json");
  const replacement = path.join(root, "tsconfig.next.json");
  const source = path.join(root, "main.ts");
  const configText = JSON.stringify({ files: ["main.ts"] });
  fs.writeFileSync(source, "export const value = 1;\n");
  fs.writeFileSync(config, configText);
  const { openDirectoryWatch, openFileWatch, watchers } = recordWatchers(watchDirectoryThroughFsWatch);
  const changes: WatchInputChange[] = [];
  const errors: unknown[] = [];
  let compilerFailure: { error: unknown } | undefined;
  const topology = new WatchTopology(
    { cwd: root, files: [], projectRoot: root, tsconfig: config },
    {
      onError: (_location, error) => errors.push(error),
      onInputChange: (change) => changes.push(change),
      onTopologyChange: () => undefined,
    },
    openDirectoryWatch,
    openFileWatch,
    fs.readdirSync,
    () => {
      if (compilerFailure !== undefined) throw compilerFailure.error;
      return [source];
    },
  );
  const deliver = (): void => {
    if (delivery !== "unnamed")
      deliverWatchEvent(watchers, delivery === "target" ? config : replacement, delivery === "old-name-change" ? "change" : "rename");
    else {
      const directories = watchers.filter((watcher) => watcher.active && watcher.location === root);
      assert.ok(directories.length !== 0, "the config directory must have a recorded owner");
      for (const watcher of directories) watcher.listener("rename", null);
    }
  };
  try {
    topology.refresh(false);
    await topology.whenIdle();
    deliver();
    await topology.whenIdle();
    assert.equal(changes.length, 0, `${delivery}: unchanged attention must not invent a config change`);

    fs.writeFileSync(replacement, configText);
    const previousOwner = fs.statSync(config, { bigint: true });
    const replacementOwner = fs.statSync(replacement, { bigint: true });
    const previousFileWatchers = watchers.filter((watcher) => watcher.active && watcher.location === config);
    assert.equal(previousFileWatchers.length, process.platform === "win32" ? 0 : 1);
    assert.notEqual(
      `${previousOwner.dev}:${previousOwner.ino}`,
      `${replacementOwner.dev}:${replacementOwner.ino}`,
      "the replacement must have a distinct native identity before rename",
    );
    fs.renameSync(replacement, config);
    deliver();
    await topology.whenIdle();
    assert.equal(configChangeCount(changes), 1, `${delivery}: same-byte config replacement must report its owner change`);
    assert.ok(previousFileWatchers.every((watcher) => !watcher.active), `${delivery}: a replaced config must retire its previous per-file owner`);
    assert.equal(watchers.filter((watcher) => watcher.active && watcher.location === config).length, process.platform === "win32" ? 0 : 1);

    deliver();
    await topology.whenIdle();
    assert.equal(configChangeCount(changes), 1, `${delivery}: repeated attention must not repeat the replacement`);
    const replacementFileWatchers = watchers.filter((watcher) => watcher.active && watcher.location === config);
    deliverWatchEvent(watchers, config, "change");
    await topology.whenIdle();
    assert.equal(configChangeCount(changes), 1, `${delivery}: unchanged change attention must remain quiet`);
    assert.deepEqual(watchers.filter((watcher) => watcher.active && watcher.location === config), replacementFileWatchers, `${delivery}: unchanged change attention must retain its existing per-file owner`);
    fs.appendFileSync(config, "\n");
    deliverWatchEvent(watchers, config, "change");
    await topology.whenIdle();
    assert.equal(configChangeCount(changes), 2, `${delivery}: the ordinary edit must remain observable`);
    assert.deepEqual(watchers.filter((watcher) => watcher.active && watcher.location === config), replacementFileWatchers, `${delivery}: an ordinary edit must retain its existing per-file owner`);
    assert.ok(changes.every((change) => change.kind === "config" && change.path === config));
    assert.deepEqual(errors, []);
    if (delivery === "old-name" || delivery === "old-name-change") {
      fs.writeFileSync(replacement, '{"files":');
      const validOwner = fs.statSync(config, { bigint: true });
      const malformedOwner = fs.statSync(replacement, { bigint: true });
      assert.notEqual(`${validOwner.dev}:${validOwner.ino}`, `${malformedOwner.dev}:${malformedOwner.ino}`);
      const validFileWatchers = watchers.filter((watcher) => watcher.active && watcher.location === config);
      fs.renameSync(replacement, config);
      deliver();
      await topology.whenIdle();
      assert.equal(errors.length, 1, `${delivery}: malformed replacement must retain its original parse error`);
      assert.ok(errors[0] instanceof Error && errors[0].message.includes(config), "the error must identify the actual malformed config");
      assert.equal(configChangeCount(changes), 3, `${delivery}: failed refresh must report the replaced config`);
      assert.ok(validFileWatchers.every((watcher) => !watcher.active), `${delivery}: failed refresh must retire the replaced per-file owner`);
      const malformedFileWatchers = watchers.filter((watcher) => watcher.active && watcher.location === config);
      assert.equal(malformedFileWatchers.length, process.platform === "win32" ? 0 : 1);

      deliver();
      await topology.whenIdle();
      assert.equal(errors.length, 2, `${delivery}: a repeated failed refresh must retain its actual parse error`);
      assert.equal(configChangeCount(changes), 3, `${delivery}: unchanged failed attention must not repeat config change`);
      assert.deepEqual(watchers.filter((watcher) => watcher.active && watcher.location === config), malformedFileWatchers);

      fs.writeFileSync(config, configText);
      deliver();
      await topology.whenIdle();
      assert.equal(configChangeCount(changes), 4, `${delivery}: valid recovery must report changed config bytes`);
      assert.equal(errors.length, 2);
      assert.deepEqual(watchers.filter((watcher) => watcher.active && watcher.location === config), malformedFileWatchers);
      fs.appendFileSync(config, "\n");
      deliverWatchEvent(watchers, config, "change");
      await topology.whenIdle();
      assert.equal(configChangeCount(changes), 5, `${delivery}: the recovered config must retain ordinary editing`);
      assert.equal(errors.length, 2);
      assert.deepEqual(watchers.filter((watcher) => watcher.active && watcher.location === config), malformedFileWatchers);
      for (const failure of [new Error("compiler-input listing refused"), undefined]) {
        compilerFailure = { error: failure };
        const previousErrors = errors.length;
        deliver();
        await topology.whenIdle();
        assert.equal(errors.length, previousErrors + 1, `${delivery}: a compiler-reader refusal must remain observable`);
        assert.strictEqual(errors.at(-1), failure, `${delivery}: the compiler-reader refusal must preserve its original identity or undefined value`);
        assert.equal(configChangeCount(changes), 5, `${delivery}: failure alone must not invent unchanged config attention`);
        assert.deepEqual(watchers.filter((watcher) => watcher.active && watcher.location === config), malformedFileWatchers);
      }
      compilerFailure = undefined;
      const previousErrors = errors.length;
      deliver();
      await topology.whenIdle();
      assert.equal(errors.length, previousErrors);
      assert.equal(configChangeCount(changes), 5);
    }
  } finally {
    topology.close();
    assert.ok(watchers.every((watcher) => !watcher.active));
  }
}

function configChangeCount(changes: readonly WatchInputChange[]): number {
  return changes.filter((change) => change.kind === "config").length;
}

function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 250));
}

async function waitFor(predicate: () => boolean, label: string): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.fail(`timed out waiting for ${label}`);
}

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { captureWatchInputBaseline } from "../../../../../packages/unplugin/src/core/transform/watch/captureWatchInputBaseline";
import { createViteServeInputWatch } from "../../../../../packages/unplugin/src/core/vite/createViteServeInputWatch";
import unpluginVite from "../../../../../packages/unplugin/src/vite";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies Vite input proof races and fallback resources through supported
 * capabilities.
 *
 * Restoring source bytes does not undo an event witnessed during compilation. A
 * newly discovered external scope must also reject changes outside its proof
 * interval. Captured observers and poll callbacks isolate those decisions from
 * native notifications while real temporary paths supply their input
 * identities.
 *
 * 1. Reject witnessed restored bytes and an uncovered external-source change.
 * 2. Tick the supported hardlink fallback and assert importer invalidation.
 * 3. Replace identity policy and remove importers, checking policy probes and the
 *    final owner's single scheduler close.
 *
 * @evidence contracts/testing.md#behavioral-verification Five independent source operations preserve the former E2E helper assertions: restored-byte event rejection, uncovered external-scope rejection, actual hardlink write detection through captured polling, case-policy memo reset and final-importer poll release. The source Vite factory exposes its watchChange hook.
 * @evidence contracts/testing.md#independent-expectations Authored before/transient/stable bytes and captured change callbacks define proof failure; the actual external hardlink aliases the modified inode. Literal invalidated importer, probe counts and exactly one scheduler close specify ownership independently of the watcher's computation.
 * @evidence contracts/testing.md#distinguishing-cases Existing versus newly discovered subscriptions, writes through an external hardlink, registration replacement versus topology removal and server restart, and one removed importer versus the last removed importer.
 * @evidence contracts/testing.md#execution-ownership The test-unplugin runner discovers this source unit. It calls authored createViteServeInputWatch and the Vite factory through supported watch/poll/caseSensitive capabilities, with temporary filesystem identity inputs and no native observer, compiler, built entry or product host. Real filesystem notification and live Vite hook dispatch remain in test-e2e.
 */
export async function test_vite_compiler_watch_preserves_race_and_fallback_lifetimes(): Promise<void> {
  const root = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-vite-watch-proofs-unit-"),
  );
  const failures: Error[] = [];
  for (const scenario of [
    assertExistingViteSubscriptionClosesCompileRace,
    assertExternalViteSubscriptionClosesCompileRace,
    assertViteHardlinkFallbackInvalidates,
    assertViteCaseIdentityMemosReset,
    assertViteDeletedImporterReleasesFallback,
  ]) {
    try {
      await scenario(root);
    } catch (cause) {
      failures.push(new Error(scenario.name, { cause }));
    }
  }
  if (failures.length)
    throw new AggregateError(
      failures,
      "Vite input proof and fallback scenarios failed",
    );
}

/** An existing input must use its event witness when a new proof replaces it. */
async function assertExistingViteSubscriptionClosesCompileRace(
  root: string,
): Promise<void> {
  const invalidated = new Set<string>();
  let notify: ((eventType: string, file: string | null) => void) | undefined;
  const watch = createViteServeInputWatch({
    poll() {
      return { close: () => undefined };
    },
    watch(_scope, listener) {
      notify = listener;
      return { close: () => undefined };
    },
  });
  const importer = path.join(root, "existing-race.ts").replace(/\\/g, "/");
  const file = path.join(root, "existing-race.txt");
  const evidence = () => {
    const baseline = captureWatchInputBaseline(file);
    assert.ok(baseline);
    return {
      identity: baseline.identity,
      missing: false,
      state: { codec: "host" as const, hash: baseline.hostHash },
    };
  };
  fs.writeFileSync(file, "stable");
  watch.attach({
    config: { root },
    moduleGraph: {
      getModulesByFile: (candidate) =>
        candidate === importer ? new Set([{ file: candidate }]) : undefined,
      invalidateModule: (node) =>
        invalidated.add((node as { file: string }).file),
    },
  });
  try {
    watch.replace(
      importer,
      [{ file, evidence: evidence() }],
      false,
      watch.begin(),
    );
    const startedAt = watch.begin();
    fs.writeFileSync(file, "transient");
    const transient = evidence();
    fs.writeFileSync(file, "stable");
    assert.ok(notify);
    notify("change", path.relative(root, file));
    watch.replace(importer, [{ file, evidence: transient }], false, startedAt);
    assert.ok(
      invalidated.has(importer),
      "an existing subscription must reject restored bytes observed during compilation",
    );
  } finally {
    await watch.dispose();
  }
}

/** A scope discovered after compilation must validate the uncovered interval. */
async function assertExternalViteSubscriptionClosesCompileRace(
  root: string,
): Promise<void> {
  const invalidated = new Set<string>();
  const watch = createViteServeInputWatch({
    poll() {
      return { close: () => undefined };
    },
    watch() {
      return { close: () => undefined };
    },
  });
  const externalRoot = TestProject.tmpdir("ttsc-vite-watch-external-race-");
  const file = path.join(externalRoot, "value.txt");
  const importer = path.join(root, "external-race.ts").replace(/\\/g, "/");
  fs.writeFileSync(file, "before");
  const baseline = captureWatchInputBaseline(file);
  assert.ok(baseline);
  watch.attach({
    config: { root },
    moduleGraph: {
      getModulesByFile: (candidate) =>
        candidate === importer ? new Set([{ file: candidate }]) : undefined,
      invalidateModule: (node) =>
        invalidated.add((node as { file: string }).file),
    },
  });
  try {
    const startedAt = watch.begin();
    fs.writeFileSync(file, "after");
    watch.replace(
      importer,
      [
        {
          file,
          evidence: {
            identity: baseline.identity,
            missing: false,
            state: { codec: "host", hash: baseline.hostHash },
          },
        },
      ],
      false,
      startedAt,
    );
    assert.ok(
      invalidated.has(importer),
      "an external scope opened after compilation must reject the uncovered change",
    );
  } finally {
    await watch.dispose();
  }
}

/** A hardlink write outside every watched scope must use bounded polling. */
async function assertViteHardlinkFallbackInvalidates(
  root: string,
): Promise<void> {
  const invalidated = new Set<string>();
  let poll: (() => void) | undefined;
  const watch = createViteServeInputWatch({
    poll(listener) {
      poll = listener;
      return { close: () => (poll = undefined) };
    },
    watch() {
      return { close: () => undefined };
    },
  });
  const file = path.join(root, "hardlink-input.txt");
  const alias = path.join(
    TestProject.tmpdir("ttsc-vite-watch-hardlink-"),
    "hardlink-alias.txt",
  );
  const importer = path.join(root, "hardlink.ts").replace(/\\/g, "/");
  fs.writeFileSync(file, "before");
  fs.linkSync(file, alias);
  const baseline = captureWatchInputBaseline(file);
  assert.ok(baseline);
  watch.attach({
    config: { root },
    moduleGraph: {
      getModulesByFile: (candidate) =>
        candidate === importer ? new Set([{ file: candidate }]) : undefined,
      invalidateModule: (node) =>
        invalidated.add((node as { file: string }).file),
    },
  });
  try {
    watch.replace(importer, [
      {
        file,
        evidence: {
          identity: baseline.identity,
          missing: false,
          state: { codec: "host", hash: baseline.hostHash },
        },
      },
    ]);
    const tick = poll;
    assert.ok(tick, "a multiply linked input must enter the shared fallback");
    fs.writeFileSync(alias, "after");
    tick();
    assert.ok(
      invalidated.has(importer),
      "a write through an external hardlink must invalidate the importer",
    );
  } finally {
    await watch.dispose();
  }
}

/** A server restart must discard cached physical and case identity facts. */
async function assertViteCaseIdentityMemosReset(root: string): Promise<void> {
  let caseProbes = 0;
  let caseSensitive = true;
  let emit: ((eventType: string, file: string | null) => void) | undefined;
  const watch = createViteServeInputWatch({
    poll() {
      return { close: () => undefined };
    },
    caseSensitive() {
      caseProbes += 1;
      return caseSensitive;
    },
    platform: "darwin",
    watch(_root, listener) {
      emit = listener;
      return { close: () => undefined };
    },
  });
  const file = path.join(root, "case-memo", "input.txt");
  const importer = path.join(root, "case-memo.ts").replace(/\\/g, "/");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, "value");
  const register = () => {
    const baseline = captureWatchInputBaseline(file);
    assert.ok(baseline);
    watch.attach({ config: { root } });
    watch.replace(importer, [
      {
        file,
        evidence: {
          identity: baseline.identity,
          missing: false,
          state: { codec: "host", hash: baseline.hostHash },
        },
      },
    ]);
  };

  register();
  const firstSessionProbes = caseProbes;
  assert.ok(firstSessionProbes > 0, "the simulated Darwin host must be probed");
  // A registration that replaces its inputs removes the old entry, which is
  // not a topology change, so the remembered policy stands
  // (samchon/ttsc#1443).
  const other = path.join(root, "case-memo", "other.txt");
  fs.writeFileSync(other, "value");
  watch.replace(importer, [{ file: other }]);
  register();
  assert.equal(
    caseProbes,
    firstSessionProbes,
    "replacing an importer's inputs must not re-probe the case policy",
  );
  caseSensitive = false;
  emit?.("rename", file);
  assert.equal(
    caseProbes,
    firstSessionProbes,
    "a topology event must not switch the identity context underneath live path indexes",
  );
  // The rename can have changed the policy of what it moved, so the removal
  // it causes is what re-probes.
  watch.replace(importer, [{ file: other }]);
  register();
  const afterRename = caseProbes;
  assert.ok(
    afterRename > firstSessionProbes,
    "a removal after a rename must rediscover the case policy",
  );
  await watch.dispose();
  register();
  try {
    assert.ok(
      caseProbes > afterRename,
      "a replacement server must rediscover case policy instead of retaining the old session's path cache",
    );
  } finally {
    await watch.dispose();
  }
}

/** Deleting an importer must release its private hardlink fallback state. */
async function assertViteDeletedImporterReleasesFallback(
  root: string,
): Promise<void> {
  const plugin = [unpluginVite()]
    .flat()
    .find((entry) => entry?.name === "ttsc-unplugin");
  assert.ok(
    plugin,
    "the Vite source factory must expose the ttsc plugin object",
  );
  assert.equal(
    typeof plugin.watchChange,
    "function",
    "the published Vite adapter must forward source deletion to private input cleanup",
  );
  let poll: (() => void) | undefined;
  let closed = 0;
  const watch = createViteServeInputWatch({
    poll(listener) {
      poll = listener;
      return {
        close() {
          poll = undefined;
          closed += 1;
        },
      };
    },
    watch() {
      return { close: () => undefined };
    },
  });
  const file = path.join(root, "deleted-importer-input.txt");
  const alias = path.join(
    TestProject.tmpdir("ttsc-vite-watch-deleted-importer-"),
    "alias.txt",
  );
  const importer = path.join(root, "deleted-importer.ts").replace(/\\/g, "/");
  const survivor = path.join(root, "surviving-importer.ts").replace(/\\/g, "/");
  fs.writeFileSync(file, "value");
  fs.linkSync(file, alias);
  const baseline = captureWatchInputBaseline(file);
  assert.ok(baseline);
  watch.attach({ config: { root } });
  try {
    const input = {
      file,
      evidence: {
        identity: baseline.identity,
        missing: false as const,
        state: { codec: "host" as const, hash: baseline.hostHash },
      },
    };
    watch.replace(importer, [input]);
    watch.replace(survivor, [input]);
    assert.ok(poll, "a multiply linked input must own fallback work");
    watch.forget(importer);
    assert.ok(
      poll,
      "deleting one importer must retain fallback work owned by another importer",
    );
    assert.equal(closed, 0, "shared fallback work must remain open");
    watch.forget(survivor);
    assert.equal(
      poll,
      undefined,
      "a deleted importer must leave no fallback work",
    );
    assert.equal(
      closed,
      1,
      "the unused shared scheduler must close immediately",
    );
  } finally {
    await watch.dispose();
  }
  assert.equal(closed, 1, "server disposal must not re-close the scheduler");
}

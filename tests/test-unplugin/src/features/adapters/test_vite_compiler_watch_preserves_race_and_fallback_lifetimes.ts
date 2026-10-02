import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { captureWatchInputBaseline } from "../../../../../packages/unplugin/src/core/transform/watch/captureWatchInputBaseline";
import { createViteServeInputWatch } from "../../../../../packages/unplugin/src/core/vite/createViteServeInputWatch";
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
 * @evidence contracts/testing.md#behavioral-verification Five independent source operations check restored-byte event rejection, uncovered external-scope rejection, actual hardlink write detection through captured polling, case-policy memo reset and final-importer poll release. Each scenario retains its inputs and assertions; the harness collects independent failures under scenario names.
 * @evidence contracts/testing.md#independent-expectations Authored before/transient/stable bytes and captured change callbacks define proof failure; the actual external hardlink aliases the modified inode. Literal invalidated importer, probe counts and exactly one scheduler close specify ownership independently of the watcher's computation.
 * @evidence contracts/testing.md#distinguishing-cases Existing versus newly discovered subscriptions, writes through an external hardlink, registration replacement versus topology removal and server restart, and one removed importer versus the last removed importer.
 * @evidence contracts/testing.md#execution-ownership The test-unplugin runner discovers this source unit. It calls authored createViteServeInputWatch through supported watch/poll/caseSensitive capabilities, with temporary filesystem identity inputs and no native observer, compiler, built entry or product host. The five private scenarios are not independently selected by Evidence; their native explanations accompany their bodies. Real filesystem notification and live Vite hook dispatch remain in test-e2e.
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

/**
 * Verifies an existing subscription rejects a stale compile observation.
 *
 * Restoring stable bytes after the compile read transient bytes cannot certify
 * that compile's input proof.
 *
 * 1. Register stable bytes, capture a new pass and transient input evidence.
 * 2. Restore bytes, emit a change and require the stale replacement to invalidate.
 *
 * Behavioral verification: replace must invalidate the importer when newly supplied transient host evidence differs from the restored disk bytes after a witnessed change.
 * Independent expectations: Authored stable and transient strings determine that mismatch; the expected importer presence is independent of captured production hashes.
 * Distinguishing cases: An initially current registration contrasts with replacement carrying the transient compile state after bytes are restored.
 * Execution ownership: The exported race/lifetime entry invokes this private scenario through its failure-collecting loop. Injected notification handles and finally disposal execute portable observer semantics without a host.
 */
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

/**
 * Verifies a newly discovered external scope rejects an uncovered compile change.
 *
 * A watcher opened after a compile cannot use event silence to certify the old
 * bytes that compile read.
 *
 * 1. Capture before bytes, open the observer and begin a compile interval.
 * 2. Write after bytes before registering the external input and require invalidation.
 *
 * Behavioral verification: replace must reject before evidence for a newly subscribed external file now holding after bytes, without a native event.
 * Independent expectations: Literal before/after bytes and the importer identity specify the stale-proof outcome independently of subscription timing code.
 * Distinguishing cases: This scenario owns the new external subscription with changed bytes; the existing subscription counterpart owns event-witness replacement.
 * Execution ownership: The exported race/lifetime loop invokes this private scenario and retains its failure name. Watch/poll seams and finally dispose keep it in process with no host or native notification.
 */
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

/**
 * Verifies polling detects writes through an external hardlink.
 *
 * The write's alias lies outside all injected watched scopes, so no event is
 * supplied for it.
 *
 * 1. Register an input that shares an inode with an external hardlink.
 * 2. Write after bytes through the alias, tick the captured poll and require invalidation.
 *
 * Behavioral verification: The actual hardlink write must invalidate its registered importer when the captured fallback poll runs.
 * Independent expectations: fs.linkSync gives both paths the same actual inode; literal before/after bytes and importer identity establish the required invalidation.
 * Distinguishing cases: Current registration precedes the external-alias edit with no event. The shared poll must exist for the multiply linked input and detect the changed bytes.
 * Execution ownership: The exported race/lifetime loop discovers this private scenario and collects its named failure. Files are real but watch/poll handles are injected, and finally awaits disposal.
 */
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

/**
 * Verifies case-policy facts survive ordinary replacement and expire on topology changes.
 *
 * Changing an identity context under live event indexes would break lookup;
 * topology removal and server restart must instead re-establish it atomically.
 *
 * 1. Register and replace inputs, requiring policy probe reuse while topology is stable.
 * 2. Change the supplied policy, emit a rename and require probes after removal.
 * 3. Dispose, attach again and require fresh policy probes.
 *
 * Behavioral verification: Literal case probe counts distinguish stable registration reuse, no premature reset on rename, later removal reset and disposed-server rediscovery.
 * Independent expectations: A supplied caseSensitive callback counts actual capability reads. Unchanged counts and strict increases follow the memo lifetime contract, rather than reproducing its map operations.
 * Distinguishing cases: Ordinary replacement, rename before removal, removal after rename and disposal/re-attachment each have distinct probe expectations.
 * Execution ownership: The exported race/lifetime entry invokes this private scenario; a Darwin platform/case capability seam and watch/poll doubles exercise policy lifetimes without native observation. Finally disposes after any assertion.
 */
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

  try {
    register();
    const firstSessionProbes = caseProbes;
    assert.ok(firstSessionProbes > 0, "the simulated Darwin host must be probed");
    // Ordinary replacement preserves remembered policy while topology is stable.
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
    // Removal after the rename is the atomic point that re-probes policy.
    watch.replace(importer, [{ file: other }]);
    register();
    const afterRename = caseProbes;
    assert.ok(
      afterRename > firstSessionProbes,
      "a removal after a rename must rediscover the case policy",
    );
    await watch.dispose();
    register();
    assert.ok(
      caseProbes > afterRename,
      "a replacement server must rediscover case policy instead of retaining the old session's path cache",
    );
  } finally {
    await watch.dispose();
  }
}

/**
 * Verifies forgetting the final importer releases shared hardlink fallback work.
 *
 * Removing one of two input owners must preserve the other owner's polling;
 * removing the last must close that scheduler once.
 *
 * 1. Register two importers for one actual multiply linked input.
 * 2. Forget each in turn, requiring retention then one immediate scheduler close.
 * 3. Dispose and require that detached scheduler is not closed again.
 *
 * Behavioral verification: forget preserves a poll after the first owner leaves, clears it after the second and records exactly one close even after disposal.
 * Independent expectations: Two literal importer identities own one shared input. Scheduler presence and close counts 0 then 1 independently express last-owner lifetime.
 * Distinguishing cases: One removed importer contrasts with the final removed importer and subsequent disposal. This verifies forget directly, without claiming the Vite watchChange hook called it.
 * Execution ownership: The exported race/lifetime loop calls this private scenario and retains its failure name. Real hardlink inputs reach authored watch.forget through injected handles; finally awaits disposal without a Vite host.
 */
async function assertViteDeletedImporterReleasesFallback(
  root: string,
): Promise<void> {
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

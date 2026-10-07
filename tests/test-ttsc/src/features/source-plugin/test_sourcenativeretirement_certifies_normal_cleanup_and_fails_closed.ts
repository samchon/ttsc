import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { SourceNativeRetirement } from "../../../../../packages/ttsc/src/internal/SourceNativeRetirement";
import { OwnedSynchronousProcess } from "../../../../../packages/ttsc/src/internal/OwnedSynchronousProcess";
import { CapabilityPluginResult } from "../../../../../packages/ttsc/src/plugin/internal/CapabilityPluginResult";
import { withGoBuildCacheLease } from "../../../../../packages/ttsc/src/plugin/internal/source/withGoBuildCacheLease";
import { acquirePluginBuildLock } from "../../../../../packages/ttsc/src/plugin/internal/source/acquirePluginBuildLock";
import { inspectPluginBuildLock } from "../../../../../packages/ttsc/src/plugin/internal/source/inspectPluginBuildLock";
import { releasePluginBuildLock } from "../../../../../packages/ttsc/src/plugin/internal/source/releasePluginBuildLock";
import { waitForPluginBinary } from "../../../../../packages/ttsc/src/plugin/internal/source/waitForPluginBinary";
import { PluginBuildLockProtocol } from "../../../../../packages/ttsc/src/plugin/internal/source/PluginBuildLockProtocol";
import { prunePluginCacheRoot } from "../../../../../packages/ttsc/src/plugin/internal/source/prunePluginCacheRoot";
import { pruneGoBuildCacheRoot } from "../../../../../packages/ttsc/src/plugin/internal/source/pruneGoBuildCacheRoot";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies admission, publication failures and qualified cleanup retries.
 *
 * 1. Contrast joined and never-started outcomes with unresolved pending work.
 * 2. Exercise exact-created file ownership and every publication cleanup failure.
 * 3. Preserve terminal-link removal and retry the original failed cleanup.
 *
 * @evidence contracts/testing.md#behavioral-verification Source calls publish real guards, then assert admission and clean refusal until a certified outcome removes them. A cleanup callback that fails once must remain retryable with the same original capability; malformed guard bytes and a real filesystem publication collision fail closed. Explicit task-local operations use real files/descriptors and inject open/write/close/rename/remove failures; original error identities and exact diagnostics survive the actual legacy fromTask catch. Actual partial guards left by rollback refusal still block acquire/inspect/direct retire/release, recursive clean and zero-byte/100-day plugin and Go GC.
 * @evidence contracts/testing.md#independent-expectations Literal input bytes and callback counts establish cleanup ownership independently of guard internals. A terminal junction is deletable without deleting its guarded destination; pending native admission remains blocked while actual acquire-null/inspect-active bounded wait preserves normal fanout; binary reuse resumes only after qualified settlement.
 * @evidence contracts/testing.md#distinguishing-cases Joined and not-started outcomes contrast with pending and unknown. Repeated safe settlement contrasts with a conflicting certificate; malformed metadata contrasts with absent metadata. Publication failure admits no command; initial open refusal/foreign EEXIST, partial writes, close refusal, rollback refusal, combinations and second-root failures distinguish ownership registration. Update foreign EEXIST, partial write, close refusal, rename plus cleanup failure and foreign recreation after successful transfer distinguish candidate ownership. Failed candidate removal survives into qualified recovery; a second refusal preserves its original error and exact path across legacy catches before successful retry. Successful rollback and certified cleanup relinquish pathname authority before foreign recreation; multi-root cleanup collects every original refusal and retries only still-owned paths. Original recovery contrasts with an unrelated boundary token.
 * @evidence contracts/testing.md#execution-ownership One source-unit entry owns temporary directories and a terminal directory link, uses no Go compiler or installed SDK, and collects every authored case before reporting failure. Original descriptors intentionally left open by a typed close refusal are directly closed in finally before test-owned paths are removed. Foreign bytes are asserted before their author removes them; no foreign fs API is patched. Typed I/O faults exercise real files/fds but do not claim actual OS refusal, native retirement or supervisor reproduction.
 */
export function test_sourcenativeretirement_certifies_normal_cleanup_and_fails_closed(): void {
  const root = TestProject.physicalPath(TestProject.tmpdir("ttsc-retention-protocol-"));
  const failures: unknown[] = [];
  const check = (name: string, task: () => void): void => {
    try { task(); } catch (error) { failures.push(new Error(name, { cause: error })); }
  };
  try {
    const originals = (error: unknown): unknown[] => error instanceof AggregateError
      ? error.errors.flatMap(originals)
      : [error];
    for (const faults of [
      { name: "open", open: true, write: false, close: false, rollback: false },
      { name: "partial-write", open: false, write: true, close: false, rollback: false },
      { name: "close", open: false, write: false, close: true, rollback: false },
      { name: "write-close", open: false, write: true, close: true, rollback: false },
      { name: "write-rollback", open: false, write: true, close: false, rollback: true },
      { name: "write-close-rollback", open: false, write: true, close: true, rollback: true },
    ]) check(`exact-created initial ownership ${faults.name}`, () => {
      const container = path.join(root, `initial-${faults.name}`);
      const cache = path.join(container, "cache");
      const lock = `${cache}.lock`;
      const directory = PluginBuildLockProtocol.pluginBuildLockProtocolDir(lock);
      fs.mkdirSync(directory, { recursive: true });
      const scope = SourceNativeRetirement.createScope(faults.name);
      const opened = new Set<number>();
      const owned: string[] = [];
      const removed: string[] = [];
      const reported: unknown[] = [];
      const openError = new Error("authored open EACCES");
      const writeError = new Error("authored partial write EIO");
      const closeError = new Error("authored close EIO");
      const rollbackError = new Error("authored rollback EACCES");
      let observed: unknown;
      let admitted = false;
      scope.guardFileOperations = {
        ...fs,
        openSync: (file, flags, mode) => {
          if (faults.open) throw openError;
          const fd = fs.openSync(file, flags, mode);
          opened.add(fd);
          owned.push(file.toString());
          return fd;
        },
        writeFileSync: (file, bytes, options) => {
          assert.ok(typeof file === "number");
          if (faults.write) { fs.writeSync(file, "{"); throw writeError; }
          fs.writeFileSync(file, bytes, options);
        },
        closeSync: (fd) => {
          if (faults.close) throw closeError;
          fs.closeSync(fd);
          opened.delete(fd);
        },
        rmSync: (file, options) => {
          removed.push(file.toString());
          if (faults.rollback) throw rollbackError;
          fs.rmSync(file, options);
        },
      };
      try {
        const outcome = SourceNativeRetirement.run(scope, () => OwnedSynchronousProcess.run({ cancel: new SharedArrayBuffer(4), failures: reported }, () => {
          SourceNativeRetirement.register({ fenceRoot: directory, retainedPaths: [directory] });
          return CapabilityPluginResult.fromTask(() => {
            try { SourceNativeRetirement.begin("not-admitted"); }
            catch (error) { observed = error; throw error; }
            admitted = true;
            return CapabilityPluginResult.unavailable();
          });
        }));
        assert.equal(outcome.status, "unavailable");
        assert.equal(admitted, false);
        assert.ok(observed instanceof AggregateError);
        assert.ok(observed.message.includes(JSON.stringify(directory).slice(1, -1)));
        for (const [enabled, error] of [[faults.open, openError], [faults.write, writeError], [faults.close, closeError], [faults.rollback, rollbackError]] as const)
          if (enabled) assert.ok(originals(observed).includes(error));
        assert.equal(owned.length, faults.open ? 0 : 1);
        assert.deepEqual(removed, owned);
        assert.equal(SourceNativeRetirement.run(scope, () => SourceNativeRetirement.canRelease()), true);
        assert.equal(reported.includes(observed), faults.close || faults.rollback);
        assert.equal(SourceNativeRetirement.isProtected(directory), faults.rollback);
        if (faults.rollback) {
          const generation = "0".repeat(32);
          assert.throws(() => acquirePluginBuildLock(lock), /quarantined/);
          assert.throws(() => inspectPluginBuildLock(lock), /quarantined/);
          assert.throws(() => PluginBuildLockProtocol.retireV3PluginBuildLock(directory, generation), /protected/);
          assert.throws(() => releasePluginBuildLock(lock, { protocol: "v3", generation, completionNonce: generation }), /protected/);
          assert.throws(() => SourceNativeRetirement.assertCleanable(container), /protected/);
          fs.mkdirSync(cache);
          const payload = path.join(cache, "plugin");
          fs.writeFileSync(payload, "protected plugin bytes");
          const bucket = path.join(directory, "00");
          fs.mkdirSync(bucket);
          const object = path.join(bucket, "authored-object");
          fs.writeFileSync(object, "protected Go object");
          const prune = { force: true, now: Date.now() + 100 * 24 * 60 * 60 * 1_000, maxBytes: 0, targetBytes: 0, protectedAgeMs: 0 };
          prunePluginCacheRoot(container, prune);
          pruneGoBuildCacheRoot(directory, prune);
          assert.equal(fs.readFileSync(payload, "utf8"), "protected plugin bytes");
          assert.equal(fs.readFileSync(object, "utf8"), "protected Go object");
        }
      } finally {
        for (const fd of opened) fs.closeSync(fd);
        for (const file of owned) fs.rmSync(file, { force: true });
      }
    });
    check("initial foreign EEXIST remains owned by its original boundary", () => {
      const directory = path.join(root, "initial-foreign");
      fs.mkdirSync(directory);
      const original = SourceNativeRetirement.createScope("same-file-identity");
      SourceNativeRetirement.run(original, () => {
        SourceNativeRetirement.register({ fenceRoot: directory, retainedPaths: [directory] });
        SourceNativeRetirement.begin("same-boundary-token");
      });
      const guardDir = path.join(directory, ".ttsc-native-retirements");
      const file = path.join(guardDir, fs.readdirSync(guardDir)[0]!);
      const bytes = fs.readFileSync(file);
      const other = SourceNativeRetirement.createScope("same-file-identity");
      try {
        SourceNativeRetirement.run(other, () => {
          SourceNativeRetirement.register({ fenceRoot: directory, retainedPaths: [directory] });
          assert.throws(() => SourceNativeRetirement.begin("same-boundary-token"), AggregateError);
        });
        assert.deepEqual(fs.readFileSync(file), bytes);
        assert.equal(SourceNativeRetirement.isProtected(directory), true);
      } finally { SourceNativeRetirement.run(original, () => SourceNativeRetirement.settle("same-boundary-token", "not-started")); }
    });
    check("second root partial creation rolls back both owned roots", () => {
      const scope = SourceNativeRetirement.createScope("multiple-publications");
      const directories = [path.join(root, "first-publication"), path.join(root, "second-publication")];
      for (const directory of directories) fs.mkdirSync(directory);
      let writes = 0;
      const error = new Error("second actual descriptor write failed");
      scope.guardFileOperations = { ...fs, writeFileSync: (file, bytes, options) => {
        assert.ok(typeof file === "number");
        if (++writes === 2) { fs.writeSync(file, "{"); throw error; }
        fs.writeFileSync(file, bytes, options);
      } };
      SourceNativeRetirement.run(scope, () => {
        for (const directory of directories) SourceNativeRetirement.register({ fenceRoot: directory, retainedPaths: [directory] });
        assert.throws(() => SourceNativeRetirement.begin("multiple-roots"), (failure) => originals(failure).includes(error));
      });
      for (const directory of directories) assert.equal(SourceNativeRetirement.isProtected(directory), false);
    });
    for (const retirement of ["joined", "not-started", "rollback"] as const) check(`removed guard relinquishes pathname ${retirement}`, () => {
      const directory = path.join(root, `relinquished-${retirement}`);
      fs.mkdirSync(directory);
      const scope = SourceNativeRetirement.createScope(`relinquished-${retirement}`);
      let file = "";
      scope.guardFileOperations = { ...fs,
        openSync: (target, flags, mode) => { const fd = fs.openSync(target, flags, mode); file = target.toString(); return fd; },
        writeFileSync: (target, bytes, options) => {
          if (retirement === "rollback") throw new Error("authored pre-admission write refusal");
          fs.writeFileSync(target, bytes, options);
        },
      };
      SourceNativeRetirement.run(scope, () => {
        SourceNativeRetirement.register({ fenceRoot: directory, retainedPaths: [directory] });
        if (retirement === "rollback") assert.throws(() => SourceNativeRetirement.begin("boundary"), AggregateError);
        else { SourceNativeRetirement.begin("boundary"); SourceNativeRetirement.settle("boundary", retirement); }
      });
      assert.notEqual(file, "");
      fs.writeFileSync(file, "foreign recreated after relinquishment", { flag: "wx" });
      SourceNativeRetirement.recover(scope, "boundary", retirement === "joined" ? "joined" : "not-started");
      assert.equal(fs.readFileSync(file, "utf8"), "foreign recreated after relinquishment");
      fs.rmSync(file);
    });
    check("certified cleanup collects all roots and retries only retained ownership", () => {
      const scope = SourceNativeRetirement.createScope("cleanup-multiple-roots");
      const directories = [0, 1, 2].map((index) => path.join(root, `cleanup-root-${index}`));
      const files: string[] = [];
      const removals: string[] = [];
      const errors = [new Error("authored first cleanup refusal"), new Error("authored third cleanup refusal")];
      const reported: unknown[] = [];
      let observed: unknown;
      for (const directory of directories) fs.mkdirSync(directory);
      scope.guardFileOperations = { ...fs,
        openSync: (target, flags, mode) => { const fd = fs.openSync(target, flags, mode); files.push(target.toString()); return fd; },
        rmSync: (target, options) => {
          removals.push(target.toString());
          const index = files.indexOf(target.toString());
          if (index === 0) throw errors[0];
          if (index === 2) throw errors[1];
          fs.rmSync(target, options);
        },
      };
      SourceNativeRetirement.run(scope, () => {
        for (const directory of directories) SourceNativeRetirement.register({ fenceRoot: directory, retainedPaths: [directory] });
        SourceNativeRetirement.begin("boundary");
        OwnedSynchronousProcess.run({ cancel: new SharedArrayBuffer(4), failures: reported }, () => {
          const result = CapabilityPluginResult.fromTask(() => {
            try { SourceNativeRetirement.settle("boundary", "joined"); }
            catch (error) { observed = error; throw error; }
            return CapabilityPluginResult.unavailable();
          });
          assert.equal(result.status, "unavailable");
        });
      });
      assert.ok(observed instanceof AggregateError);
      for (const error of errors) assert.ok(originals(observed).includes(error));
      assert.equal(reported.includes(observed), true);
      assert.deepEqual(removals, files);
      assert.deepEqual(files.map((file) => fs.existsSync(file)), [true, false, true]);
      for (const file of [files[0]!, files[2]!]) assert.ok(observed.message.includes(JSON.stringify(file).slice(1, -1)));
      fs.writeFileSync(files[1]!, "foreign middle root after successful cleanup", { flag: "wx" });
      const retried: string[] = [];
      scope.guardFileOperations = { ...fs, rmSync: (target, options) => { retried.push(target.toString()); fs.rmSync(target, options); } };
      SourceNativeRetirement.recover(scope, "boundary", "joined");
      assert.deepEqual(retried, [files[0], files[2]]);
      assert.equal(fs.readFileSync(files[1]!, "utf8"), "foreign middle root after successful cleanup");
      fs.rmSync(files[1]!);
    });
    for (const fault of ["foreign-open", "partial-write", "close", "rename-cleanup", "renamed-foreign-replacement"] as const) check(`update candidate ownership ${fault}`, () => {
      const directory = path.join(root, `candidate-${fault}`);
      fs.mkdirSync(directory);
      const scope = SourceNativeRetirement.createScope(`candidate-${fault}`);
      SourceNativeRetirement.run(scope, () => {
        SourceNativeRetirement.register({ fenceRoot: directory, retainedPaths: [directory] });
        SourceNativeRetirement.begin("candidate-boundary");
      });
      const guardDir = path.join(directory, ".ttsc-native-retirements");
      const file = path.join(guardDir, fs.readdirSync(guardDir)[0]!);
      const oldBytes = fs.readFileSync(file);
      const opened = new Set<number>();
      const reported: unknown[] = [];
      const writeError = new Error("authored candidate partial write");
      const closeError = new Error("authored candidate close refusal");
      const renameError = new Error("authored replacement refusal");
      const removeError = new Error("authored candidate cleanup refusal");
      let candidate = "";
      let removed = false;
      let observed: unknown;
      scope.guardFileOperations = {
        ...fs,
        openSync: (target, flags, mode) => {
          candidate = target.toString();
          if (fault === "foreign-open") fs.writeFileSync(target, "foreign candidate bytes", { flag: "wx" });
          const fd = fs.openSync(target, flags, mode);
          opened.add(fd);
          return fd;
        },
        writeFileSync: (target, bytes, options) => {
          assert.ok(typeof target === "number");
          if (fault === "partial-write") { fs.writeSync(target, "{"); throw writeError; }
          fs.writeFileSync(target, bytes, options);
        },
        closeSync: (fd) => { if (fault === "close") throw closeError; fs.closeSync(fd); opened.delete(fd); },
        renameSync: (from, to) => {
          if (fault === "rename-cleanup") throw renameError;
          fs.renameSync(from, to);
          if (fault === "renamed-foreign-replacement") fs.writeFileSync(from, "foreign after transfer", { flag: "wx" });
        },
        rmSync: (target, options) => { removed = true; if (fault === "rename-cleanup") throw removeError; fs.rmSync(target, options); },
      };
      try {
        SourceNativeRetirement.run(scope, () => OwnedSynchronousProcess.run({ cancel: new SharedArrayBuffer(4), failures: reported }, () => {
          try { SourceNativeRetirement.settle("candidate-boundary", "unknown", "native closure unconfirmed"); }
          catch (error) { observed = error; }
        }));
        if (fault === "renamed-foreign-replacement") {
          assert.equal(observed, undefined);
          assert.equal(removed, false);
          assert.equal(fs.readFileSync(candidate, "utf8"), "foreign after transfer");
        } else {
          assert.ok(observed instanceof AggregateError);
          assert.ok(observed.message.includes(JSON.stringify(directory).slice(1, -1)));
          assert.deepEqual(fs.readFileSync(file), oldBytes);
          if (fault === "partial-write") assert.ok(originals(observed).includes(writeError));
          if (fault === "close") assert.ok(originals(observed).includes(closeError));
          if (fault === "rename-cleanup") for (const error of [renameError, removeError]) assert.ok(originals(observed).includes(error));
          assert.equal(reported.includes(observed), fault === "close" || fault === "rename-cleanup");
        }
        if (fault === "foreign-open") { assert.equal(removed, false); assert.equal(fs.readFileSync(candidate, "utf8"), "foreign candidate bytes"); }
        assert.equal(SourceNativeRetirement.isProtected(directory), true);
      } finally {
        for (const fd of opened) fs.closeSync(fd);
        if (fault === "foreign-open" || fault === "renamed-foreign-replacement") fs.rmSync(candidate);
        scope.guardFileOperations = undefined;
        if (fault === "rename-cleanup") {
          assert.equal(fs.existsSync(candidate), true);
          const recoveryError = new Error("authored candidate qualified cleanup refusal");
          const reported: unknown[] = [];
          let observed: unknown;
          scope.guardFileOperations = { ...fs, rmSync: (target, options) => {
            if (target.toString() === candidate) throw recoveryError;
            fs.rmSync(target, options);
          } };
          OwnedSynchronousProcess.run({ cancel: new SharedArrayBuffer(4), failures: reported }, () => {
            const result = CapabilityPluginResult.fromTask(() => {
              try { SourceNativeRetirement.recover(scope, "candidate-boundary", "not-started"); }
              catch (error) { observed = error; throw error; }
              return CapabilityPluginResult.unavailable();
            });
            assert.equal(result.status, "unavailable");
          });
          assert.ok(observed instanceof AggregateError);
          assert.ok(originals(observed).includes(recoveryError));
          assert.ok(observed.message.includes(JSON.stringify(candidate).slice(1, -1)));
          assert.equal(reported.includes(observed), true);
          assert.equal(fs.existsSync(candidate), true);
          assert.equal(SourceNativeRetirement.isProtected(directory), true);
          scope.guardFileOperations = undefined;
        }
        SourceNativeRetirement.recover(scope, "candidate-boundary", "not-started");
        assert.equal(SourceNativeRetirement.isProtected(directory), false);
      }
    });
    check("same-key pending preserves bounded wait and adopts only after joined", () => {
      const cache = path.join(root, "fanout");
      fs.mkdirSync(cache);
      const binaryPath = path.join(cache, "plugin");
      fs.writeFileSync(binaryPath, "same published binary");
      const lockDir = `${cache}.lock`;
      const scope = SourceNativeRetirement.createScope("same-key-original");
      const wait = () => waitForPluginBinary({ binaryPath, lockDir, lockInfo: { label: "plugin", pluginName: "same-key", quiet: true }, timeoutMs: 0 });
      SourceNativeRetirement.run(scope, () => {
        const lease = acquirePluginBuildLock(lockDir);
        assert.ok(lease);
        try {
          assert.equal(acquirePluginBuildLock(lockDir), null);
          assert.equal(inspectPluginBuildLock(lockDir).state, "active");
          assert.equal(wait().outcome, "published");
          SourceNativeRetirement.begin("pending-command");
          assert.equal(acquirePluginBuildLock(lockDir), null);
          assert.equal(inspectPluginBuildLock(lockDir).state, "active");
          assert.throws(wait, /timed out.*retained paths/);
          assert.equal(fs.readFileSync(binaryPath, "utf8"), "same published binary");
          SourceNativeRetirement.settle("pending-command", "joined");
          assert.equal(wait().outcome, "published");
        } finally { releasePluginBuildLock(lockDir, lease); }
      });
      const next = acquirePluginBuildLock(lockDir);
      assert.ok(next);
      releasePluginBuildLock(lockDir, next);
      assert.equal(fs.readFileSync(binaryPath, "utf8"), "same published binary");
    });
    for (const outcome of ["joined", "not-started"] as const) check(outcome, () => {
      const directory = path.join(root, outcome);
      fs.mkdirSync(directory);
      const scope = SourceNativeRetirement.createScope(outcome);
      let released = 0;
      SourceNativeRetirement.run(scope, () => {
        SourceNativeRetirement.register({ fenceRoot: directory, retainedPaths: [directory], generation: outcome });
        SourceNativeRetirement.begin("boundary");
        assert.equal(SourceNativeRetirement.isProtected(directory), true);
        SourceNativeRetirement.assertAvailable(directory);
        assert.equal(SourceNativeRetirement.isProtected(directory), true);
        SourceNativeRetirement.settle("boundary", outcome);
        SourceNativeRetirement.settle("boundary", "unknown", "late surrounding catch");
        SourceNativeRetirement.settle("boundary", outcome);
        assert.throws(() => SourceNativeRetirement.settle("boundary", outcome === "joined" ? "not-started" : "joined"), /cannot change/);
        SourceNativeRetirement.release(() => released++);
      });
      assert.equal(released, 1);
      assert.equal(SourceNativeRetirement.isProtected(directory), false);
      SourceNativeRetirement.assertAvailable(directory);
    });
    check("original recovery retries failed cleanup", () => {
      const directory = path.join(root, "recovery");
      fs.mkdirSync(directory);
      const scope = SourceNativeRetirement.createScope("recover-original");
      let attempts = 0;
      SourceNativeRetirement.run(scope, () => {
        SourceNativeRetirement.register({ fenceRoot: directory, retainedPaths: [directory] });
        SourceNativeRetirement.begin("boundary");
        SourceNativeRetirement.settle("boundary", "unknown", "unconfirmed close");
        assert.throws(() => SourceNativeRetirement.begin("must-not-admit-another-command"), /admission is closed/);
        assert.equal(scope.boundaries.has("must-not-admit-another-command"), false);
        SourceNativeRetirement.release(() => { if (++attempts === 1) throw new Error("authored cleanup refusal"); });
      });
      assert.throws(() => SourceNativeRetirement.recover(scope, "boundary", "joined"), /authored cleanup refusal/);
      SourceNativeRetirement.recover(scope, "boundary", "joined");
      assert.equal(attempts, 2);
      assert.equal(scope.deferred.length, 0);
    });
    check("terminal link does not clean guarded destination", () => {
      const directory = path.join(root, "guarded");
      fs.mkdirSync(directory);
      fs.writeFileSync(path.join(directory, "input"), "keep");
      const link = path.join(root, "terminal-link");
      fs.symlinkSync(directory, link, "junction");
      const scope = SourceNativeRetirement.createScope("link-original");
      SourceNativeRetirement.run(scope, () => {
        SourceNativeRetirement.register({ fenceRoot: directory, retainedPaths: [directory] });
        SourceNativeRetirement.begin("boundary");
        try {
          SourceNativeRetirement.assertCleanable(link);
          fs.rmSync(link, { recursive: true });
          assert.equal(fs.readFileSync(path.join(directory, "input"), "utf8"), "keep");
          assert.throws(() => SourceNativeRetirement.assertCleanable(directory), /protected/);
        } finally { SourceNativeRetirement.settle("boundary", "not-started"); }
      });
    });
    check("malformed metadata", () => {
      const directory = path.join(root, "malformed");
      const guard = path.join(directory, ".ttsc-native-retirements");
      fs.mkdirSync(guard, { recursive: true });
      fs.writeFileSync(path.join(guard, "unexpected.json"), "{}");
      assert.equal(SourceNativeRetirement.isProtected(directory), true);
      assert.throws(() => SourceNativeRetirement.assertAvailable(directory), /quarantined/);
      assert.throws(() => SourceNativeRetirement.assertCleanable(directory), /protected/);
    });
    check("publication collision admits no native command", () => {
      const directory = path.join(root, "publication-refusal");
      fs.mkdirSync(directory);
      fs.writeFileSync(path.join(directory, ".ttsc-native-retirements"), "not a directory");
      const scope = SourceNativeRetirement.createScope("publication-original");
      let admitted = false;
      SourceNativeRetirement.run(scope, () => {
        SourceNativeRetirement.register({ fenceRoot: directory, retainedPaths: [directory] });
        assert.throws(() => { SourceNativeRetirement.begin("boundary"); admitted = true; });
        assert.equal(admitted, false);
        assert.equal(SourceNativeRetirement.canRelease(), true);
        SourceNativeRetirement.settle("boundary", "unknown", "catch before native admission");
        assert.equal(SourceNativeRetirement.canRelease(), true);
      });
    });
    check("unknown diagnostic update refusal preserves protection", () => {
      const directory = path.join(root, "update-refusal");
      fs.mkdirSync(directory);
      const scope = SourceNativeRetirement.createScope("update-original");
      SourceNativeRetirement.run(scope, () => {
        SourceNativeRetirement.register({ fenceRoot: directory, retainedPaths: [directory] });
        SourceNativeRetirement.begin("boundary");
        const guards = path.join(directory, ".ttsc-native-retirements");
        const file = path.join(guards, fs.readdirSync(guards)[0]!);
        const original = fs.readFileSync(file);
        // A real destination-type conflict refuses the diagnostic rename.
        fs.rmSync(file);
        fs.mkdirSync(file);
        try {
          assert.throws(() => SourceNativeRetirement.settle("boundary", "unknown", "actual filesystem update refusal"), /native retirement is unknown/);
          assert.equal(SourceNativeRetirement.canRelease(), false);
          assert.equal(SourceNativeRetirement.isProtected(directory), true);
          assert.throws(() => SourceNativeRetirement.assertAvailable(directory), /quarantined/);
          assert.throws(() => SourceNativeRetirement.assertCleanable(directory), /protected/);
        } finally {
          fs.rmSync(file, { recursive: true });
          fs.writeFileSync(file, original);
        }
        SourceNativeRetirement.assertAvailable(directory);
        assert.equal(SourceNativeRetirement.isProtected(directory), true);
      });
      SourceNativeRetirement.recover(scope, "boundary", "not-started");
      assert.equal(SourceNativeRetirement.isProtected(directory), false);
    });
    check("unmanaged shared cache guards preserve concurrency and ordinary behavior", () => {
      const ordinary = path.join(root, "ordinary-missing-go");
      withGoBuildCacheLease(ordinary, false, (selected) => {
        assert.equal(selected, ordinary);
        assert.equal(fs.existsSync(selected), false);
      });
      assert.equal(fs.existsSync(ordinary), false);
      const shared = path.join(root, "scoped-unmanaged-go");
      const first = SourceNativeRetirement.createScope("unmanaged-original");
      SourceNativeRetirement.run(first, () => withGoBuildCacheLease(shared, false, () => {
        SourceNativeRetirement.begin("unmanaged-boundary");
        SourceNativeRetirement.settle("unmanaged-boundary", "unknown", "explicit unconfirmed outcome");
      }));
      assert.throws(() => SourceNativeRetirement.assertCleanable(shared), /protected/);
      const second = SourceNativeRetirement.createScope("independent-unmanaged");
      SourceNativeRetirement.run(second, () => withGoBuildCacheLease(shared, false, () => {
        SourceNativeRetirement.begin("independent-boundary");
        SourceNativeRetirement.settle("independent-boundary", "joined");
      }));
      assert.equal(SourceNativeRetirement.isProtected(shared), true);
      SourceNativeRetirement.recover(first, "unmanaged-boundary", "not-started");
      assert.equal(SourceNativeRetirement.isProtected(shared), false);
      assert.equal(fs.existsSync(shared), true);
    });
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
  if (failures.length !== 0) throw new AggregateError(failures, "retirement protocol cases failed");
}

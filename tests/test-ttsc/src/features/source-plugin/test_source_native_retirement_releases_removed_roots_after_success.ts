import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { OwnedSynchronousProcess } from "../../../../../packages/ttsc/src/internal/OwnedSynchronousProcess";
import { SourceNativeRetirement } from "../../../../../packages/ttsc/src/internal/SourceNativeRetirement";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies destructive cleanup releases only its successful original ownership.
 *
 * Physical lookup after deletion failed in active capability scopes; forgetting
 * first instead loses registration when cleanup fails. Capture must survive
 * aliases, deferred recovery and a reentrant replacement without masking the
 * task's original diagnostic.
 *
 * 1. Remove real owned directories in ordinary and scoped execution.
 * 2. Collect cleanup, missing-root, prior-error and replacement boundaries.
 * 3. Defer an actual registered root, fail its first qualified cleanup and retry.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls actual releaseResource, register, run, release/recover and ownership reporting; checks real directory removal, exact registration identity, original failure references, aggregate membership and deferred FIFO retry.
 * @evidence contracts/testing.md#independent-expectations A removed directory must need no later physical lookup, failed cleanup must keep its original registration, and cleanup may not delete a replacement registration. Authored original error references, literal callback order and independently observed filesystem presence determine expectations.
 * @evidence contracts/testing.md#distinguishing-cases Owns ordinary and scoped success, physical alias, immediate callback refusal, already-removed root refusal, original Error and thrown undefined with cleanup failure, successful cleanup with an earlier failure, same-root replacement generation, unknown deferral, wrong recovery, failed qualified cleanup and successful retry under another enclosing scope. Every independent case is collected before the aggregate result.
 * @evidence contracts/testing.md#execution-ownership One source-unit entry invokes maintained ownership APIs on real temporary directories and an actual directory alias. Authored cleanup callbacks supply explicit error-boundary oracles without replacing filesystem methods. The no-process boundary classification exercises policy and does not certify kernel retirement; active actual Go metadata success/error remain in the neighboring context unit.
 */
export function test_source_native_retirement_releases_removed_roots_after_success(): void {
  const parent = TestProject.physicalPath(TestProject.tmpdir("native-resource-release-"));
  const errors: unknown[] = [];
  const check = (name: string, task: () => void): void => {
    try { task(); } catch (cause) { errors.push(new Error(name, { cause })); }
  };
  const directory = (name: string): string => {
    const root = path.join(parent, name);
    fs.mkdirSync(root);
    return root;
  };
  check("ordinary cleanup", () => {
    const root = directory("ordinary");
    SourceNativeRetirement.releaseResource(root, () => fs.rmSync(root, { recursive: true }));
    assert.equal(fs.existsSync(root), false);
  });
  check("scoped physical identity", () => {
    const root = directory("scoped");
    const scope = SourceNativeRetirement.createScope("scoped-success");
    SourceNativeRetirement.run(scope, () => {
      SourceNativeRetirement.register({ fenceRoot: root, retainedPaths: [root] });
      const original = scope.resources.get(root);
      SourceNativeRetirement.releaseResource(root, () => {
        assert.equal(scope.resources.get(root), original);
        fs.rmSync(root, { recursive: true });
      });
    });
    assert.equal(fs.existsSync(root), false);
    assert.equal(scope.resources.size, 0);
  });
  check("physical alias", () => {
    const root = directory("alias-target");
    const alias = path.join(parent, "alias");
    fs.symlinkSync(root, alias, process.platform === "win32" ? "junction" : "dir");
    const scope = SourceNativeRetirement.createScope("alias-success");
    try {
      SourceNativeRetirement.run(scope, () => {
        SourceNativeRetirement.register({ fenceRoot: root, retainedPaths: [root] });
        SourceNativeRetirement.releaseResource(alias, () => fs.rmSync(root, { recursive: true }));
      });
      assert.equal(fs.existsSync(root), false);
      assert.equal(scope.resources.size, 0);
    } finally { fs.rmSync(alias, { recursive: true, force: true }); }
  });
  check("failed cleanup retains registration and original refusal", () => {
    const root = directory("failed");
    const scope = SourceNativeRetirement.createScope("cleanup-refusal");
    const refused = new Error("authored removal refusal");
    const failures: unknown[] = [];
    SourceNativeRetirement.run(scope, () => OwnedSynchronousProcess.run({
      cancel: new SharedArrayBuffer(4), failures,
    }, () => {
      SourceNativeRetirement.register({ fenceRoot: root, retainedPaths: [root], generation: "original" });
      const original = scope.resources.get(root);
      assert.throws(() => SourceNativeRetirement.releaseResource(root, () => { throw refused; }), error => error === refused);
      assert.equal(scope.resources.get(root), original);
      assert.equal(fs.existsSync(root), true);
      assert.deepEqual(failures, [refused]);
      SourceNativeRetirement.releaseResource(root, () => fs.rmSync(root, { recursive: true }));
    }));
    assert.equal(scope.resources.size, 0);
  });
  check("missing root does not guess identity or invoke cleanup", () => {
    const root = directory("missing");
    const scope = SourceNativeRetirement.createScope("missing-root");
    const failures: unknown[] = [];
    SourceNativeRetirement.run(scope, () => OwnedSynchronousProcess.run({
      cancel: new SharedArrayBuffer(4), failures,
    }, () => {
      SourceNativeRetirement.register({ fenceRoot: root, retainedPaths: [root] });
      const original = scope.resources.get(root);
      fs.rmSync(root, { recursive: true });
      let invoked = false;
      assert.throws(() => SourceNativeRetirement.releaseResource(root, () => { invoked = true; }, { error: undefined }), error => {
        assert.ok(error instanceof AggregateError);
        assert.equal(error.errors[0], undefined);
        assert.equal(error.errors[1].code, "ENOENT");
        assert.equal(failures[0], error);
        return true;
      });
      assert.equal(invoked, false);
      assert.equal(scope.resources.get(root), original);
    }));
  });
  for (const original of [new Error("original task diagnostic"), undefined]) {
    check(`prior failure ${original === undefined ? "undefined" : "Error"}`, () => {
      const root = directory(original === undefined ? "undefined" : "original-error");
      const scope = SourceNativeRetirement.createScope("original-failure");
      const refused = new Error("authored cleanup refusal");
      const failures: unknown[] = [];
      SourceNativeRetirement.run(scope, () => OwnedSynchronousProcess.run({
        cancel: new SharedArrayBuffer(4), failures,
      }, () => {
        SourceNativeRetirement.register({ fenceRoot: root, retainedPaths: [root] });
        let caught: unknown;
        try { SourceNativeRetirement.releaseResource(root, () => { throw refused; }, { error: original }); }
        catch (error) { caught = error; }
        assert.ok(caught instanceof AggregateError);
        assert.deepEqual(caught.errors, [original, refused]);
        assert.equal(caught.errors[0], original);
        assert.equal(caught.errors[1], refused);
        assert.deepEqual(failures, [caught]);
        assert.equal(scope.resources.size, 1);
        SourceNativeRetirement.releaseResource(root, () => fs.rmSync(root, { recursive: true }), { error: original });
      }));
      assert.equal(scope.resources.size, 0);
    });
  }
  check("reentrant replacement is retained", () => {
    const root = directory("replacement");
    const scope = SourceNativeRetirement.createScope("replacement-generation");
    SourceNativeRetirement.run(scope, () => {
      SourceNativeRetirement.register({ fenceRoot: root, retainedPaths: [root], generation: "first" });
      const original = scope.resources.get(root);
      SourceNativeRetirement.releaseResource(root, () => {
        SourceNativeRetirement.forget(root, "first");
        SourceNativeRetirement.register({ fenceRoot: root, retainedPaths: [root], generation: "second" });
      });
      assert.notEqual(scope.resources.get(root), original);
      assert.equal(scope.resources.get(root)?.generation, "second");
      SourceNativeRetirement.releaseResource(root, () => fs.rmSync(root, { recursive: true }));
    });
    assert.equal(scope.resources.size, 0);
  });
  check("unknown ownership and qualified recovery", () => {
    const root = directory("deferred");
    const otherRoot = directory("other-scope");
    const scope = SourceNativeRetirement.createScope("deferred-original");
    const other = SourceNativeRetirement.createScope("enclosing-other");
    const refused = new Error("first deferred cleanup refused");
    const original = new Error("original interrupted task");
    const failures: unknown[] = [];
    let attempts = 0;
    SourceNativeRetirement.run(scope, () => {
      SourceNativeRetirement.register({ fenceRoot: root, retainedPaths: [root], generation: "held" });
      SourceNativeRetirement.begin("authored-no-process-boundary");
      SourceNativeRetirement.settle("authored-no-process-boundary", "unknown", "authored unresolved classification");
      SourceNativeRetirement.releaseResource(root, () => {
        if (++attempts === 1) throw refused;
        fs.rmSync(root, { recursive: true });
      }, { error: original });
    });
    assert.equal(attempts, 0);
    assert.equal(scope.resources.size, 1);
    assert.equal(scope.deferred.length, 1);
    assert.equal(SourceNativeRetirement.isProtected(root), true);
    assert.throws(() => SourceNativeRetirement.recover(scope, "wrong-boundary", "joined"), /unresolved/);
    OwnedSynchronousProcess.run({ cancel: new SharedArrayBuffer(4), failures }, () => {
      assert.throws(() => SourceNativeRetirement.recover(scope, "authored-no-process-boundary", "joined"), error => {
        assert.ok(error instanceof AggregateError);
        assert.deepEqual(error.errors, [original, refused]);
        return true;
      });
    });
    assert.equal(attempts, 1);
    assert.equal(fs.existsSync(root), true);
    assert.equal(scope.resources.size, 1);
    assert.equal(scope.deferred.length, 1);
    assert.equal(failures.length, 1);
    SourceNativeRetirement.run(other, () => {
      SourceNativeRetirement.register({ fenceRoot: otherRoot, retainedPaths: [otherRoot] });
      SourceNativeRetirement.recover(scope, "authored-no-process-boundary", "joined");
      assert.equal(other.resources.size, 1);
      SourceNativeRetirement.releaseResource(otherRoot, () => fs.rmSync(otherRoot, { recursive: true }));
    });
    assert.equal(attempts, 2);
    assert.equal(fs.existsSync(root), false);
    assert.equal(scope.resources.size, 0);
    assert.equal(scope.deferred.length, 0);
    assert.equal(other.resources.size, 0);
  });
  if (errors.length !== 0) throw new AggregateError(errors, "Destructive resource release population");
}

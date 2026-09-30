import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createSuiteResources } from "../internal/createSuiteResources";
import { closeBenchmarkWatches, startScriptWatch } from "../internal/startScriptWatch";

/**
 * Checks actual directory identity and link boundaries without installing a workspace.
 *
 * @evidence contracts/testing.md#behavioral-verification Native directories are removed on normal and missing-root completion; replacing an owned root with another directory or a junction rejects reclamation and preserves the replacement and target. Windows stores are released independently when another owned root is unsafe.
 * @evidence contracts/testing.md#independent-expectations Literal sentinel bytes must survive rejected deletion and exact owned paths must disappear after successful release. The Windows store location follows the production workspace path policy; identity and link assertions compare actual independent filesystem objects rather than a helper-produced expected status.
 * @evidence contracts/testing.md#distinguishing-cases Covers normal removal with a nested external link target preserved, already-missing, replaced identity, linked replacement and outside-workspace refusal. Windows adds a newly created store, refusal of a preexisting store and a file replacement that must remain while the independent suite root is removed.
 * @evidence contracts/testing.md#execution-ownership This named E2E function is discovered by the benchmark runner. All roots are newly created by this invocation and explicit finally cleanup only names those paths; it never passes historical stores into the resource owner.
 * @evidence contracts/e2e.md#necessary-boundary Native file identities and Windows junction entries determine whether recursive deletion is safe; two actual pnpm/Node watches establish native close before reclamation. No compiler, package archive, browser or measured campaign is needed.
 * @evidence contracts/e2e.md#shared-execution Several small ownership lifetimes share this one native regression entry and need no repeated packed toolchain or workspace install.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each lifetime receives a fresh mkdtemp nonce. Replacement and target trees have separate identities; actual watch children are joined before any final exact-path fixture cleanup, including an intentionally retained session recovered by the suite registry.
 * @evidence contracts/e2e.md#preserved-coverage This adds the previously absent release and rejection boundaries; all existing preparation and workspace assertions remain in their original cases.
 */
export async function test_benchmark_suite_releases_only_its_owned_resources(): Promise<void> {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "benchmark-release-case-"));
  const owned: string[] = [fixture];
  let primaryError: unknown;
  const make = () => {
    const resource = createSuiteResources();
    owned.push(resource.directory);
    return resource;
  };
  const storePath = (workspace: string) => path.join(
    path.parse(workspace).root,
    ".ttsc-vstore",
    crypto.createHash("sha256").update(workspace.toLowerCase()).digest("hex").slice(0, 12),
  );
  try {
    const normal = make();
    fs.writeFileSync(path.join(normal.directory, "owned.txt"), "owned");
    const outsideTarget = path.join(fixture, "outside-target");
    fs.mkdirSync(outsideTarget);
    fs.writeFileSync(path.join(outsideTarget, "retain.txt"), "outside owned removal");
    fs.symlinkSync(outsideTarget, path.join(normal.directory, "external-link"),
      process.platform === "win32" ? "junction" : "dir");
    normal.release();
    normal.release();
    assert.equal(fs.existsSync(normal.directory), false);
    assert.equal(fs.readFileSync(path.join(outsideTarget, "retain.txt"), "utf8"), "outside owned removal");

    const missing = make();
    fs.rmSync(missing.directory, { recursive: true });
    missing.release();

    const replaced = make();
    assert.throws(() => replaced.beforeWorkspace(fixture), /outside the owned suite/);
    const replacementBackup = path.join(fixture, "original-directory");
    fs.renameSync(replaced.directory, replacementBackup);
    fs.mkdirSync(replaced.directory);
    fs.writeFileSync(path.join(replaced.directory, "replacement.txt"), "retain replacement");
    assert.throws(() => replaced.release(), AggregateError);
    assert.equal(fs.readFileSync(path.join(replaced.directory, "replacement.txt"), "utf8"), "retain replacement");

    const linked = make();
    const linkBackup = path.join(fixture, "original-linked-directory");
    const target = path.join(fixture, "target");
    fs.mkdirSync(target);
    fs.writeFileSync(path.join(target, "target.txt"), "retain target");
    fs.renameSync(linked.directory, linkBackup);
    fs.symlinkSync(target, linked.directory, process.platform === "win32" ? "junction" : "dir");
    assert.throws(() => linked.release(), AggregateError);
    assert.equal(fs.lstatSync(linked.directory).isSymbolicLink(), true);
    assert.equal(fs.readFileSync(path.join(target, "target.txt"), "utf8"), "retain target");

    if (process.platform === "win32") {
      const storeOwner = make();
      const workspace = path.join(storeOwner.directory, "evidence", "workspace");
      const capture = storeOwner.beforeWorkspace(workspace);
      const store = storePath(workspace);
      owned.push(store);
      fs.mkdirSync(store, { recursive: true });
      fs.writeFileSync(path.join(store, "package.txt"), "owned package");
      capture();
      const storeOwnerBackup = path.join(fixture, "store-owner-original");
      fs.renameSync(storeOwner.directory, storeOwnerBackup);
      fs.mkdirSync(storeOwner.directory);
      assert.throws(() => storeOwner.release(), AggregateError);
      assert.equal(fs.existsSync(store), false);
      assert.equal(fs.existsSync(storeOwner.directory), true);

      const preexisting = make();
      const preexistingWorkspace = path.join(preexisting.directory, "plain", "workspace");
      const preexistingStore = storePath(preexistingWorkspace);
      owned.push(preexistingStore);
      fs.mkdirSync(preexistingStore, { recursive: true });
      fs.writeFileSync(path.join(preexistingStore, "retain.txt"), "preexisting");
      assert.throws(() => preexisting.beforeWorkspace(preexistingWorkspace), /preexisting benchmark store/);
      preexisting.release();
      assert.equal(fs.readFileSync(path.join(preexistingStore, "retain.txt"), "utf8"), "preexisting");

      const fileReplacement = make();
      const fileWorkspace = path.join(fileReplacement.directory, "plain", "workspace");
      const captureFileStore = fileReplacement.beforeWorkspace(fileWorkspace);
      const fileStore = storePath(fileWorkspace);
      owned.push(fileStore);
      fs.mkdirSync(fileStore, { recursive: true });
      captureFileStore();
      fs.rmdirSync(fileStore);
      fs.writeFileSync(fileStore, "retain file replacement");
      assert.throws(() => fileReplacement.release(), AggregateError);
      assert.equal(fs.existsSync(fileReplacement.directory), false);
      assert.equal(fs.readFileSync(fileStore, "utf8"), "retain file replacement");

      const both = make();
      const bothWorkspace = path.join(both.directory, "evidence", "workspace");
      const captureBoth = both.beforeWorkspace(bothWorkspace);
      const bothStore = storePath(bothWorkspace);
      owned.push(bothStore);
      fs.mkdirSync(bothStore, { recursive: true });
      captureBoth();
      fs.rmdirSync(bothStore);
      fs.writeFileSync(bothStore, "retain both-store replacement");
      fs.renameSync(both.directory, path.join(fixture, "both-owner-original"));
      fs.mkdirSync(both.directory);
      assert.throws(() => both.release(), (error: unknown) =>
        error instanceof AggregateError && error.errors.length === 2);
      assert.equal(fs.existsSync(both.directory), true);
      assert.equal(fs.readFileSync(bothStore, "utf8"), "retain both-store replacement");
    }

    fs.writeFileSync(path.join(fixture, "package.json"), JSON.stringify({
      name: "owned-release-watch",
      private: true,
      scripts: { gate: "node gate.cjs" },
    }));
    fs.writeFileSync(path.join(fixture, "gate.cjs"),
      'process.stdout.write("[ttsc] watch build complete\\n"); setInterval(() => {}, 1000);\n');
    const first = startScriptWatch({ cwd: fixture, script: "gate" });
    const retained = startScriptWatch({ cwd: fixture, script: "gate" });
    const cycles = await Promise.all([first.nextBuild(), retained.nextBuild()]);
    assert.deepEqual(cycles.map((cycle) => cycle.status), [0, 0]);
    await first.close();
    await closeBenchmarkWatches();
    // A completed registry join makes subsequent close idempotent.
    await retained.close();
  } catch (error) {
    primaryError = error;
    throw error;
  } finally {
    try {
      await closeBenchmarkWatches();
    } catch (error) {
      throw new AggregateError([primaryError, error].filter((value) => value !== undefined),
        `Release regression children did not close; fixture retained at ${fixture}.`);
    }
    const failures: unknown[] = [];
    for (const directory of owned.reverse())
      try {
        fs.rmSync(directory, { recursive: true, force: true, maxRetries: 3 });
      } catch (error) {
        failures.push(error);
      }
    if (failures.length !== 0)
      throw new AggregateError([primaryError, ...failures].filter((value) => value !== undefined),
        "Release fixture cleanup failed.");
  }
}

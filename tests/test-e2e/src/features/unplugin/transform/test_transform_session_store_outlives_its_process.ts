import { TestProject, TestUnpluginRuntime } from "@ttsc/testing";
import assert from "node:assert/strict";
import { E2eProcessTrace } from "../../../../../utils/src/E2eProcessTrace";
const { spawnSync } = E2eProcessTrace;
import fs from "node:fs";
import path from "node:path";

import { pathIsWithin } from "../../../../../../packages/unplugin/lib/core/transform/filesystem/pathIsWithin.mjs";
import type { TtscSharedCompilePublication } from "../../../../../../packages/unplugin/lib/core/transform/session/TtscSharedCompilePublication.mjs";
import { claimSharedCompile } from "../../../../../../packages/unplugin/lib/core/transform/session/claimSharedCompile.mjs";

/**
 * Verifies Next worker inheritance, fresh-process store persistence and real
 * terminated-owner claim takeover in one private workspace.
 *
 * The Next configuration process starts one worker. After both exit, their
 * actual PIDs supply legacy cleanup and lock takeover; a fresh API process
 * proves the persistent store survives and opens under the same user. Claims
 * retain the original publication, malformed-envelope, fencing and unusable
 * store cases in a private sibling store.
 *
 * 1. Open through Next and observe its worker inheriting the store.
 * 2. Reopen through a fresh API process after the original children exit,
 *    retaining the live and foreign directories while reclaiming dead owners.
 * 3. Exercise publication, takeover and fencing using the exited opener PID.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual Next adapter opens a store inherited by its child worker; two direct API calls in distinct processes report the same persisted store. Literal location, owner-mode, dead/live/foreign directory and publication/takeover/fencing assertions retain the three original entries' meanings.
 * @evidence contracts/testing.md#independent-expectations Actual child exit and ESRCH establish terminated owners independently of product liveness. Authored paths, publication fields, successor owner tokens and platform mode bits provide the original independent expectations; no compiled publication is inferred from a directory's existence.
 * @evidence contracts/testing.md#distinguishing-cases Keeps inherited versus freshly opened sessions, outside-project versus owned temp storage, persistent versus dead/live/foreign legacy directories, publication adoption/refusal/malformed data, dead-lock takeover, displaced release and unusable storage. Independent process, store and claim phases collect failures; unavailable child state explicitly blocks dependent PID assertions.
 * @evidence contracts/testing.md#execution-ownership This named E2E entry executes one Next process with one inherited worker and one later API process, then built claim APIs against actual files and a genuinely exited PID. Source units retain portable shared-identity/external-input comparisons; no native compiler runs here.
 * @evidence contracts/e2e.md#necessary-boundary Real environment inheritance, process termination, cross-process persistence, OS permissions and liveness-driven locks require the actual process/filesystem boundary. Direct option units cannot establish those connections.
 * @evidence contracts/e2e.md#shared-execution The former Next two children, session two openers plus dead-PID child and claim dead-PID child become three actual children: Next, its worker and the fresh opener. Completed child PIDs are reused as independent dead-owner witnesses; the explicit Next/worker preparation and later fresh opener account for those three children.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Unique temporary roots own the persistent and sibling claim stores. Child environments clear inherited session capability and redirect TEMP/TMP/TMPDIR. Synchronous process completion precedes PID and filesystem checks; normal claims release locks while failure cleanup remains bounded by tracked root removal and runner exit, rather than claiming every failed claim timer is explicitly cancelled.
 * @evidence contracts/e2e.md#preserved-coverage Original Next seven location/inheritance/cleanup/lifetime assertions, both API success checks and persistent/dead/live/foreign/mode assertions, and all claim publication/takeover/fencing/unusable assertions execute here. The first API call follows Next opening in the same fresh process; the second independently opens with its inherited capability cleared. Portable identity12 assertions retain their source-unit owner.
 */
export async function test_transform_session_store_outlives_its_process(): Promise<void> {
  const temporary = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-unplugin-session-root-"),
  );
  const user = process.getuid?.();
  const root = path.join(
    temporary,
    `ttsc-unplugin-sessions${user === undefined ? "" : `-${user}`}`,
  );
  fs.mkdirSync(root, { mode: 0o700, recursive: true });
  const errors: Error[] = [];
  const check = (label: string, body: () => void): void => {
    try {
      body();
    } catch (error) {
      errors.push(new Error(label, { cause: error }));
    }
  };
  const phase = async (
    label: string,
    body: () => Promise<void>,
  ): Promise<void> => {
    try {
      await body();
    } catch (error) {
      errors.push(new Error(label, { cause: error }));
    }
  };
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    TEMP: temporary,
    TMP: temporary,
    TMPDIR: temporary,
  };
  delete env.TTSC_UNPLUGIN_TRANSFORM_SESSION;
  const script = [
    'const fs = await import("node:fs");',
    'const os = await import("node:os");',
    'const path = await import("node:path");',
    `const { execFileSync } = (await import("node:module")).createRequire(import.meta.url)(${JSON.stringify(E2eProcessTrace.runtimePath)});`,
    "const user = process.getuid?.();",
    'const root = path.join(os.tmpdir(), `ttsc-unplugin-sessions${user === undefined ? "" : `-${user}`}`);',
    "fs.mkdirSync(root, { mode: 0o700, recursive: true });",
    'const orphan = path.join(root, "2147483646-orphan");',
    "try { process.kill(2147483646, 0); throw new Error('orphan fixture PID is alive'); } catch (error) { if (error.code !== 'ESRCH') throw error; }",
    "fs.mkdirSync(orphan, { recursive: true });",
    `const next = (await import(${JSON.stringify(TestUnpluginRuntime.libUrl("next"))})).default;`,
    "next({});",
    "const store = process.env.TTSC_UNPLUGIN_TRANSFORM_SESSION;",
    'const worker = JSON.parse(execFileSync(process.execPath, ["-e", "process.stdout.write(JSON.stringify({ inherited: process.env.TTSC_UNPLUGIN_TRANSFORM_SESSION ?? \'\', pid: process.pid }))"]).toString());',
    "const inherited = worker.inherited;",
    `const api = await import(${JSON.stringify(TestUnpluginRuntime.libUrl("api"))});`,
    "const reopened = api.openTtscTransformSession();",
    "process.stdout.write(JSON.stringify({ exists: fs.existsSync(store), inherited, orphan: fs.existsSync(orphan), pid: process.pid, reopened, store, workerPid: worker.pid }));",
  ].join("\n");

  let report:
    | {
        exists: boolean;
        inherited: string;
        orphan: boolean;
        pid: number;
        reopened: string;
        store: string;
        workerPid: number;
      }
    | undefined;
  await phase("Next opener and inherited worker", async () => {
    const opened = spawnSync(
      process.execPath,
      ["--input-type=module", "-e", script],
      { cwd: process.cwd(), encoding: "utf8", env, windowsHide: true },
    );
    assert.equal(opened.status, 0, opened.stderr);
    const received = JSON.parse(opened.stdout);
    assert.ok(
      received !== null &&
        typeof received === "object" &&
        typeof received.store === "string" &&
        typeof received.reopened === "string" &&
        typeof received.inherited === "string" &&
        typeof received.exists === "boolean" &&
        typeof received.orphan === "boolean" &&
        Number.isSafeInteger(received.pid) &&
        received.pid > 0 &&
        Number.isSafeInteger(received.workerPid) &&
        received.workerPid > 0,
      "Next process returned a complete session and actual child-PID report",
    );
    report = received;
    check("Next absolute store", () =>
      assert.ok(path.isAbsolute(report!.store), report!.store),
    );
    check("Next live store", () =>
      assert.ok(report!.exists, "the store exists while its process runs"),
    );
    check("Next worker inheritance", () =>
      assert.equal(
        report!.inherited,
        report!.store,
        "a forked worker inherits it",
      ),
    );
    check("Next outside project", () =>
      assert.ok(
        !pathIsWithin(report!.store, process.cwd()),
        "the store lives outside the project",
      ),
    );
    check("Next owned temporary storage", () =>
      assert.ok(
        pathIsWithin(report!.store, temporary),
        "below the temporary directory",
      ),
    );
    check("Next dead legacy cleanup", () =>
      assert.equal(report!.orphan, false, "a dead process's store is removed"),
    );
    check("Next post-exit lifetime", () =>
      assert.equal(
        fs.existsSync(report!.store),
        true,
        "the store outlives its process",
      ),
    );
    check("Next and direct API same store", () =>
      assert.equal(report!.reopened, report!.store),
    );
  });
  const running = path.join(root, `${process.pid}-abc456`);
  fs.mkdirSync(running);
  let crashed: string | undefined;
  let unowned: string | undefined;
  if (report !== undefined) {
    let workerIsDead = false;
    check("exited worker PID witness", () => {
      assertDeadPID(report!.workerPid);
      workerIsDead = true;
    });
    if (workerIsDead) {
      crashed = path.join(root, `${report.workerPid}-abc123`);
      unowned = path.join(root, `${report.workerPid}-unrecognized`);
      fs.mkdirSync(crashed);
      fs.mkdirSync(unowned);
    }
  }
  await phase("fresh API process and persistent store", async () => {
    const opened = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        [
          `const api = await import(${JSON.stringify(TestUnpluginRuntime.libUrl("api"))});`,
          "process.stdout.write(String(api.openTtscTransformSession()));",
        ].join("\n"),
      ],
      { encoding: "utf8", env, windowsHide: true },
    );
    assert.equal(opened.status, 0, opened.stderr);
    const second = opened.stdout;
    check("store per-user root", () =>
      assert.equal(path.dirname(second), root, "below the per-user root"),
    );
    check("store after creator exit", () =>
      assert.equal(fs.statSync(second).isDirectory(), true, "kept after exit"),
    );
    if (user !== undefined)
      check("store owner permissions", () =>
        assert.equal(fs.statSync(second).mode & 0o077, 0, "owner-only"),
      );
    check("live legacy store retained", () =>
      assert.equal(fs.existsSync(running), true, "a live process's store"),
    );
    if (report === undefined || crashed === undefined || unowned === undefined)
      throw new Error(
        "BLOCKED: failed Next/worker process supplies no retired PID or first store",
      );
    check("same store across fresh processes", () =>
      assert.equal(second, report!.store, "one store across processes"),
    );
    check("dead legacy store reclaimed", () =>
      assert.equal(fs.existsSync(crashed!), false, "a crashed process's store"),
    );
    check("foreign legacy directory retained", () =>
      assert.equal(
        fs.existsSync(unowned!),
        true,
        "a foreign directory is not a legacy store",
      ),
    );
  });
  await phase("publication and real dead-owner claim transitions", async () => {
    if (report === undefined)
      throw new Error(
        "BLOCKED: failed Next process supplies no genuinely exited PID",
      );
    assertDeadPID(report.pid);
    await exerciseSharedClaims(
      TestProject.tmpdir("ttsc-unplugin-shared-claims-"),
      report.pid,
    );
  });
  if (errors.length !== 0)
    throw new AggregateError(
      errors,
      "session/worker/shared-claim family failures",
    );
}

/**
 * Actual completed children, rather than an authored PID value, witness
 * takeover.
 */
function assertDeadPID(pid: number): void {
  assert.equal(
    Number.isSafeInteger(pid) && pid > 0,
    true,
    "a real positive child PID",
  );
  assert.throws(
    () => process.kill(pid, 0),
    (error: unknown) => (error as NodeJS.ErrnoException).code === "ESRCH",
    "the completed child is no longer alive",
  );
}

/**
 * Original claim transitions; only the dead-PID preparation is shared with the
 * opener.
 */
async function exerciseSharedClaims(
  store: string,
  dead: number,
): Promise<void> {
  const identity = "a".repeat(32);
  const state = "b".repeat(64);
  const lock = path.join(store, `${identity}-${state}.lock`);
  const publication: TtscSharedCompilePublication = {
    externalInputHashes: { [path.resolve("/outside/helper.ts")]: "hash" },
    externalInputRealpaths: {
      [path.resolve("/outside/helper.ts")]: path.resolve("/real/helper.ts"),
    },
    result: {
      type: "success",
      typescript: {},
    } as unknown as TtscSharedCompilePublication["result"],
    scratchDirectory: path.resolve("/scratch"),
  };

  const holder = await claimSharedCompile(store, identity, state, {
    adopt: true,
  });
  assert.equal(holder?.kind, "compile", "the first worker compiles");
  assert.equal(fs.existsSync(lock), true);
  const waiter = claimSharedCompile(store, identity, state, { adopt: true });
  if (holder?.kind !== "compile") return;
  await holder.publish(publication);
  holder.release();
  assert.deepEqual(
    await waiter,
    { kind: "adopt", publication },
    "a waiter adopts the holder's publication",
  );
  assert.equal(fs.existsSync(lock), false, "the holder released its lock");

  const replacing = await claimSharedCompile(store, identity, state, {
    adopt: false,
  });
  assert.equal(
    replacing?.kind,
    "compile",
    "a worker that found the publication wanting compiles under the lock",
  );
  if (replacing?.kind === "compile") replacing.release();

  const malformed = "c".repeat(64);
  fs.writeFileSync(
    path.join(store, `${identity}-${malformed}.json`),
    JSON.stringify({ ...publication, result: { type: "exception" } }),
  );
  const unusable = await claimSharedCompile(store, identity, malformed, {
    adopt: true,
  });
  assert.equal(unusable?.kind, "compile", "a failed envelope is never adopted");
  if (unusable?.kind === "compile") unusable.release();

  fs.mkdirSync(lock);
  fs.writeFileSync(path.join(lock, "owner"), `${dead}:gone`);
  const successor = await claimSharedCompile(store, identity, state, {
    adopt: false,
  });
  assert.equal(
    successor?.kind,
    "compile",
    "a lock whose holder died is taken over",
  );
  const successorToken = fs.readFileSync(path.join(lock, "owner"), "utf8");
  assert.match(successorToken, new RegExp(`^${process.pid}:`));
  const displaced = await claimSharedCompile(store, identity, "d".repeat(64), {
    adopt: false,
  });
  assert.equal(displaced?.kind, "compile");
  const displacedLock = path.join(store, `${identity}-${"d".repeat(64)}.lock`);
  fs.writeFileSync(path.join(displacedLock, "owner"), successorToken);
  if (displaced?.kind === "compile") displaced.release();
  assert.equal(
    fs.existsSync(displacedLock),
    true,
    "a holder never releases a lock another worker took over",
  );
  if (successor?.kind === "compile") {
    successor.release();
    successor.release();
  }
  assert.equal(fs.existsSync(lock), false);

  const file = path.join(store, "not-a-directory");
  fs.writeFileSync(file, "");
  assert.equal(
    await claimSharedCompile(file, identity, state, { adopt: true }),
    undefined,
    "a store that cannot be used leaves the worker to compile for itself",
  );
}

import assert from "node:assert/strict";
import { E2eProcessTrace } from "../../../../../../utils/src/E2eProcessTrace";
const { spawnSync } = E2eProcessTrace;
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Verifies retirement waits for real process and pipe closure.
 *
 * These Node children exercise only the executable/argv and OS pipe boundary;
 * they never answer a check request or impersonate a native compiler.
 *
 * 1. End input for zero and nonzero children and distinguish strict shutdown.
 * 2. Reject forced termination of a child that ignores input EOF.
 * 3. Distinguish parent exit from inherited output pipe closure.
 * 4. Require bounded unread-input retirement and actual parent event-loop release while an external pipe holder survives naturally.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual ResidentCheckProcess sends EOF and joins real child processes; literal success, exit-two, forced and unjoined assertions distinguish its retirement outcomes. A separate process importing that same selected owner must exit after unknown joining fails while the external pipe holder remains alive and later exits naturally.
 * @evidence contracts/testing.md#independent-expectations Authored children use Node exit statuses and inherited OS pipes, not check results; a living pipe owner cannot establish completed close merely because its parent exited.
 * @evidence contracts/testing.md#distinguishing-cases Zero EOF succeeds, exit two permits known-failure joining but rejects strict close, ignored EOF forces rejection, and short versus long inherited pipe holds distinguish actual join from its deadline. An unread child receives one legitimate changed-list request larger than pipe capacity: pending rejection, forced-close failure and actual PID absence are all required. A real synchronous three-second child blocks the owning event loop after EOF starts; its graceful child must still join, unlike the ignored-EOF child. A separate owner process must exit before the five-second external descendant does, while repeated close and wait remain failures.
 * @evidence contracts/testing.md#execution-ownership The existing installation caller supplies the candidate SDK constructor/module URL; direct invocation without options imports maintained source and is not installed certification. Ordinary generic feature discovery does not repeat this case_ entry. Historical target matrix size is not actual executed coverage.
 * @evidence contracts/e2e.md#necessary-boundary Actual child exit, EOF and inherited stdout closure cannot be established by a simulated event emitter or direct state assertions.
 * @evidence contracts/e2e.md#shared-execution Seven direct roles plus two pipe holders, one blocker, one observer process and its child/pipe holder imply thirteen nominal starts, not eight measured processes. Shared authored scripts do not merge the selected resident and Graph owners. Existing installation supplies constructor/module URL; actual trace completeness and costs remain unmeasured, and children never emulate compiler replies.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Distinct markers identify children. Fixture preparation and disposal errors join the failure aggregate; known-failure wait outcomes are not strict-close success. Only observed ESRCH for every recorded PID permits confined root deletion; unknown absence leaves inputs. Numeric PID files are not incarnation certificates, so reuse is an acknowledged cleanup limitation.
 * @evidence contracts/e2e.md#preserved-coverage This adds OS closure distinctions without replacing actual Go EOF, launcher IPC, diagnostic status or active watch shutdown assertions.
 */
export const case_resident_check_process_joins_actual_child_lifetimes = async (
  options?: { ResidentCheckProcess: ProcessConstructor; moduleURL: string },
): Promise<void> => {
  const Owner = options === undefined
    ? (await import(new URL("../../../../../../../packages/ttsc/src/compiler/internal/ResidentCheckProcess.ts", import.meta.url).href)).ResidentCheckProcess as ProcessConstructor
    : options.ResidentCheckProcess;
  const moduleURL = options?.moduleURL ?? new URL("../../../../../../../packages/ttsc/src/compiler/internal/ResidentCheckProcess.ts", import.meta.url).href;
  assert.equal(typeof Owner, "function", "The selected process lifetime owner must be a constructor");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-resident-close-"));
  const failures: unknown[] = [];
  const pids = new Set<number>();
  const owners: ProcessOwner[] = [];
  const wait = async (predicate: () => boolean): Promise<void> => {
    const until = Date.now() + 8_000;
    while (!predicate()) {
      assert.ok(Date.now() < until, "OS fixture condition did not settle");
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  };
  const alive = (pid: number): boolean => {
    try { process.kill(pid, 0); return true; }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ESRCH") return false;
      throw error;
    }
  };
  const completeIdentity = (file: string): boolean =>
    fs.existsSync(file) && /^[1-9]\d*\n$/.test(fs.readFileSync(file, "utf8"));
  try {
    fs.cpSync(path.resolve(import.meta.dirname, "../../../../../fixtures/os/process-lifetime"), root, { recursive: true });
    E2eProcessTrace.fixturePaths(root, ["worker.cjs"]);
    for (const [name, kind, hold] of [
      ["zero", "eof", 0], ["two", "eof", 2],
      ["ignored", "ignore", 0], ["pipe-short", "pipe", 1_300],
      ["pipe-long", "pipe", 5_000],
      ["blocked-event-loop", "eof", 0], ["unread-input", "unread", 0],
    ] as const) {
      try {
        const ready = path.join(root, `${name}.ready`);
        const childPid = path.join(root, `${name}.child`);
        const ended = path.join(root, `${name}.ended`);
        const owner = new Owner({ binary: process.execPath, args: [path.join(root, "worker.cjs"), "resident", kind, ready, childPid, ended, String(hold)], cwd: root, env: { ...process.env } });
        owners.push(owner);
        await wait(() => completeIdentity(ready));
        const pid = Number(fs.readFileSync(ready, "utf8"));
        assert.ok(Number.isSafeInteger(pid) && pid > 0);
        pids.add(pid);
        if (kind === "pipe") {
          await wait(() => completeIdentity(childPid));
          const descendant = Number(fs.readFileSync(childPid, "utf8"));
          assert.ok(Number.isSafeInteger(descendant) && descendant > 0);
          pids.add(descendant);
          assert.equal(alive(descendant), true, "inherited pipe owner must be alive before EOF");
        }
        if (name === "zero") { await owner.close(); await owner.close(); }
        else if (name === "blocked-event-loop") {
          const closing = owner.close();
          const blocked = spawnSync(process.execPath, [path.join(root, "blocker.cjs")]);
          assert.equal(blocked.error, undefined, "blocking child launch error");
          assert.equal(blocked.signal, null, "blocking child terminated by signal");
          assert.equal(blocked.status, 0, "test-owned blocking child must join");
          await closing;
        }
        else if (name === "unread-input") {
          const pending = owner.request({ changed: ["x".repeat(8 * 1024 * 1024)] });
          void pending.catch(() => {});
          await assert.rejects(owner.close(), /required forced termination/);
          await assert.rejects(pending);
          await owner.waitForExit();
        }
        else if (name === "two") {
          await assert.rejects(owner.close(), /code 2/);
          await owner.waitForExit();
        } else if (name === "ignored") {
          await assert.rejects(owner.close(), /required forced termination/);
          await owner.waitForExit();
        } else if (name === "pipe-short") {
          let settled = false;
          const closing = owner.close().then(() => { settled = true; });
          void closing.catch(() => {});
          await wait(() => fs.existsSync(ended));
          await wait(() => !alive(pid));
          assert.equal(alive(Number(fs.readFileSync(childPid, "utf8"))), true);
          assert.equal(settled, false, "parent exit is not output pipe closure");
          await closing;
        } else {
          const started = Date.now();
          const outcome = await owner.close().then(() => "resolved", (error: Error) => error);
          console.log(`resident OS pipe-long ${Date.now() - started}ms: ${String(outcome)}`);
          assert.ok(outcome instanceof Error);
          assert.match(outcome.message, /did not close after termination/);
          assert.equal(alive(Number(fs.readFileSync(childPid, "utf8"))), true);
          await assert.rejects(owner.waitForExit(), /did not close after termination/);
        }
        await wait(() => !alive(pid));
        console.log(`resident OS lifetime ${name}: PASS`);
      } catch (error) { failures.push(new Error(`resident OS lifetime ${name}`, { cause: error })); }
    }
    try {
      const observer = spawnSync(process.execPath, [
        "--import", pathToFileURL(path.join(import.meta.dirname, "../../../../../../../config/register-unit-loader.mjs")).href,
        path.join(root, "observer.cjs"), "resident", moduleURL, root,
      ], { encoding: "utf8", timeout: 8000 });
      assert.equal(observer.error, undefined);
      assert.equal(observer.signal, null);
      assert.equal(observer.status, 0, `${observer.stdout}\n${observer.stderr}`);
      assert.match(observer.stdout, /unknown join remains failed/);
      const started = Number(fs.readFileSync(path.join(root, "observer.close-start"), "utf8"));
      assert.ok(Number.isSafeInteger(started) && started > 0, "observer records actual retirement start after child readiness");
      assert.ok(Date.now() - started < 4500, "owner process must release its own handles before the five-second descendant lifetime");
      const descendant = Number(fs.readFileSync(path.join(root, "observer.child"), "utf8"));
      pids.add(descendant);
      assert.ok(Number.isSafeInteger(descendant) && descendant > 0);
      assert.equal(alive(descendant), true, "external pipe owner survives parent event-loop release");
      await wait(() => !alive(descendant));
      assert.ok(Date.now() - started >= 4900, "external pipe owner retains its authored natural lifetime");
      console.log("resident OS lifetime parent-event-loop-release: PASS");
    } catch (error) { failures.push(new Error("resident OS lifetime parent-event-loop-release", { cause: error })); }
  } catch (error) {
    failures.push(error);
  } finally {
    for (const owner of owners) {
      try { owner.dispose(); }
      catch (error) { failures.push(error); }
    }
    await Promise.allSettled(owners.map(async (owner) => owner.waitForExit()));
    let identityScanComplete = false;
    try {
      for (const name of fs.readdirSync(root)) {
        if (!name.endsWith(".ready") && !name.endsWith(".child")) continue;
        const pid = Number(fs.readFileSync(path.join(root, name), "utf8"));
        assert.ok(Number.isSafeInteger(pid) && pid > 0, "cleanup marker must identify a positive safe PID");
        pids.add(pid);
      }
      identityScanComplete = true;
    } catch (error) { failures.push(error); }
    for (const pid of pids) {
      try { if (alive(pid)) process.kill(pid, "SIGKILL"); }
      catch (error) { failures.push(error); }
    }
    try {
      assert.equal(identityScanComplete, true, "unknown marker scan must retain fixture inputs");
      await wait(() => [...pids].every((pid) => !alive(pid)));
      assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
      await fs.promises.rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
      assert.equal(fs.existsSync(root), false);
    } catch (error) { failures.push(error); }
  }
  if (failures.length !== 0) throw new AggregateError(failures, "resident OS lifetimes failed");
};

type ProcessOwner = {
  request(payload: { changed: readonly string[] }): Promise<unknown>;
  close(): Promise<void>;
  dispose(): void;
  waitForExit(): Promise<void>;
};
type ProcessConstructor = new (options: {
  binary: string;
  args: readonly string[];
  cwd: string;
  env: NodeJS.ProcessEnv;
}) => ProcessOwner;

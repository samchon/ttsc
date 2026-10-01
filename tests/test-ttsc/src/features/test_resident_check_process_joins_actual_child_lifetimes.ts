import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Verifies retirement waits for real process and pipe closure.
 *
 * These Node children exercise only the executable/argv and OS pipe boundary;
 * they never answer a check request or impersonate a native compiler.
 *
 * 1. End input for zero and nonzero children and distinguish strict shutdown.
 * 2. Reject forced termination of a child that ignores input EOF.
 * 3. Distinguish parent exit from inherited output pipe closure.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual ResidentCheckProcess sends EOF and joins real child processes; literal success, exit-two, forced and unjoined assertions distinguish its retirement outcomes.
 * @evidence contracts/testing.md#independent-expectations Authored children use Node exit statuses and inherited OS pipes, not check results; a living pipe owner cannot establish completed close merely because its parent exited.
 * @evidence contracts/testing.md#distinguishing-cases Zero EOF succeeds, exit two permits known-failure joining but rejects strict close, ignored EOF forces rejection, and short versus long inherited pipe holds distinguish actual join from its deadline.
 * @evidence contracts/testing.md#execution-ownership This discoverable feature entry exercises real OS children. Its optional constructor is the installed SDK's actual exported owner in the shared installed-OS batch; default execution imports maintained source.
 * @evidence contracts/e2e.md#necessary-boundary Actual child exit, EOF and inherited stdout closure cannot be established by a simulated event emitter or direct state assertions.
 * @evidence contracts/e2e.md#shared-execution One test process and fixture host all five independent lifetimes; no installation, Go build or compiler protocol is introduced, and the installed batch supplies its existing SDK owner.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each child owns distinct marker paths; all known PIDs are stopped and observed absent before the confined fixture is removed, including failures and deadline outcomes.
 * @evidence contracts/e2e.md#preserved-coverage This adds OS closure distinctions without replacing actual Go EOF, launcher IPC, diagnostic status or active watch shutdown assertions.
 */
export const test_resident_check_process_joins_actual_child_lifetimes = async (
  options?: { ResidentCheckProcess: ProcessConstructor },
): Promise<void> => {
  const Owner = options?.ResidentCheckProcess ?? (
    await import(new URL("../../../../packages/ttsc/src/compiler/internal/ResidentCheckProcess.ts", import.meta.url).href)
  ).ResidentCheckProcess as ProcessConstructor;
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
  try {
    for (const [name, kind, hold] of [
      ["zero", "eof", 0], ["two", "eof", 2],
      ["ignored", "ignore", 0], ["pipe-short", "pipe", 1_300],
      ["pipe-long", "pipe", 5_000],
    ] as const) {
      try {
        const ready = path.join(root, `${name}.ready`);
        const childPid = path.join(root, `${name}.child`);
        const ended = path.join(root, `${name}.ended`);
        const body = kind === "pipe" ? `
          const fs=require('node:fs');
          const grandchild=require('node:child_process').spawn(process.execPath,['-e',
            'const fs=require("node:fs");fs.writeFileSync(process.argv[1],String(process.pid));const timer=setInterval(()=>{if(fs.existsSync(process.argv[2])){clearInterval(timer);setTimeout(()=>process.exit(0),Number(process.argv[3]));}},10);',
            ${JSON.stringify(childPid)},${JSON.stringify(ended)},String(${hold})],{stdio:['ignore',1,2],windowsHide:true,detached:true});
          process.stdin.resume();process.stdin.on('end',()=>{fs.writeFileSync(${JSON.stringify(ended)},'EOF');process.exit(0);});
          fs.writeFileSync(${JSON.stringify(ready)},String(process.pid));
        ` : `
          const fs=require('node:fs');process.stdin.resume();
          ${kind === "eof" ? `process.stdin.on('end',()=>process.exit(${hold}));` : "setInterval(()=>{},1000);"}
          fs.writeFileSync(${JSON.stringify(ready)},String(process.pid));
        `;
        const owner = new Owner({ binary: process.execPath, args: ["-e", body], cwd: root, env: { ...process.env } });
        owners.push(owner);
        await wait(() => fs.existsSync(ready));
        const pid = Number(fs.readFileSync(ready, "utf8"));
        assert.ok(Number.isSafeInteger(pid) && pid > 0);
        pids.add(pid);
        if (kind === "pipe") {
          await wait(() => fs.existsSync(childPid));
          const descendant = Number(fs.readFileSync(childPid, "utf8"));
          assert.ok(Number.isSafeInteger(descendant) && descendant > 0);
          pids.add(descendant);
          assert.equal(alive(descendant), true, "inherited pipe owner must be alive before EOF");
        }
        if (name === "zero") { await owner.close(); await owner.close(); }
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
  } finally {
    for (const owner of owners) owner.dispose();
    await Promise.allSettled(owners.map((owner) => owner.waitForExit()));
    for (const name of fs.readdirSync(root)) {
      if (!name.endsWith(".ready") && !name.endsWith(".child")) continue;
      const pid = Number(fs.readFileSync(path.join(root, name), "utf8"));
      if (Number.isSafeInteger(pid) && pid > 0) pids.add(pid);
    }
    for (const pid of pids) {
      try { if (alive(pid)) process.kill(pid, "SIGKILL"); }
      catch (error) { failures.push(error); }
    }
    try {
      await wait(() => [...pids].every((pid) => !alive(pid)));
      assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
      await fs.promises.rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
      assert.equal(fs.existsSync(root), false);
    } catch (error) { failures.push(error); }
  }
  if (failures.length !== 0) throw new AggregateError(failures, "resident OS lifetimes failed");
};

type ProcessOwner = {
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

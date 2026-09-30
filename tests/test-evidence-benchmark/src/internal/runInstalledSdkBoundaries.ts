import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { scriptEnvironment } from "./scriptEnvironment";
import { repositoryRoot } from "./suiteRoot";

/**
 * Verifies one borrowed installation satisfies the real Windows SDK boundaries.
 *
 * This optional test-runner consumer uses the original CLI smoke and OS/Go
 * entries. Its awaited invocation finishes before the archive owner's release;
 * lint runs last because its existing finally owns the retained consumer.
 *
 * 1. Borrow the completed toolchain and capture the smoke's allocated root.
 * 2. Execute its original CLI, installed filesystem, Evidence and lint cases.
 * 3. Collect independent failures and release the joined, identified consumer.
 *
 * @evidence contracts/testing.md#behavioral-verification Runs the existing installed CLI version, emit and runtime assertions, then all installed OS cases and named Evidence/lint Windows Go populations with verbose output and independently collected exit statuses.
 * @evidence contracts/testing.md#independent-expectations The original entries retain their authored stdout, native filesystem and protocol oracles. The smoke compares borrowed manifests and maintained SDK Go source receipts with the frozen checkout before installation.
 * @evidence contracts/testing.md#distinguishing-cases Preserves each original entry's positive, negative, capability and recovery cases; ordinary nonzero OS or Evidence exits do not hide the remaining batch. Failed installation or abnormal child termination blocks dependent consumers explicitly.
 * @evidence contracts/testing.md#execution-ownership The benchmark runner's explicit --installed-sdk option owns this extra Windows batch; default CI runs no additional installation and the existing setup matrix remains the ordinary installed SDK owner.
 * @evidence contracts/e2e.md#necessary-boundary The real packed CLI and SDK must agree with native Windows filesystem and kernel behavior. Source units cannot establish installed resolution, executable transport or those actual capabilities.
 * @evidence contracts/e2e.md#shared-execution Borrows the suite's completed ttsc/platform archives, creates one bare consumer and passes it to all three existing OS/Go entries. It never packs or rebuilds a native artifact.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Structured IPC transfers the newly allocated root before preparation can fail. Native root/ancestor identities guard cleanup; children receive its marker-bound path through their private environment. Unexpected termination retains the consumer because descendant closure is then unproven, and benchmark manifests/stores are never edited.
 * @evidence contracts/e2e.md#preserved-coverage Calls the original entries with their normal full selections and Go -v only, retaining all assertions and capability guards. Nonzero exits and cleanup errors remain failures; no case timeout or workload is changed.
 */
export async function runInstalledSdkBoundaries(directory: string): Promise<void> {
  assert.equal(process.platform, "win32", "The optional installed SDK kernel collector requires Windows");
  const failures: unknown[] = [];
  let consumer: string | undefined;
  let identity: ReturnType<typeof snapshot> | undefined;
  let childrenJoined = true;
  function snapshot(root: string) {
    const chain: { path: string; device: bigint; inode: bigint }[] = [];
    for (let current = path.resolve(root); ; current = path.dirname(current)) {
      const stat = fs.lstatSync(current, { bigint: true });
      assert(stat.isDirectory() && !stat.isSymbolicLink(), `Redirected consumer ancestor: ${current}`);
      assert.equal(fs.realpathSync.native(current).toLowerCase(), current.toLowerCase());
      chain.push({ path: current, device: stat.dev, inode: stat.ino });
      if (path.dirname(current) === current) return chain;
    }
  }
  const run = async (name: string, argumentsList: string[], environment = scriptEnvironment(), transfer = false) => {
    console.log(`Installed SDK boundary: ${name}`);
    const child = spawn(process.execPath, argumentsList, {
      cwd: repositoryRoot,
      env: environment,
      stdio: transfer ? ["ignore", "inherit", "inherit", "ipc"] : "inherit",
      windowsHide: true,
      shell: false,
    });
    if (transfer) child.on("message", (message: unknown) => {
      try {
        assert(message && typeof message === "object" && "consumer" in message);
        assert.equal(typeof message.consumer, "string");
        assert.equal(consumer, undefined, "Only one actual consumer may transfer ownership");
        const original = path.resolve(message.consumer as string);
        const originalStat = fs.lstatSync(original);
        assert(originalStat.isDirectory() && !originalStat.isSymbolicLink());
        const allocated = fs.realpathSync.native(original);
        assert.equal(path.dirname(allocated).toLowerCase(), fs.realpathSync.native(os.tmpdir()).toLowerCase());
        assert(path.basename(allocated).startsWith("ttsc-cli-smoke-"));
        identity = snapshot(allocated);
        consumer = allocated;
      } catch (error) {
        failures.push(error);
      }
    });
    const result = await new Promise<{ status: number | null; signal: NodeJS.Signals | null; error?: Error }>((resolve) => {
      let error: Error | undefined;
      child.once("error", (cause) => { error = cause; });
      child.once("close", (status, signal) => resolve({ status, signal, error }));
    });
    if (result.signal !== null || (result.error && child.pid)) childrenJoined = false;
    if (result.error || result.status !== 0 || result.signal !== null)
      failures.push(new Error(`${name} failed: exit=${String(result.status)} signal=${String(result.signal)}`, { cause: result.error }));
    console.log(`Installed SDK boundary result: ${name} exit=${String(result.status)}`);
    return result;
  };
  try {
    const smoke = await run("CLI smoke", [
      "-e",
      "require('./scripts/ci/installed-cli-smoke.cjs').test_installed_cli_smoke({archiveDirectory:process.argv[1],keep:true,onConsumerCreated:consumer=>process.send({consumer})})",
      directory,
    ], scriptEnvironment(), true);
    assert(consumer && identity, "The actual smoke must transfer its allocated consumer");
    if (!smoke.error && smoke.status === 0 && smoke.signal === null) {
      assert.equal(fs.readFileSync(path.join(consumer, ".ttsc-cli-smoke"), "utf8"), repositoryRoot);
      const environment = scriptEnvironment({ TTSC_INSTALLED_SMOKE_ROOT: consumer });
      await run("filesystem OS cases", ["--import", "./scripts/register-typescript-loader.mjs", "tests/e2e/installed-os-boundaries.mts"], environment);
      if (childrenJoined)
        await run("Evidence Windows Go cases", ["scripts/test-go-evidence.cjs", "--os-boundaries", "-v"], environment);
      if (childrenJoined)
        await run("lint Windows Go cases", ["scripts/test-go-lint.cjs", "--os-boundaries", "-v"], environment);
      else console.error("Remaining installed SDK batches blocked by unproven descendant closure.");
    } else console.error("Installed SDK dependent batches blocked by the failed CLI installation/smoke.");
  } catch (error) {
    failures.push(error);
  } finally {
    if (consumer && identity) {
      try {
        assert(childrenJoined, `Abnormally terminated child may retain the consumer: ${consumer}`);
        assert.deepEqual(snapshot(consumer), identity);
        fs.rmSync(consumer, { recursive: true, force: true });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") failures.push(error);
      }
      if (fs.existsSync(consumer)) failures.push(new Error(`Installed SDK consumer remains: ${consumer}`));
      console.log(`Installed SDK consumer released: ${consumer} absent=${!fs.existsSync(consumer)}`);
    }
  }
  if (failures.length) throw new AggregateError(failures, "Installed SDK boundary collector failed");
}

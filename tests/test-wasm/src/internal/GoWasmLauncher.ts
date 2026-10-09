import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Execute the authored launcher against a finite CJS fixture runner.
 *
 * The original ChildProcess owns exit and pipe closure. A cancellation fixture
 * has a separate file release gate so a regressed nested runner can finish
 * without a PID lookup or a signal sent to a reused numeric identity. Inputs
 * remain when the reported runtime is not the original process; the enclosing
 * verification command owns containment of that failed experiment.
 *
 * @evidence contracts/common.md#principled-implementation One typed fixture reading carries the real runtime's values and one runner operation owns their acquisition.
 * @evidence contracts/common.md#clear-and-simple-design The namespace groups the reading shape and its sole process operation under one helper identity.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts This grouping adds no interception or alternate runtime behavior; run executes the real launcher.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs distinguish original-process authority, the fixture release gate and retained inputs.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation The namespace groups declarations; run owns native process and filesystem decisions.
 * @evidenceExclude contracts/performance.md#efficient-algorithms The namespace selects no processing algorithm; run owns collection and cleanup.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The grouping coordinates no computation cache or shared process.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The namespace retains no instance state; each run owns its directory, child and readers.
 */
export namespace GoWasmLauncher {
  /**
   * The values the static runner observed in its actual Node runtime.
   *
   * @evidence contracts/common.md#principled-implementation PID, cwd, argument vectors and environment remain distinct values reported by the real fixture process.
   * @evidence contracts/common.md#clear-and-simple-design The shape carries observations only; run owns process authority and tests own expected values.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts No field substitutes a fabricated process result or encodes a fixture-specific expected answer.
   * @evidence contracts/common.md#meaningful-documentation Each member identifies the process value being observed, preserving native path and argument meanings.
   * @evidence contracts/portability.md#os-neutral-implementation Cwd retains native spelling while live filesystem readings resolve cwd and TMPDIR physically; argv retains vector entries and guest environment spelling remains separate.
   * @evidenceExclude contracts/performance.md#efficient-algorithms This observation shape selects no algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work The shape defines no cache or computation sharing.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The reading owns only copied data; the producing call owns process and descriptor lifetimes.
   */
  export interface Reading {
    /** PID obtained by the runner from its own process object. */
    pid: number;

    /** Native current directory after the launcher prepared the runtime. */
    cwd: string;

    /** Physical directory observed while the fixture's cwd still exists. */
    cwdRealpath: string;

    /** Physical TMPDIR when that environment path exists in the fixture. */
    tmpdirRealpath?: string;

    /** Runner entry followed by its uninterpreted argument entries. */
    argv: string[];

    /** Node startup flags observed by that same runtime. */
    execArgv: string[];

    /** Environment copied after the launcher trimmed inherited variables. */
    env: NodeJS.ProcessEnv;
  }

  /**
   * Launch one fixture, optionally cancelling its original process after readiness.
   *
   * @evidence contracts/common.md#principled-implementation The original ChildProcess supplies exit and close authority; the fixture readiness report supplies runtime identity. A separate release file lets a nested fixture finish without a numeric-PID signal.
   * @evidence contracts/common.md#clear-and-simple-design Fixture preparation, readiness, cancellation and result collection belong to one call; each test owns its expected status, environment and argument values.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The static fixture executes as the real runner entry. No native method or global is replaced, and PID equality is observed rather than inferred from wrapper source.
   * @evidence contracts/common.md#meaningful-documentation The namespace explains retained inputs and cancellation authority; the operation documents readiness as the cancellation boundary.
   * @evidence contracts/portability.md#os-neutral-implementation The acquired input directory is resolved physically before it becomes spawn cwd or the explicit-root oracle. Native executable/argument vectors and file URLs preserve their meanings; physical temporary parents and owned prefixes constrain cleanup. The fixture observes live cwd/TMPDIR identities and the launcher owns guest spelling.
   * @evidence contracts/performance.md#efficient-algorithms Output collection and parsing scale with the static fixture's report and supplied arguments; streams are appended until one original child closes. No process table, historical output or repeated filesystem traversal is retained.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work Every call executes independent process and filesystem effects, so results cannot replace later cases.
   * @evidence contracts/performance.md#bound-retention-and-release-resources One child and input directory are held through original exit and pipe closure. The fixture release gate covers cancellation failure; a mismatched runtime retains inputs and leaves descendant containment to the enclosing bounded verification command. The result records ordinary cleanup before this helper removes a remaining known-owned directory.
   */
  export async function run(props: {
    args?: string[];
    env?: NodeJS.ProcessEnv;
    cancel?: boolean;
    missingRunner?: boolean;
  } = {}) {
    const owner = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-go-runner-fixture-")));
    const gate = path.join(owner, "release");
    const fixture = fileURLToPath(new URL("../../fixtures/go-wasm-runner.cjs", import.meta.url));
    const runner = props.missingRunner ? path.join(owner, "missing-runner.cjs") : fixture;
    const launcher = fileURLToPath(new URL("../../../../packages/wasm/test/go-js-wasm-exec.mjs", import.meta.url));
    const args = props.cancel ? ["hold", gate] : props.args ?? ["probe", "0"];
    const child = spawn(process.execPath, ["--stack-size=8192", launcher, runner, ...args], {
      cwd: owner,
      env: { ...process.env, NODE_OPTIONS: "", TTSC_WASM_TEST_ROOT: "", ...props.env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
      child.once("exit", (code, signal) => resolve({ code, signal }));
      child.once("error", reject);
    });
    const closed = new Promise<void>(resolve => child.once("close", () => resolve()));
    let stdout = "", stderr = "";
    let reading: Reading | undefined;
    let readyResolve: (value: Reading | undefined) => void;
    let readyReject: (error: unknown) => void;
    const ready = new Promise<Reading | undefined>((resolve, reject) => { readyResolve = resolve; readyReject = reject; });
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
      if (reading === undefined && stdout.includes("\n")) {
        try {
          const value = JSON.parse(stdout.slice(0, stdout.indexOf("\n"))) as Reading;
          assert.ok(Number.isSafeInteger(value.pid));
          assert.equal(typeof value.cwd, "string");
          reading = value;
          readyResolve(value);
        } catch (error) { readyReject(error); }
      }
    });
    child.stderr.on("data", (chunk: string) => { stderr += chunk; });
    child.once("close", () => readyResolve(undefined));
    let killAccepted: boolean | undefined;
    let result: Awaited<typeof exited>;
    try {
      if (props.cancel) {
        assert.ok(await ready, "Cancellation requires an actual runner readiness report");
        killAccepted = child.kill("SIGTERM");
        assert.equal(killAccepted, true);
      }
      result = await exited;
    } finally {
      if (props.cancel) fs.writeFileSync(gate, "release");
      await closed;
    }
    const originalRuntime = reading?.pid === child.pid;
    const temporaryExistedAfterExit = reading !== undefined && reading.cwd !== owner && fs.existsSync(reading.cwd);
    if (originalRuntime && reading !== undefined) {
      const temporary = reading.cwd;
      if (temporary !== owner && fs.existsSync(temporary)) {
        assert.equal(fs.realpathSync(path.dirname(temporary)), fs.realpathSync(os.tmpdir()));
        assert.ok(path.basename(temporary).startsWith("ttsc-wasm-tests-"));
        fs.rmSync(temporary, { recursive: true });
      }
    }
    // With no runtime report, a failed load has no admitted fixture reader.
    if (originalRuntime || reading === undefined) {
      assert.equal(fs.realpathSync(path.dirname(owner)), fs.realpathSync(os.tmpdir()));
      assert.ok(path.basename(owner).startsWith("ttsc-go-runner-fixture-"));
      fs.rmSync(owner, { recursive: true });
    }
    return { ...result!, pid: child.pid, reading, stdout, stderr, killAccepted, owner, fixture, temporaryExistedAfterExit };
  }
}

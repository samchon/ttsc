import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { E2eProcessTrace } from "../../../../../utils/src/E2eProcessTrace";

/**
 * Verifies the actual ttsx launcher refuses response watch before preparation.
 * A different invocation directory carries a benign same-named response; the
 * selected project's nested and encoded requests must supply the refusal.
 *
 * 1. Launch the same staged CLI against nested false and UTF-16 watch requests.
 * 2. Require actionable exit/close 2 and no entry output or cache acquisition.
 * 3. Restore copied response bytes after both independent outcomes are collected.
 *
 * @evidence contracts/testing.md#behavioral-verification Real Node CLI children invoke the production launcher/preparation assembly and must refuse both actual response requests with the one-shot watch diagnostic, ordinary exit and stdio closure before resolving an absent compiler or creating runtime cache state.
 * @evidence contracts/testing.md#independent-expectations Literal exit2, watch diagnostic pointers, absent cache/compiler paths and empty entry stdout follow the one-shot CLI contract; authored different-cwd response files make an invocation-relative read distinguishable.
 * @evidence contracts/testing.md#distinguishing-cases Nested explicit-false and UTF16 watch frames share the selected project root while invocation's same-named frame is benign. Direct spelling, program tails, other encodings and inspection failure semantics remain in the source units.
 * @evidence contracts/testing.md#execution-ownership The Runtime batch calls this maintained case using its installed public CLI and upfront static fixture. Source-loaded local acceptance may supply the actual source CLI and maintained loader instead; neither mode starts a compiler or native watcher.
 * @evidence contracts/e2e.md#necessary-boundary Parser and guard units cannot prove the actual CLI passes the selected project root to admission before effective-option queries, cache acquisition and entry execution; these real launcher statuses and effects establish that assembly.
 * @evidence contracts/e2e.md#shared-execution Both requests share the batch's existing installation and fixture. Their incompatible response bytes need two short Node launcher lifetimes; an intentionally absent explicit compiler prevents a failed admission from starting native work. No entry child, native build or extra installation is required.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity A private upfront response-watch fixture owns its cache path and mutable response. Each original child handle is joined through close before the next request; a deadline terminates only that handle and fails acceptance. finally restores response bytes and no successful build state is shared.
 * @evidence contracts/e2e.md#preserved-coverage Existing Runtime frontdoor execution, preload, main and fatal-status cases remain intact. This adds actual response mode admission; the source units retain the full spelling/encoding/failure matrix rather than adding a CLI process per portable option case.
 */
export async function case_ttsx_response_watch_refusal(
  root: string,
  options: { launcher: string; loader?: string },
) {
  const invocation = path.join(root, "invocation");
  const project = path.join(root, "project");
  const response = path.join(project, "flags.rsp");
  const cache = path.join(root, "cache");
  const binary = path.join(root, "absent-native-compiler.exe");
  assert.equal(fs.existsSync(binary), false);
  assert.equal(fs.existsSync(cache), false);
  const original = fs.readFileSync(response);
  const failures: Error[] = [];
  const receipts: {
    name: string;
    pid: number | undefined;
    exit: { code: number | null; signal: NodeJS.Signals | null } | undefined;
    close: { code: number | null; signal: NodeJS.Signals | null };
    stdout: string;
    stderr: string;
  }[] = [];
  try {
    for (const profile of [
      { name: "nested false", bytes: original },
      {
        name: "UTF16 watch",
        bytes: Buffer.concat([
          Buffer.from([0xff, 0xfe]),
          Buffer.from("--watch\n", "utf16le"),
        ]),
      },
    ]) {
      fs.writeFileSync(response, profile.bytes);
      const child = E2eProcessTrace.spawn(
        process.execPath,
        [
          ...(options.loader === undefined ? [] : ["--import", options.loader]),
          options.launcher,
          "--cwd",
          invocation,
          "-p",
          path.join(project, "tsconfig.json"),
          "--cache-dir",
          cache,
          "--binary",
          binary,
          "--no-plugins",
          "@flags.rsp",
          path.join(project, "entry.ts"),
        ],
        {
          cwd: invocation,
          env: { ...process.env, NODE_OPTIONS: "" },
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true,
        },
      );
      let stdout = "";
      let stderr = "";
      let exit: (typeof receipts)[number]["exit"];
      let spawnError: Error | undefined;
      let expired = false;
      const timer = setTimeout(() => {
        expired = true;
        child.kill();
      }, 10_000);
      child.stdout?.on("data", (bytes) => {
        stdout += bytes.toString();
      });
      child.stderr?.on("data", (bytes) => {
        stderr += bytes.toString();
      });
      child.once("error", (error) => {
        spawnError = error;
      });
      child.once("exit", (code, signal) => {
        exit = { code, signal };
      });
      const close = await new Promise<(typeof receipts)[number]["close"]>(
        (resolve) =>
          child.once("close", (code, signal) => resolve({ code, signal })),
      );
      clearTimeout(timer);
      receipts.push({
        name: profile.name,
        pid: child.pid,
        exit,
        close,
        stdout,
        stderr,
      });
      try {
        assert.equal(expired, false);
        assert.equal(spawnError, undefined);
        assert.deepEqual(exit, { code: 2, signal: null });
        assert.deepEqual(close, { code: 2, signal: null });
        assert.match(stderr, /ttsx: --watch is not supported/);
        assert.match(stderr, /ttsc --watch --noEmit/);
        assert.match(stderr, /node --watch --require ttsc\/register/);
        assert.equal(stdout, "");
        assert.equal(fs.existsSync(cache), false);
        assert.equal(fs.existsSync(binary), false);
      } catch (cause) {
        failures.push(new Error(profile.name, { cause }));
      }
    }
  } finally {
    fs.writeFileSync(response, original);
  }
  if (failures.length !== 0)
    throw new AggregateError(failures, "response watch CLI admission failed");
  return receipts;
}

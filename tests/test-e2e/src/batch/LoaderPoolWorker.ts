import { spawn } from "node:child_process";
import path from "node:path";

export interface LoaderPoolOutcome { value?: any; error?: string }
/**
 * Own one real resident adapter process and join its actual close receipt.
 *
 * Requests are bounded observations of that same adapter/cache/session. A
 * timeout refuses ownership resolution; it does not kill or certify release.
 *
 * @evidence contracts/testing.md#behavioral-verification The caller submits normal/failure/replay/repair observations to one actual adapter child, collects its line replies and joins close before releasing shared inputs.
 * @evidence contracts/testing.md#independent-expectations Authored command ids route literal child outcomes; the caller compares native outputs, diagnostic markers and publication identities independently of this transport.
 * @evidence contracts/testing.md#distinguishing-cases Concurrent outstanding ids, fragmented lines, delivery deadline, child error/nonzero close and unresolved close are explicit ownership states; none invents a native result.
 * @evidence contracts/testing.md#execution-ownership Called exactly twice by the one loader-pool experiment, with the existing Turbopack worker owning its actual watching bridge; subsequent request calls reuse those two processes and do not allocate hosts or compiler profiles.
 * @evidence contracts/e2e.md#necessary-boundary Actual built adapter processes and their session-native producer must communicate before publication sharing can be observed.
 * @evidence contracts/e2e.md#shared-execution One command stream keeps each adapter module/cache owner resident across the same project states.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Explicit owned cwd/cache/session and complete close receipts bound reuse; unresolved delivery/close is failure, never release proof or forced process termination.
 * @evidence contracts/e2e.md#preserved-coverage The caller retains initial Metro forwarding/Turbopack map and dependency controls while extending actual failure sharing/replay/repair; no legacy case/profile loop is invoked.
 */
export function createLoaderPoolWorker(props: {
  mode: "metro" | "turbopack"; root: string; cache: string; session: string;
  metro: string; options: string; turbopack: string;
}) {
  const child = spawn(process.execPath, [path.join(props.root, "loader-pool.mjs"), props.mode, props.root, props.metro, props.options, props.turbopack], {
    cwd: props.root, windowsHide: true, stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, NODE_ENV: props.mode === "turbopack" ? "development" : "production", TTSC_CACHE_DIR: props.cache, TTSC_UNPLUGIN_TRANSFORM_SESSION: props.session },
  });
  let buffered = "", stderr = "", next = 0;
  const pending = new Map<number, { resolve(reply: LoaderPoolOutcome): void; reject(error: unknown): void; timer: ReturnType<typeof setTimeout> }>();
  const rejectPending = (error: unknown) => {
    for (const request of pending.values()) { clearTimeout(request.timer); request.reject(error); }
    pending.clear();
  };
  child.stdout.on("data", (chunk) => {
    buffered += chunk;
    let newline: number;
    while ((newline = buffered.indexOf("\n")) >= 0) {
      const line = buffered.slice(0, newline); buffered = buffered.slice(newline + 1);
      try {
        const reply = JSON.parse(line) as LoaderPoolOutcome & { id: number };
        const request = pending.get(reply.id);
        if (!request) throw new Error(`${props.mode}: unexpected response ${line}`);
        pending.delete(reply.id); clearTimeout(request.timer); request.resolve(reply);
      } catch (error) { rejectPending(error); }
    }
  });
  child.stderr.on("data", (chunk) => { stderr += chunk; });
  let processError: Error | undefined;
  child.once("error", (error) => { processError = error; });
  const closed = new Promise<void>((resolve, reject) => child.once("close", (code, signal) => {
    const error = processError ?? (code !== 0 || signal !== null ? new Error(`${props.mode}: status=${code} signal=${signal}\n${stderr}`) : undefined);
    rejectPending(error ?? new Error(`${props.mode}: closed before reply`));
    error ? reject(error) : resolve();
  }));
  void closed.catch(() => undefined);
  return {
    request: (sourceSuffix = "") => new Promise<LoaderPoolOutcome>((resolve, reject) => {
      const id = ++next;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${props.mode}: delivery remains unresolved: ${stderr}`)); }, 120_000);
      pending.set(id, { resolve, reject, timer });
      child.stdin.write(JSON.stringify({ id, sourceSuffix }) + "\n");
    }),
    diagnostics: () => stderr,
    close: async () => {
      child.stdin.end(JSON.stringify({ close: true }) + "\n");
      let timer: ReturnType<typeof setTimeout> | undefined;
      try { await Promise.race([closed, new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${props.mode}: close remains unresolved: ${stderr}`)), 120_000);
      })]); } finally { if (timer) clearTimeout(timer); }
    },
  };
}
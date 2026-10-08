import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export interface LoaderPoolOutcome {
  hostObservation?: {
    before: Record<string, string | null>;
    after: Record<string, string | null>;
    elapsedMs: number;
    maximumGapMs: number;
    ticks: number;
  };
  value?: any;
  error?: string;
  adapterCalls?: {
    mode: string;
    pid: number;
    filename: string;
    outcome: string;
    startedAt: string;
    finishedAt?: string;
  }[];
  callbackObservation?: {
    dependencies: string[];
    contextDependencies: string[];
    cacheability: boolean[];
    errors: string[];
    completions: number;
  };
}
/**
 * Own one real resident adapter process and join its actual close receipt.
 *
 * Requests are bounded observations of that same adapter/cache/session. An
 * optional deliveredSource carries the caller's earlier bytes independently of
 * the current disk input, without changing the worker or compiler options. A
 * graphProof command uses this same resident and the public filesystem seam;
 * its two actual native captures have a separate publication/receipt epoch. An
 * opt-in first-consumer installation calls public prepare in this resident
 * before its readiness line. Preparation adds one descriptor/build admission
 * call and no Program; bounded delivery starts only after the caller awaits
 * readiness. Startup error/close rejects readiness, and the caller retains
 * actual process close responsibility. This is not a readiness time guarantee.
 * Cache withdrawal schedules disposal and does not certify backend closure. A
 * descriptorFlow command uses the same Node caller before adapter admission; it
 * does not start a worker and its evaluator attempts remain actual cost. A
 * mixed lint input graph uses that same command and worker stdout/stderr to
 * carry contributor results and joined logs; factory re-evaluations are actual
 * internal calls, not a zero-cost or one-Program assertion. A plugin-lock
 * command retains actual lease/fence state in these same two residents; twelve
 * command/reply barriers add no adapter delivery. An exited seed is a
 * separately recorded real process, not a unit-only observation. timeout
 * refuses ownership resolution; it does not kill or certify release.
 * Parent-owned command observations retain ids, authored phase labels and the
 * actual child PID in the existing runner trace. Each resident writes at most
 * 256 ordinary rows plus its actual close row; no source or reply payload is
 * copied. A failed diagnostic sink reports once on stderr without replacing
 * transport outcomes or certifying closure.
 * Complete child stderr is retained beside that JSONL file at actual close,
 * including an error reply followed by a normal exit. Close drains the stream
 * before writing; retained diagnostics do not establish a successful delivery.
 *
 * The final resident may receive a private project-view argument carrying
 * public Metro options. This keeps Metro's host root independent of its
 * compiler root and omits the explicit project only for that existing owner.
 * Its positive and diagnostic deliveries share the same process and closure.
 *
 * @evidence contracts/testing.md#behavioral-verification An opt-in readiness result carries actual public preparation binaries and elapsed time before delivery; preparation error or child error/close rejects that owner. The caller submits normal/failure/replay/repair observations to one actual adapter child, collects its line replies and joins close before releasing shared inputs.
 * @evidence contracts/testing.md#independent-expectations Authored command ids route literal child outcomes; the caller compares native outputs, diagnostic markers and publication identities independently of this transport. Caller-authored phase labels identify the unchanged commands in bounded parent observations; they are not native result or timing oracles.
 * @evidence contracts/testing.md#distinguishing-cases Concurrent outstanding ids, fragmented lines, delivery deadline, child error/nonzero close and unresolved close are explicit ownership states; none invents a native result.
 * @evidence contracts/testing.md#execution-ownership The loader-pool experiment initially owns Metro and Turbopack workers, then acquires one fresh Metro worker only after both actually join, to distinguish offline edits from old in-memory validation. Other request calls reuse their existing process; native preparation totals are not certified.
 * @evidence contracts/e2e.md#necessary-boundary Actual built adapter processes and their session-native producer must communicate before publication sharing can be observed.
 * @evidence contracts/e2e.md#shared-execution The initial Metro resident owns one additional public prepare call and descriptor/admission re-observation before bounded delivery; it does not acquire a Program or certify a cache hit. One command stream keeps each adapter module/cache owner resident across the same project states.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Explicit owned cwd/cache/session and complete close receipts bound reuse; unresolved delivery/close is failure, never release proof or forced process termination. A unique parent-owned JSONL file in the existing trace root bounds observations to 256 ordinary rows plus actual close, truncates phase/error text and reports a sink failure once on stderr without replacing transport errors. Actual close retains complete child stderr in a separate exclusive file after stream drainage, for success, error replies and nonzero exit; retention failure is reported independently and does not certify delivery or closure. An optional runtime-inputs object-cache coordinate is command data only; worker environment, binary namespace and request deadline remain intact. It is supplied only after native-name inspection finds no nonempty inherited dedicated/external cache.
 * @evidence contracts/e2e.md#preserved-coverage The caller retains initial Metro forwarding/Turbopack map and dependency controls while extending actual failure sharing/replay/repair; no legacy case/profile loop is invoked.
 */
export function createLoaderPoolWorker(props: {
  mode: "metro" | "turbopack";
  root: string;
  cache: string;
  session: string;
  metro: string;
  turbopack: string;
  traceRoot: string;
  /** API module URL anchoring the first consumer's native preparation. */
  prepareNative?: string;
  /** Final resident's distinct public Metro host and compiler roots. */
  metroProjectView?: {
    hostRoot: string;
    implicitProject: boolean;
    projectRoot: string;
  };
}) {
  const child = spawn(
    process.execPath,
    [
      path.join(props.root, "loader-pool.mjs"),
      props.mode,
      props.root,
      props.metro,
      props.turbopack,
      ...(props.prepareNative ? ["prepare-native", props.prepareNative] : []),
      ...(props.metroProjectView
        ? ["--metro-project-view=" + JSON.stringify(props.metroProjectView)]
        : []),
    ],
    {
      cwd: props.root,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        NODE_ENV: props.mode === "turbopack" ? "development" : "production",
        TTSC_CACHE_DIR: props.cache,
        TTSC_UNPLUGIN_TRANSFORM_SESSION: props.session,
        TTSC_E2E_TRACE: props.traceRoot,
      },
    },
  );
  let buffered = "",
    stderr = "",
    next = 0;
  const observationInstance = randomUUID();
  const observationFile = path.join(
    props.traceRoot,
    `${process.pid}-loader-pool-${observationInstance}.jsonl`,
  );
  const diagnosticsFile = observationFile.replace(/\.jsonl$/, ".stderr");
  let observationSequence = 0;
  let observationFailed = false;
  let omittedObservations = 0;
  const observe = (
    state: string,
    data: Record<string, string | number | boolean | null> = {},
  ): void => {
    if (observationFailed) return;
    if (observationSequence >= 256 && state !== "closed") {
      omittedObservations++;
      return;
    }
    try {
      fs.appendFileSync(
        observationFile,
        JSON.stringify({
          schema: 1,
          event: "loader-pool-command",
          writerPid: process.pid,
          instance: observationInstance,
          sequence: ++observationSequence,
          at: new Date().toISOString(),
          data: {
            ...data,
            state,
            mode: props.mode,
            childPid: child.pid ?? null,
            omittedObservations,
            writerRuntime: process.version,
          },
        }) + "\n",
      );
    } catch (error) {
      observationFailed = true;
      console.error(
        "Loader-pool command observation failed: " +
          String(error).slice(0, 1024),
      );
    }
  };
  observe("spawned");
  const pending = new Map<
    number,
    {
      resolve(reply: LoaderPoolOutcome): void;
      reject(error: unknown): void;
      timer: ReturnType<typeof setTimeout>;
      phase: string;
    }
  >();
  let resolvePreparation: (
    value:
      | {
          binaries: string[];
          startedAt: string;
          finishedAt: string;
          elapsedMs: number;
        }
      | undefined,
  ) => void = () => {};
  let rejectPreparation: (error: unknown) => void = () => {};
  let preparationPending = props.prepareNative !== undefined;
  const ready = new Promise<
    | {
        binaries: string[];
        startedAt: string;
        finishedAt: string;
        elapsedMs: number;
      }
    | undefined
  >((resolve, reject) => {
    resolvePreparation = resolve;
    rejectPreparation = reject;
    if (!preparationPending) resolve(undefined);
  });
  void ready.catch(() => undefined);
  const rejectPending = (error: unknown) => {
    for (const [id, request] of pending) {
      observe("rejected", { id, phase: request.phase });
      clearTimeout(request.timer);
      request.reject(error);
    }
    pending.clear();
  };
  child.stdout.on("data", (chunk) => {
    buffered += chunk;
    let newline: number;
    while ((newline = buffered.indexOf("\n")) >= 0) {
      const line = buffered.slice(0, newline);
      buffered = buffered.slice(newline + 1);
      try {
        const reply = JSON.parse(line) as LoaderPoolOutcome & {
          id: number;
          readiness?: boolean;
          preparation?: {
            binaries: string[];
            startedAt: string;
            finishedAt: string;
            elapsedMs: number;
          };
        };
        if (reply.readiness === true) {
          observe("readiness", { failed: reply.error !== undefined });
          if (!preparationPending)
            throw new Error(`${props.mode}: unexpected readiness ${line}`);
          preparationPending = false;
          if (reply.error !== undefined)
            rejectPreparation(new Error(reply.error));
          else if (reply.preparation === undefined)
            rejectPreparation(
              new Error(`${props.mode}: preparation result is missing`),
            );
          else resolvePreparation(reply.preparation);
          continue;
        }
        const request = pending.get(reply.id);
        if (!request)
          throw new Error(`${props.mode}: unexpected response ${line}`);
        pending.delete(reply.id);
        clearTimeout(request.timer);
        observe("replied", {
          id: reply.id,
          phase: request.phase,
          failed: reply.error !== undefined,
        });
        request.resolve(reply);
      } catch (error) {
        rejectPreparation(error);
        rejectPending(error);
      }
    }
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  let processError: Error | undefined;
  child.once("error", (error) => {
    observe("process-error", { error: String(error).slice(0, 1024) });
    processError = error;
    rejectPreparation(error);
    rejectPending(error);
  });
  const closed = new Promise<void>((resolve, reject) =>
    child.once("close", (code, signal) => {
      try {
        fs.writeFileSync(diagnosticsFile, stderr, {
          flag: "wx",
        });
      } catch (error) {
        console.error("Loader-pool stderr retention failed: " + String(error));
      }
      observe("closed", { code, signal, pending: pending.size });
      const error =
        processError ??
        (code !== 0 || signal !== null
          ? new Error(
              `${props.mode}: status=${code} signal=${signal}\n${stderr}`,
            )
          : undefined);
      if (preparationPending) {
        preparationPending = false;
        rejectPreparation(
          error ?? new Error(`${props.mode}: closed before readiness`),
        );
      }
      rejectPending(error ?? new Error(`${props.mode}: closed before reply`));
      error ? reject(error) : resolve();
    }),
  );
  void closed.catch(() => undefined);
  return {
    ready,
    diagnosticsFile,
    request: (
      sourceSuffix = "",
      deliveredSource?: string,
      descriptorFlow?: {
        root: string;
        api: string;
        binary: string;
        tsgo: string;
        runtimeInputs?: {
          config: string;
          cache: string;
          nodePath: string;
          /** Invocation-only object cache; absent keeps inherited selection. */
          goBuildCache?: string;
        };
        lint?: {
          root: string;
          factory: string;
          ttsx: string;
          alpha: string;
          beta: string;
        };
      },
      graphProof?: { api: string; session: string; programRunLog: string },
      phase = "delivery",
    ) =>
      new Promise<LoaderPoolOutcome>((resolve, reject) => {
        const id = ++next;
        const label = phase.slice(0, 128);
        observe("sent", { id, phase: label, deadlineMs: 120_000 });
        const timer = setTimeout(() => {
          pending.delete(id);
          observe("deadline", { id, phase: label });
          reject(
            new Error(
              `${props.mode}: delivery remains unresolved (id=${id}, phase=${label}, childPid=${child.pid}): ${stderr}`,
            ),
          );
        }, 120_000);
        pending.set(id, { resolve, reject, timer, phase: label });
        child.stdin.write(
          JSON.stringify({
            id,
            sourceSuffix,
            deliveredSource,
            descriptorFlow,
            graphProof,
          }) + "\n",
        );
      }),
    diagnostics: () => stderr,
    pluginLock: (input: { root: string; api: string; action: string }) =>
      new Promise<LoaderPoolOutcome>((resolve, reject) => {
        const id = ++next;
        const phase = ("plugin-lock:" + input.action).slice(0, 128);
        observe("sent", { id, phase, deadlineMs: 120_000 });
        const timer = setTimeout(() => {
          pending.delete(id);
          observe("deadline", { id, phase });
          reject(
            new Error(
              `${props.mode}: plugin lock transition remains unresolved (id=${id}, phase=${phase}, childPid=${child.pid}): ${stderr}`,
            ),
          );
        }, 120_000);
        pending.set(id, { resolve, reject, timer, phase });
        child.stdin.write(JSON.stringify({ id, pluginLock: input }) + "\n");
      }),
    close: async () => {
      observe("close-sent", { pending: pending.size });
      child.stdin.end(JSON.stringify({ close: true }) + "\n");
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          closed,
          new Promise<never>((_, reject) => {
            timer = setTimeout(
              () =>
                reject(
                  new Error(
                    `${props.mode}: close remains unresolved (childPid=${child.pid}): ${stderr}`,
                  ),
                ),
              120_000,
            );
          }),
        ]);
      } finally {
        if (timer) clearTimeout(timer);
      }
    },
  };
}

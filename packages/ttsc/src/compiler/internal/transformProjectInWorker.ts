import { availableParallelism } from "node:os";
import path from "node:path";
import { Worker } from "node:worker_threads";

import { CompilerContextSnapshot } from "../../internal/CompilerContextSnapshot";
import type { ITtscCompilerContext } from "../../structures/ITtscCompilerContext";
import type { TransformProjectWorkerReply } from "./TransformProjectWorkerReply";
import type { TransformProjectWorkerRequest } from "./TransformProjectWorkerRequest";
import { SidecarEnvironment } from "./sharedHost/SidecarEnvironment";
import type { transformProjectInMemory } from "./transformProjectInMemory";

/**
 * {@link transformProjectInMemory} on a worker thread, so the calling thread's
 * event loop stays free for the whole transform (samchon/ttsc#1391).
 *
 * Every part of a transform blocks the thread that runs it: plugin loading
 * computes the source-plugin cache key and evaluates each descriptor in a child
 * process, and the native compile runs synchronously. Awaiting only the native
 * processes would leave plugin loading, which can take over a second per
 * transform on Windows, on the caller's loop. So the unchanged synchronous transform runs
 * on a worker thread instead, with the same envelope, failures, and
 * descriptor-resilient launches.
 *
 * The worker runs under the environment the compiler defines for everything it
 * starts: the calling thread's `process.env` as it is at this call, with the
 * compiler's own `env` merged over it, the same merge its child processes take
 * (`inheritedSidecarEnv`). Its in-process work therefore reads what the caller
 * configured, a temporary directory above all, without the caller rewriting its
 * own globals around the call, and nothing the caller changes afterward reaches
 * it (samchon/ttsc#1488). A worker serves one transform at a time and returns
 * to an idle pool afterward, keeping the in-process caches plugin loading
 * builds warm. Concurrent transforms get workers of their own. An idle worker
 * never keeps the process alive.
 *
 * Warm idle threads are retained up to the host's reported parallelism budget;
 * excess completed threads terminate. Active requests retain their own workers
 * without a concurrency cap or implicit deadline.
 *
 * @param context Compiler context of the requesting {@link TtscCompiler}.
 *
 * @returns What {@link transformProjectInMemory} returns, or a rejection with
 *   what it threw.
 *
 * @evidence contracts/common.md#principled-implementation One request exclusively owns a worker until its output, exception or death settles; structured cloning isolates caller data, and adopting that request's environment prevents a pooled worker from inheriting the previous invocation's authority.
 * @evidence contracts/common.md#clear-and-simple-design The public operation owns checkout, exclusive event listeners and return to the idle pool; two private helpers isolate idle-worker retirement from active request settlement.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Blocking work runs in a supported worker boundary rather than rewriting the caller's environment around synchronous work; failures preserve real exceptions and do not substitute measured or expected results.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain why all transform phases move off-thread, environment isolation, warm reuse and retained-population limits following the documentation skill.
 * @evidence contracts/portability.md#os-neutral-implementation Worker entry is a native path and the environment snapshot uses native name identity; Windows worker copies are case-sensitive, so canonical merging prevents aliases from defeating caller overrides inside the worker.
 * @evidence contracts/performance.md#efficient-algorithms Worker checkout is constant-time and request cloning costs the context size; the unchanged transform owns its project/source work off-thread, while no extra transform is performed merely to reconstruct its result on the caller.
 * @evidence contracts/performance.md#reuse-equivalent-work An exclusively checked-out warm worker reuses the loader's input-validated caches; each request adopts its complete current environment and still executes the transform, so thread reuse is not an unsupported response cache.
 * @evidence contracts/performance.md#bound-retention-and-release-resources At most the reported CPU budget remains idle and unreferenced; excess or failed workers terminate, and one terminal settlement removes active listeners. Active worker count scales with concurrent requests, and a live transform has no implicit deadline.
 */
export function transformProjectInWorker(
  context: ITtscCompilerContext,
): Promise<ReturnType<typeof transformProjectInMemory>> {
  const request: TransformProjectWorkerRequest = {
    context,
    env: SidecarEnvironment.merge(process.env, context.env),
    serializedPlugins: CompilerContextSnapshot.serializePlugins(context),
  };
  const worker =
    takeIdleWorker() ??
    new Worker(path.join(__dirname, "transformProjectWorker.js"));
  worker.ref();
  return new Promise((resolve, reject) => {
    let settled = false;
    const release = (reusable: boolean): boolean => {
      if (settled) return false;
      settled = true;
      worker.off("message", onMessage);
      worker.off("error", onError);
      worker.off("exit", onExit);
      if (reusable) {
        parkIdleWorker(worker);
      } else {
        void worker.terminate();
      }
      return true;
    };
    const onMessage = (reply: TransformProjectWorkerReply): void => {
      if (!release(true)) return;
      if ("output" in reply) {
        resolve(reply.output);
        return;
      }
      reject(reply.thrown);
    };
    const onError = (error: Error): void => {
      if (!release(false)) return;
      reject(error);
    };
    const onExit = (code: number): void => {
      if (!release(false)) return;
      reject(
        new Error(
          `ttsc: the transform worker exited with code ${code} before it answered`,
        ),
      );
    };
    worker.on("message", onMessage);
    worker.on("error", onError);
    worker.on("exit", onExit);
    try {
      worker.postMessage(request);
    } catch (error) {
      // A context that cannot be cloned never reached the worker, which stays
      // fit for the next request.
      if (!release(true)) return;
      reject(error);
    }
  });
}

/** Worker threads that finished their last transform, ready for the next. */
const IDLE_WORKERS: Worker[] = [];

/** Keep at most the host's CPU budget in warm, otherwise idle threads. */
const MAX_IDLE_WORKERS = availableParallelism();

/**
 * The listener each idle worker carries while it waits in {@link IDLE_WORKERS},
 * which takes it out of the pool if it fails or exits there.
 */
const IDLE_RETIREMENTS = new WeakMap<Worker, () => void>();

/**
 * Return a worker to the idle pool, with a listener that retires it if it fails
 * or exits while it waits there.
 *
 * An idle worker has no transform listening to it. Without that listener, an
 * error it raised would be unhandled and crash the host, and a worker that
 * exited would stay pooled, so the next transform would post to a dead thread
 * and wait forever.
 */
function parkIdleWorker(worker: Worker): void {
  if (IDLE_WORKERS.length >= MAX_IDLE_WORKERS) {
    void worker.terminate();
    return;
  }
  const retire = (): void => {
    worker.off("error", retire);
    worker.off("exit", retire);
    IDLE_RETIREMENTS.delete(worker);
    const index = IDLE_WORKERS.indexOf(worker);
    if (index !== -1) IDLE_WORKERS.splice(index, 1);
  };
  worker.on("error", retire);
  worker.on("exit", retire);
  IDLE_RETIREMENTS.set(worker, retire);
  worker.unref();
  IDLE_WORKERS.push(worker);
}

/** Take a worker out of the idle pool, detaching its idle-time listener. */
function takeIdleWorker(): Worker | undefined {
  const worker = IDLE_WORKERS.pop();
  if (worker === undefined) return undefined;
  const retire = IDLE_RETIREMENTS.get(worker);
  if (retire !== undefined) {
    worker.off("error", retire);
    worker.off("exit", retire);
    IDLE_RETIREMENTS.delete(worker);
  }
  return worker;
}

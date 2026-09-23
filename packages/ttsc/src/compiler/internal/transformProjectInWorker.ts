import path from "node:path";
import { Worker } from "node:worker_threads";

import type { ITtscCompilerContext } from "../../structures/ITtscCompilerContext";
import type { TransformProjectWorkerReply } from "./TransformProjectWorkerReply";
import type { TransformProjectWorkerRequest } from "./TransformProjectWorkerRequest";
import type { transformProjectInMemory } from "./transformProjectInMemory";

/** Worker threads that finished their last transform, ready for the next. */
const IDLE_WORKERS: Worker[] = [];

/**
 * The listener each idle worker carries while it waits in {@link IDLE_WORKERS},
 * which takes it out of the pool if it fails or exits there.
 */
const IDLE_RETIREMENTS = new WeakMap<Worker, () => void>();

/**
 * {@link transformProjectInMemory} on a worker thread, so the calling thread's
 * event loop stays free for the whole transform (samchon/ttsc#1391).
 *
 * Every part of a transform blocks the thread that runs it: plugin loading
 * computes the source-plugin cache key and evaluates each descriptor in a child
 * process, and the native compile runs synchronously. Awaiting only the native
 * processes would leave plugin loading, measured at over a second per transform
 * on Windows, on the caller's loop. So the unchanged synchronous transform runs
 * on a worker thread instead, with the same envelope, failures, and
 * descriptor-resilient launches.
 *
 * The worker runs under the environment the compiler defines for everything it
 * starts: the calling thread's `process.env` as it is at this call, with the
 * compiler's own `env` merged over it, the same merge its child processes take
 * (`inheritedSidecarEnv`). Its in-process work therefore reads what the caller
 * configured, a temporary directory above all, without the caller rewriting
 * its own globals around the call, and nothing the caller changes afterward
 * reaches it (samchon/ttsc#1488). A worker serves one transform at a time and
 * returns to an idle pool afterward, keeping the in-process caches plugin
 * loading builds warm. Concurrent transforms get workers of their own. An idle
 * worker never keeps the process alive.
 *
 * @param context Compiler context of the requesting {@link TtscCompiler}.
 * @returns What {@link transformProjectInMemory} returns, or a rejection with
 *   what it threw.
 */
export function transformProjectInWorker(
  context: ITtscCompilerContext,
): Promise<ReturnType<typeof transformProjectInMemory>> {
  const request: TransformProjectWorkerRequest = {
    context,
    env: { ...process.env, ...context.env },
  };
  const worker =
    takeIdleWorker() ??
    new Worker(path.join(__dirname, "transformProjectWorker.js"));
  worker.ref();
  return new Promise((resolve, reject) => {
    const release = (reusable: boolean): void => {
      worker.off("message", onMessage);
      worker.off("error", onError);
      worker.off("exit", onExit);
      if (reusable) {
        parkIdleWorker(worker);
      } else {
        void worker.terminate();
      }
    };
    const onMessage = (reply: TransformProjectWorkerReply): void => {
      release(true);
      if ("output" in reply) {
        resolve(reply.output);
        return;
      }
      const error = new Error(reply.thrown.message);
      if (reply.thrown.name !== undefined) error.name = reply.thrown.name;
      if (reply.thrown.stack !== undefined) error.stack = reply.thrown.stack;
      reject(error);
    };
    const onError = (error: Error): void => {
      release(false);
      reject(error);
    };
    const onExit = (code: number): void => {
      release(false);
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
      release(true);
      reject(error);
    }
  });
}

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

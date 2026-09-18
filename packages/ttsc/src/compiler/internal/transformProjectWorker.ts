/**
 * Entry of the worker threads {@link transformProjectInWorker} runs project
 * transforms on (samchon/ttsc#1391).
 *
 * Each message is one {@link TransformProjectWorkerRequest}. The thread adopts
 * the request's environment, runs the synchronous transform, and answers with a
 * {@link TransformProjectWorkerReply}. A thread serves one request at a time and
 * stays alive for the next, so the in-process caches plugin loading builds stay
 * warm across generations, as they would on the calling thread.
 */
import { parentPort } from "node:worker_threads";

import type { TransformProjectWorkerReply } from "./TransformProjectWorkerReply";
import type { TransformProjectWorkerRequest } from "./TransformProjectWorkerRequest";
import { transformProjectInMemory } from "./transformProjectInMemory";

parentPort?.on("message", (request: TransformProjectWorkerRequest) => {
  adoptEnvironment(request.env);
  let reply: TransformProjectWorkerReply;
  try {
    reply = { output: transformProjectInMemory(request.context) };
  } catch (error) {
    reply = {
      thrown:
        error instanceof Error
          ? { message: error.message, name: error.name, stack: error.stack }
          : { message: String(error) },
    };
  }
  parentPort!.postMessage(reply);
});

/** Make `env` this thread's `process.env`, dropping what it does not name. */
function adoptEnvironment(env: Record<string, string | undefined>): void {
  for (const key of Object.keys(process.env)) {
    if (!Object.hasOwn(env, key)) delete process.env[key];
  }
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

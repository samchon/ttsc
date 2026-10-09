/**
 * Entry of the worker threads {@link transformProjectInWorker} runs project
 * transforms on.
 *
 * Each message is one {@link TransformProjectWorkerRequest}. The thread adopts
 * the request's environment, runs the synchronous transform, and answers with a
 * {@link TransformProjectWorkerReply}. A thread serves one request at a time and
 * stays alive for the next, so the in-process caches plugin loading builds stay
 * warm across generations, as they would on the calling thread.
 */
import { parentPort } from "node:worker_threads";

import { CompilerContextSnapshot } from "../../internal/CompilerContextSnapshot";
import { serializeCompilerError } from "../../internal/serializeCompilerError";
import type { TransformProjectWorkerReply } from "./TransformProjectWorkerReply";
import type { TransformProjectWorkerRequest } from "./TransformProjectWorkerRequest";
import { SidecarEnvironment } from "./sharedHost/SidecarEnvironment";
import { transformProjectInMemory } from "./transformProjectInMemory";

parentPort?.on("message", (request: TransformProjectWorkerRequest) => {
  adoptEnvironment(request.env);
  let reply: TransformProjectWorkerReply;
  try {
    reply = {
      output: transformProjectInMemory(
        CompilerContextSnapshot.restorePlugins(
          request.context,
          request.serializedPlugins,
        ),
      ),
    };
  } catch (error) {
    reply = {
      thrown: serializeCompilerError(error),
    };
  }
  parentPort!.postMessage(reply);
});

/** Adopt native environment names on this isolated thread, dropping stale state. */
function adoptEnvironment(env: Record<string, string | undefined>): void {
  SidecarEnvironment.replace(process.env, env);
}

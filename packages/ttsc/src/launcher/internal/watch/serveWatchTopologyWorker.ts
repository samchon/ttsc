import type { MessagePort } from "node:worker_threads";

import { serializeCompilerError } from "../../../internal/serializeCompilerError";
import type { WatchTopology } from "./WatchTopology";
import type { WatchTopologyWorkerProtocol } from "./WatchTopologyWorkerProtocol";

/**
 * Serve ordered topology operations until close joins all outstanding answers.
 *
 * Mutation runs synchronously when its message arrives. An idle barrier yields so a later close can stop continuous native events; closing then waits for those earlier barriers to answer before closing the callback channel.
 *
 * @evidence contracts/common.md#principled-implementation FIFO messages invoke actual core operations in order, while close releases subscriptions before outstanding idle barriers finish and the reply port retires.
 * @evidence contracts/common.md#clear-and-simple-design One dispatcher owns operation correlation and answer lifetime; core callbacks and filesystem decisions remain separate.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The supplied core is the production owner, and serialization retains actual operation failures without fabricating completion.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains ordered mutation, yielding idle barriers and close ordering.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation MessagePort supplies portable FIFO transport; the core owns native work.
 * @evidence contracts/performance.md#efficient-algorithms Dispatch and correlation use constant structural work per message plus cloned reply bytes; delegated topology work retains its original costs. Shutdown visits outstanding promises once.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each message invokes its own operation rather than reusing an earlier result.
 * @evidence contracts/performance.md#bound-retention-and-release-resources In-flight answers occupy an uncapped set and leave it on completion. Close releases the port after all accepted answers settle; core close failure still reaches the caller, which owns worker termination.
 */
export function serveWatchTopologyWorker(
  topology: WatchTopology,
  port: MessagePort,
): void {
  const active = new Set<Promise<void>>();
  let closing = false;
  port.on("message", (request: WatchTopologyWorkerProtocol.Request) => {
    const answering = (
      closing
        ? Promise.reject(new Error("ttsc: watch topology is closing"))
        : execute(topology, request)
    ).then(
      () => port.postMessage({ id: request.id, ok: true }),
      (error: unknown) =>
        port.postMessage({
          id: request.id,
          ok: false,
          error: serializeCompilerError(error),
        }),
    );
    active.add(answering);
    if (request.method === "close") closing = true;
    void answering.then(() => {
      active.delete(answering);
      if (request.method === "close")
        void Promise.allSettled([...active]).then(() => port.close());
    });
  });
}

/** Dispatch one actual core operation; only the idle barrier yields. */
async function execute(
  topology: WatchTopology,
  request: WatchTopologyWorkerProtocol.Request,
): Promise<void> {
  switch (request.method) {
    case "refresh":
      topology.refresh(request.notify);
      break;
    case "setExtraInputs":
      topology.setExtraInputs(request.inputs, request.identities);
      break;
    case "setProjectInputs":
      topology.setProjectInputs(request.inputs);
      break;
    case "whenIdle":
      await topology.whenIdle();
      break;
    case "close":
      topology.close();
      break;
  }
}

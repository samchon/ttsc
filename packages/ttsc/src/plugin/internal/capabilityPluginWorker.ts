import type { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  MessageChannel,
  parentPort,
  receiveMessageOnPort,
} from "node:worker_threads";

import { SidecarEnvironment } from "../../compiler/internal/sharedHost/SidecarEnvironment";
import { E2ETrace } from "../../internal/E2ETrace";
import { OwnedSynchronousProcess } from "../../internal/OwnedSynchronousProcess";
import { SourceNativeRetirement } from "../../internal/SourceNativeRetirement";
import { restoreCompilerError } from "../../internal/restoreCompilerError";
import { serializeCompilerError } from "../../internal/serializeCompilerError";
import type { ITtscCapabilityPluginResolution } from "../ITtscCapabilityPlugin";
import { resolveCapabilityPluginResolution } from "../resolveCapabilityPlugins";
import { decodeCapabilityCommandReply } from "./decodeCapabilityCommandReply";

/**
 * Keep original capability proof closures on their synchronous SDK thread. Each
 * task's native commands rendezvous with the parent process owner, while shared
 * cancellation wakes payload sleeps and rejects only after cleanup.
 */
const proofs = new Map<number, ITtscCapabilityPluginResolution>();
let nextHandle = 0;
let queue = Promise.resolve();
parentPort?.on("message", (request: Request) => {
  if (request.kind === "discard") {
    proofs.delete(request.handle!);
    return;
  }
  queue = queue
    .then(() => handle(request))
    .catch((error: unknown) => {
      // An unrecoverable protocol write must retire this owner, rather than leave
      // a live thread whose queue can never produce another terminal reply.
      parentPort!.close();
      throw error;
    });
});

async function handle(request: Request): Promise<void> {
  if (request.kind === "close") {
    proofs.clear();
    parentPort!.close();
    return;
  }
  const retirements = new Set<Promise<unknown>>();
  const ownershipFailures: unknown[] = [];
  let value: unknown;
  let thrown: unknown;
  let createdHandle: number | undefined;
  try {
    adoptEnvironment(request.env);
    const scope = SourceNativeRetirement.createScope(request.taskToken);
    value = SourceNativeRetirement.run(scope, () =>
      OwnedSynchronousProcess.run(
        {
          cancel: request.cancel,
          retirements,
          failures: ownershipFailures,
          launch: (command, args, options) =>
            commandRelay(request, command, args, options),
        },
        () => {
          if (request.kind === "resolve") {
            const result = resolveCapabilityPluginResolution(request.options!);
            OwnedSynchronousProcess.checkpoint();
            const handle = ++nextHandle;
            createdHandle = handle;
            proofs.set(handle, result);
            return { handle, status: result.status, plugins: result.plugins };
          }
          if (request.kind === "release") {
            proofs.delete(request.handle!);
            return undefined;
          }
          return proofs.get(request.handle!)?.isCurrent() ?? false;
        },
      ),
    );
  } catch (error) {
    thrown = error;
  }
  const released = await Promise.allSettled(retirements);
  const failures = [
    ...ownershipFailures,
    ...released.flatMap((result) =>
      result.status === "rejected" ? [result.reason] : [],
    ),
  ];
  if (failures.length > 0)
    thrown = new AggregateError(
      [...(thrown === undefined ? [] : [thrown]), ...failures],
      "ttsc: resolver background cleanup failed",
    );
  if (
    Atomics.load(new Int32Array(request.cancel), 0) !== 0 &&
    thrown === undefined
  )
    thrown = new DOMException("ttsc: operation cancelled", "AbortError");
  if (thrown !== undefined && createdHandle !== undefined)
    proofs.delete(createdHandle);
  // The general compiler serializer intentionally does not invoke accessors.
  // DOMException exposes name/message through accessors, so transport this
  // worker-owned cancellation as explicit Error data, not an accessor marker.
  if (thrown instanceof DOMException && thrown.name === "AbortError")
    thrown = Object.assign(new Error(thrown.message), { name: "AbortError" });
  parentPort!.postMessage({
    kind: "reply",
    id: request.id,
    ...(thrown === undefined
      ? { value }
      : {
          thrown: serializeCompilerError(thrown),
          ownershipFailed: failures.length > 0,
        }),
  });
}

function commandRelay(
  request: Request,
  command: string,
  args: readonly string[],
  options: OwnedSynchronousProcess.CommandOptions,
): ReturnType<typeof spawnSync> {
  const done = new SharedArrayBuffer(4);
  const { port1, port2 } = new MessageChannel();
  const boundary = `${request.id}:${++nextCommand}`;
  SourceNativeRetirement.begin(boundary);
  let certified = false;
  try {
    parentPort!.postMessage(
      {
        kind: "command",
        id: request.id,
        command,
        args,
        options: {
          ...options,
          ...(options.cwd instanceof URL
            ? { cwd: fileURLToPath(options.cwd) }
            : {}),
        },
        done,
        boundary,
        port: port2,
      },
      [port2],
    );
    E2ETrace.capabilityResolution("command-relay-queued", {
      request: request.id,
      boundary,
      taskToken: request.taskToken,
    });
    const state = new Int32Array(done);
    while (Atomics.load(state, 0) === 0) Atomics.wait(state, 0, 0);
    const reply = receiveMessageOnPort(port1);
    if (reply === undefined)
      throw new Error("ttsc: native relay did not publish its reply");
    const response = decodeCapabilityCommandReply(reply.message);
    if (
      response.retirement !== "joined" &&
      response.retirement !== "not-started"
    )
      throw new Error("ttsc: native relay did not certify retirement", {
        cause: response.thrown,
      });
    SourceNativeRetirement.settle(boundary, response.retirement);
    certified = true;
    if (response.thrown !== undefined) {
      const failure = restoreCompilerError(response.thrown);
      if (failure.name !== "AbortError")
        OwnedSynchronousProcess.reportFailure(failure);
      throw failure;
    }
    if (response.result === undefined)
      throw new Error("ttsc: native relay omitted its result");
    if (response.result.error !== undefined)
      response.result.error = restoreCompilerError(response.result.error);
    return response.result;
  } catch (error) {
    // This is idempotent after a certified settlement; a broken exchange has
    // no authority to release registered source and cache inputs.
    if (!certified) {
      // Existing discovery intentionally catches incompatible runtime probes.
      // It cannot downgrade a lost native lifetime proof to a usable answer.
      OwnedSynchronousProcess.reportFailure(error);
      try {
        SourceNativeRetirement.settle(boundary, "unknown", String(error));
      } catch (failure) {
        OwnedSynchronousProcess.reportFailure(failure);
        throw new AggregateError(
          [error, failure],
          "ttsc: native retirement protection failed",
        );
      }
    }
    throw error;
  } finally {
    port1.close();
    port2.close();
  }
}

function adoptEnvironment(env: NodeJS.ProcessEnv): void {
  SidecarEnvironment.replace(process.env, env);
}

interface Request {
  kind: "resolve" | "current" | "release" | "close" | "discard";
  id: number;
  handle?: number;
  options?: { capability: string; cwd?: string; tsconfig?: string };
  cancel: SharedArrayBuffer;
  taskToken: string;
  env: NodeJS.ProcessEnv;
}

let nextCommand = 0;

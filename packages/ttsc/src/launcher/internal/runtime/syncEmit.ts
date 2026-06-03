import path from "node:path";
import {
  MessageChannel,
  Worker,
  receiveMessageOnPort,
  type MessagePort,
} from "node:worker_threads";

import type { EmitRequest, EmitResponse } from "./emitProtocol";

/**
 * Synchronous client for the native per-file emit host.
 *
 * `emitSync` must return inside a CommonJS `require`, which is synchronous, but
 * the host speaks over an async pipe. The bridge is a worker thread (see
 * `emitWorker`) that owns the pipe: the main thread posts a request, blocks on
 * `Atomics.wait`, and the worker wakes it with `Atomics.notify` once the reply
 * is queued, which the main thread then drains synchronously with
 * `receiveMessageOnPort`.
 */
interface ClientState {
  port: MessagePort;
  signal: Int32Array;
}

let state: ClientState | null = null;

/** Start the emit worker and host. Idempotent; call once per process. */
export function startEmitClient(options: {
  serverBin: string;
  serverArgs: readonly string[];
  cwd: string;
}): void {
  if (state !== null) {
    return;
  }
  const channel = new MessageChannel();
  const signalBuffer = new SharedArrayBuffer(4);
  // Strip NODE_OPTIONS so the worker does not re-run the `--import` registrar
  // (which would start another emit client, recursing without end).
  const workerEnv: Record<string, string> = {};
  for (const [name, value] of Object.entries(process.env)) {
    if (value !== undefined && name !== "NODE_OPTIONS") {
      workerEnv[name] = value;
    }
  }
  const worker = new Worker(path.join(__dirname, "emitWorker.js"), {
    env: workerEnv,
    workerData: {
      serverBin: options.serverBin,
      serverArgs: options.serverArgs,
      cwd: options.cwd,
      signalBuffer,
      port: channel.port2,
    },
    transferList: [channel.port2],
  });
  // The worker must not keep the process alive past the entry program.
  worker.unref();
  state = { port: channel.port1, signal: new Int32Array(signalBuffer) };
}

/**
 * Emit one file through its owning tsconfig and return the JavaScript,
 * blocking the calling thread until the host responds. Throws on host error.
 */
export function emitSync(request: EmitRequest): string {
  if (state === null) {
    throw new Error("ttsx: emit client not started");
  }
  Atomics.store(state.signal, 0, 0);
  state.port.postMessage(request);
  Atomics.wait(state.signal, 0, 0);
  const received = receiveMessageOnPort(state.port);
  const response = (received?.message ?? {
    error: "ttsx: emit host produced no response",
  }) as EmitResponse;
  if (response.error !== undefined && response.error !== "") {
    throw new Error(response.error);
  }
  return response.code ?? "";
}

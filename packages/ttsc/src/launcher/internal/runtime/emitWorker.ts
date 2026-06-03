import { spawn } from "node:child_process";
import type { MessagePort } from "node:worker_threads";
import { workerData } from "node:worker_threads";

import type { EmitRequest, EmitResponse } from "./emitProtocol";
import { encodeFrame, FrameDecoder } from "./emitProtocol";

/**
 * Worker thread that owns the persistent native emit host and bridges the main
 * thread's synchronous loader hook to it.
 *
 * The main thread cannot block on async socket I/O, but a CommonJS `require`
 * must resolve synchronously. So the host connection lives here: the main
 * thread posts a request over `port`, blocks on an `Atomics.wait`, and this
 * worker — running on its own thread — writes the request to the host, reads
 * the framed reply, posts it back over `port`, and wakes the main thread via
 * `Atomics.notify`. The main thread then drains the reply with
 * `receiveMessageOnPort`. One request is outstanding at a time by construction
 * (the caller is synchronous), so no request queue is needed.
 */
interface WorkerData {
  serverBin: string;
  serverArgs: readonly string[];
  cwd: string;
  signalBuffer: SharedArrayBuffer;
  port: MessagePort;
}

const { serverBin, serverArgs, cwd, signalBuffer, port } =
  workerData as WorkerData;
const signal = new Int32Array(signalBuffer);

const server = spawn(serverBin, [...serverArgs], {
  cwd,
  env: process.env,
  stdio: ["pipe", "pipe", "inherit"],
});

const decoder = new FrameDecoder();
let pending: ((res: EmitResponse) => void) | null = null;

server.stdout.on("data", (chunk: Buffer) => {
  decoder.push(chunk);
  let frame: unknown;
  while ((frame = decoder.next()) !== null) {
    const resolve = pending;
    pending = null;
    if (resolve) {
      resolve(frame as EmitResponse);
    }
  }
});

server.on("error", (error) => fail(`emit host failed to start: ${error.message}`));
server.on("exit", (code, sig) =>
  fail(`emit host exited (code ${code ?? "null"}, signal ${sig ?? "null"})`),
);

port.on("message", (req: EmitRequest) => {
  if (pending !== null) {
    reply({ error: "emit host busy: overlapping request" });
    return;
  }
  pending = reply;
  server.stdin.write(encodeFrame(req));
});

/** Post a reply to the main thread and wake its `Atomics.wait`. */
function reply(res: EmitResponse): void {
  port.postMessage(res);
  Atomics.store(signal, 0, 1);
  Atomics.notify(signal, 0);
}

/** Resolve any outstanding request with an error after a host failure. */
function fail(message: string): void {
  const resolve = pending;
  pending = null;
  if (resolve) {
    resolve({ error: message });
  }
}

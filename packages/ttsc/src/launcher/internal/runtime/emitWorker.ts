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
  /** Extra environment for the host process (e.g. the linked-plugin manifest). */
  env: Record<string, string>;
  signalBuffer: SharedArrayBuffer;
  port: MessagePort;
}

const { serverBin, serverArgs, cwd, env, signalBuffer, port } =
  workerData as WorkerData;
const signal = new Int32Array(signalBuffer);

const server = spawn(serverBin, [...serverArgs], {
  cwd,
  env: { ...process.env, ...env },
  stdio: ["pipe", "pipe", "inherit"],
});

/**
 * A host that does not speak this protocol (e.g. an older plugin binary whose
 * unknown-command fallback runs a build instead of serving) never sends the
 * readiness handshake. Without this bound the loader would block forever on its
 * `Atomics.wait`; instead the host is given a short window to announce itself.
 */
const READY_TIMEOUT_MS = 30_000;
const NEEDS_SERVE_MESSAGE =
  "emit host did not start the emit protocol; the configured transform host " +
  "may be too old to support ttsx (a typia host, for example, must provide " +
  "the `serve` command)";

const decoder = new FrameDecoder();
let pending: ((res: EmitResponse) => void) | null = null;
let ready = false;
let failure: string | null = null;
let queued: EmitRequest | null = null;

const readyTimer = setTimeout(() => {
  if (!ready) {
    failHost(NEEDS_SERVE_MESSAGE);
  }
}, READY_TIMEOUT_MS);
readyTimer.unref?.();

server.stdout.on("data", (chunk: Buffer) => {
  if (failure !== null) {
    return;
  }
  decoder.push(chunk);
  for (;;) {
    let frame: unknown;
    try {
      frame = decoder.next();
    } catch {
      failHost("emit host produced invalid protocol output (serve unsupported?)");
      return;
    }
    if (frame === null) {
      return;
    }
    const res = frame as EmitResponse;
    if (!ready) {
      // The first frame must be the readiness handshake; anything else means
      // the host is not serving this protocol.
      if (res.ready === true) {
        ready = true;
        clearTimeout(readyTimer);
        if (queued !== null) {
          const request = queued;
          queued = null;
          server.stdin.write(encodeFrame(request));
        }
        continue;
      }
      failHost(NEEDS_SERVE_MESSAGE);
      return;
    }
    const resolve = pending;
    pending = null;
    if (resolve) {
      resolve(res);
    }
  }
});

server.on("error", (error) =>
  failHost(`emit host failed to start: ${error.message}`),
);
server.on("exit", (code, sig) =>
  failHost(`emit host exited (code ${code ?? "null"}, signal ${sig ?? "null"})`),
);

port.on("message", (req: EmitRequest) => {
  if (failure !== null) {
    reply({ error: failure });
    return;
  }
  if (pending !== null) {
    reply({ error: "emit host busy: overlapping request" });
    return;
  }
  pending = reply;
  if (!ready) {
    // Hold the request until the handshake lands (or the startup window fails).
    queued = req;
    return;
  }
  server.stdin.write(encodeFrame(req));
});

/** Post a reply to the main thread and wake its `Atomics.wait`. */
function reply(res: EmitResponse): void {
  port.postMessage(res);
  Atomics.store(signal, 0, 1);
  Atomics.notify(signal, 0);
}

/**
 * Record a fatal host failure and resolve any outstanding (or held) request
 * with it. Every subsequent request fails fast with the same message so the
 * loader never blocks on a host that cannot serve.
 */
function failHost(message: string): void {
  if (failure === null) {
    failure = message;
  }
  clearTimeout(readyTimer);
  queued = null;
  const resolve = pending;
  pending = null;
  if (resolve) {
    resolve({ error: failure });
  }
}

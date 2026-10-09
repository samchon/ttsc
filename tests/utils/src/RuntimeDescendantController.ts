import crypto from "node:crypto";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import type { NativeProcessObserver } from "./NativeProcessObserver";

/**
 * Authenticates held test descendants and joins their original kernel targets.
 *
 * Callers choose the allowed roles and own clean, compiler and reporting policy.
 * The supplied observer is borrowed. All its requests are serialized because
 * the native protocol permits only one pending wait. Socket closure is never
 * departure authority. Synchronous fixture callers use the same controller's
 * nonce-bound file rendezvous while its owner keeps the event loop running.
 *
 * @evidence contracts/common.md#principled-implementation Authenticated announcements hold parent and child until sequential original-target enrollment; release and completion are distinct from retained-kernel retirement.
 * @evidence contracts/common.md#clear-and-simple-design One extracted controller owns frame admission, command routing and original targets; callers retain scenario policy and observer preparation/close.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No native backend, foreign primitive or product loader changes; PID values are enrollment coordinates only and EOF supplies no retirement certificate.
 * @evidence contracts/common.md#meaningful-documentation Explains held enrollment, borrowed session, serialized requests, caller policy and synchronous rendezvous.
 * @evidence contracts/portability.md#os-neutral-implementation Loopback sockets and native paths carry authored frames; original lifetime differences remain behind the supplied observer's Windows handle, Linux pidfd or Darwin knote.
 * @evidence contracts/performance.md#efficient-algorithms Role and request maps provide direct lookup; each bounded frame and request file is parsed once, and zero-grace retirement polls serialize over enrolled targets.
 * @evidence contracts/performance.md#reuse-equivalent-work One controller and borrowed observer serve all allowed roles; each actual process is enrolled once without reusing another incarnation's result.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The caller closes transport only after all original targets retire; pending native requests drain before return. Failed acquisition or unknown departure retains errors and forbids a successful close, without a duration-based proof.
 */
export namespace RuntimeDescendantController {
  /**
   * Create the controller without starting a server or preparing an observer.
   *
   * `receive` is the actual transport boundary used by the loopback adapter;
   * direct portable tests may supply authored frames and a transport callback.
   * `listen` starts the real socket/file adapters. `close` releases those
   * adapters, checks every admitted original lifetime and reports all errors.
   * The observer session remains the caller's responsibility.
   *
   * @evidence contracts/common.md#principled-implementation Per-role phases reject duplicate/foreign admission and completion before release; a shared promise queue serializes every acquire/retired call and kernel results alone establish departure.
   * @evidence contracts/common.md#clear-and-simple-design The same receive/request operations serve real adapters and direct tests; no second implementation predicts transport outcomes.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Explicit callback injection is the actual transport boundary; no expected process result, PID absence or socket close replaces an observer response.
   * @evidence contracts/common.md#meaningful-documentation States that construction is inert, adapters are opt-in, and close owns transport rather than the borrowed native session.
   * @evidence contracts/portability.md#os-neutral-implementation The supplied observer owns native process identity; loopback listen selects an actual ephemeral port and filesystem IO uses a caller-owned absolute directory.
   * @evidence contracts/performance.md#efficient-algorithms Maps index finite admitted roles and request IDs; frames are limited to 64KiB, and each request is removed after its atomic response publication.
   * @evidence contracts/performance.md#reuse-equivalent-work Admission promises and original targets are shared by concurrent requests for the same role, while new roles acquire their own targets.
   * @evidence contracts/performance.md#bound-retention-and-release-resources One timer/server belongs to listen; close stops admission, drains pending requests and checks originals before closing sockets/server. Unknown targets remain explicit failures and caller inputs must be retained.
   */
  export function create(
    observer: Pick<Observer, "sessionNonce" | "acquire" | "retired">,
    allowedRoles: readonly string[],
  ): Controller {
    const nonce = crypto.randomBytes(24).toString("hex");
    const allowed = new Set(allowedRoles);
    if (allowed.size !== allowedRoles.length || allowed.has(""))
      throw new Error("Descendant roles must be unique and nonempty");
    const roles = new Map<string, Role>();
    const failures: unknown[] = [];
    const transports = new Set<Transport>();
    const requests = new Set<Promise<void>>();
    let queue: Promise<unknown> = Promise.resolve();
    let server: net.Server | undefined;
    let poll: NodeJS.Timeout | undefined;
    let directory: string | undefined;
    let closing: Promise<void> | undefined;
    let joined = false;
    const serial = <T>(operation: () => Promise<T>): Promise<T> => {
      const pending = queue.then(operation);
      queue = pending.catch(() => {});
      return pending;
    };
    const state = (role: string): Role => {
      const value = roles.get(role);
      if (!value) throw new Error("No authenticated descendant: " + role);
      return value;
    };
    const retired = (target: Target): Promise<boolean> =>
      serial(() => observer.retired(target));
    const wait = async (target: Target): Promise<void> => {
      while (!(await retired(target))) await delay(10);
    };
    const receive = async (
      input: unknown,
      transport: Transport,
    ): Promise<void> => {
      const frame = object(input);
      if (closing || frame.version !== 1 || frame.nonce !== nonce ||
          typeof frame.role !== "string" || !allowed.has(frame.role))
        throw new Error("Foreign descendant frame");
      const role = frame.role;
      if (frame.event === "announce") {
        if (roles.has(role)) throw new Error("Duplicate descendant role: " + role);
        const pid = positivePid(frame.pid);
        const parentPid = positivePid(frame.parentPid);
        if (pid === parentPid) throw new Error("Descendant cannot be its parent");
        const current: Role = {
          transport, announcement: frame, phase: "enrolling",
          admission: Promise.resolve(),
        };
        roles.set(role, current);
        current.admission = (async () => {
          current.parent = await serial(() => observer.acquire(parentPid));
          current.target = await serial(() => observer.acquire(pid));
          current.phase = "held";
          transport.send({ version: 1, nonce, role, event: "acquired",
            parent: current.parent, target: current.target });
        })();
        try { await current.admission; }
        catch (cause) { current.failure = cause; throw cause; }
        return;
      }
      const current = state(role);
      if (current.transport !== transport || frame.pid !== current.announcement.pid)
        throw new Error("Foreign descendant transport or target");
      await current.admission;
      if (frame.event !== "complete" || current.phase !== "released" ||
          current.completion !== undefined)
        throw new Error("Invalid descendant completion phase: " + role);
      if (typeof frame.value !== "string" && !Object.hasOwn(frame, "error"))
        throw new Error("Descendant completion lacks result or error");
      current.completion = frame;
    };
    const request = async (role: string, operation: string): Promise<unknown> => {
      if (closing) throw new Error("Descendant controller is closing");
      const current = state(role);
      await current.admission;
      if (current.failure !== undefined && operation !== "abort" && operation !== "joined")
        throw current.failure;
      const target = current.target!;
      if (operation === "ready")
        return { announcement: current.announcement, target, parent: current.parent };
      if (operation === "parent-joined") {
        await wait(current.parent!);
        return { parent: current.parent, retired: true };
      }
      if (operation === "live") {
        if (current.phase !== "held") throw new Error("Descendant is not held");
        if (await retired(target)) throw new Error("Held descendant already retired");
        return { target, live: true };
      }
      if (operation === "release" || operation === "abandon" || operation === "abort") {
        if (current.phase !== "held") throw new Error("Descendant already released");
        const at = new Date().toISOString();
        current.phase = operation === "release" ? "released" : "abandoned";
        transportCommand(current, nonce, role, operation);
        return { target, operation, at };
      }
      if (operation === "joined") {
        if (current.phase !== "released" && current.phase !== "abandoned" &&
            current.phase !== "retired")
          throw new Error("Cannot join an unreleased descendant");
        await wait(target);
        // Kernel departure is established first. Drain its final socket frame
        // before deciding whether the departed child supplied a lazy result.
        await current.transport.settled;
        await wait(current.parent!);
        current.phase = "retired";
        if (current.failure !== undefined) throw current.failure;
        if (current.completion === undefined && !current.abrupt)
          throw new Error("Descendant retired without lazy completion");
        return { target, parent: current.parent, retired: true,
          completion: current.completion ?? null };
      }
      throw new Error("Unknown descendant request: " + operation);
    };
    const disconnected = (transport: Transport): void => {
      for (const [role, current] of roles) {
        if (current.transport !== transport) continue;
        if (current.phase === "abandoned" || current.phase === "retired" ||
            current.completion !== undefined) return;
        current.failure ??= new Error("Descendant connection ended before completion: " + role);
      }
    };
    const listen = async (root: string): Promise<{ port: number; nonce: string; directory: string }> => {
      if (server || closing || !path.isAbsolute(root))
        throw new Error("Controller requires one owned absolute receipt root");
      directory = root;
      fs.mkdirSync(path.join(root, "requests"), { recursive: true });
      fs.mkdirSync(path.join(root, "responses"), { recursive: true });
      server = net.createServer((socket) => {
        let input = "";
        let frames = Promise.resolve();
        let settle!: () => void;
        const transport: Transport = {
          send: (frame) => socket.write(JSON.stringify(frame) + "\n"),
          close: () => socket.destroy(),
          settled: new Promise<void>((resolve) => { settle = resolve; }),
        };
        transports.add(transport);
        socket.setEncoding("utf8");
        socket.on("error", (cause) => failures.push(cause));
        socket.on("data", (chunk: string) => {
          input += chunk;
          if (Buffer.byteLength(input) > 65536) {
            failures.push(new Error("Descendant frame exceeds 64KiB"));
            socket.destroy();
            return;
          }
          let end: number;
          while ((end = input.indexOf("\n")) >= 0) {
            const text = input.slice(0, end);
            input = input.slice(end + 1);
            frames = frames.then(() => receive(JSON.parse(text), transport)).catch((cause) => {
              failures.push(cause);
              socket.destroy();
            });
          }
        });
        socket.once("close", () => {
          transports.delete(transport);
          void frames.then(() => { disconnected(transport); settle(); });
        });
      });
      await new Promise<void>((resolve, reject) => {
        server!.once("error", reject);
        server!.listen(0, "127.0.0.1", resolve);
      });
      server.on("error", (cause) => failures.push(cause));
      const seen = new Set<string>();
      poll = setInterval(() => {
        for (const name of fs.readdirSync(path.join(root, "requests"))) {
          if (!/^[a-f0-9-]+\.json$/.test(name) || seen.has(name)) continue;
          seen.add(name);
          const task = (async () => {
            let result: unknown;
            try {
              const input = object(JSON.parse(fs.readFileSync(path.join(root, "requests", name), "utf8")));
              if (input.nonce !== nonce || typeof input.role !== "string" ||
                  typeof input.operation !== "string")
                throw new Error("Foreign controller request");
              result = { nonce, value: await request(input.role, input.operation) };
            } catch (cause) {
              result = { nonce, error: String(cause) };
            }
            publish(path.join(root, "responses", name), result);
            fs.unlinkSync(path.join(root, "requests", name));
          })();
          requests.add(task);
          void task.catch((cause) => failures.push(cause)).finally(() => requests.delete(task));
        }
      }, 10);
      return { port: (server.address() as net.AddressInfo).port, nonce, directory: root };
    };
    const close = (): Promise<void> => (closing ??= (async () => {
      if (poll) clearInterval(poll);
      for (const pending of requests) await pending.catch((cause) => failures.push(cause));
      await queue;
      joined = true;
      for (const [role, current] of roles) {
        await current.admission.catch((cause) => failures.push(cause));
        let childRetired = false;
        for (const target of [current.target, current.parent]) {
          let known = false;
          try { known = target !== undefined && await retired(target); }
          catch (cause) { failures.push(cause); }
          if (target === current.target) childRetired = known;
          if (!known) {
            joined = false;
            failures.push(new Error("Original descendant lifetime unresolved: " + role));
          }
        }
        if (childRetired) await current.transport.settled;
        if (current.phase === "held" || current.phase === "enrolling" ||
            (current.phase === "released" && current.completion === undefined))
          failures.push(new Error("Descendant has no completed release phase: " + role));
        if (current.failure !== undefined) failures.push(current.failure);
        try { current.transport.close(); }
        catch (cause) { failures.push(cause); }
      }
      for (const transport of transports) {
        try { transport.close(); }
        catch (cause) { failures.push(cause); }
      }
      await queue;
      if (server) {
        try {
          await new Promise<void>((resolve, reject) =>
            server!.close((error) => error ? reject(error) : resolve()));
        } catch (cause) { failures.push(cause); }
      }
      if (directory) publish(path.join(directory, "closed.json"), { nonce, errors: failures.map(String) });
      if (failures.length) throw new AggregateError(failures, "Descendant controller closure");
    })());
    return { nonce, receive, request, disconnected, listen, close,
      joined: () => joined };
  }
}

type Observer = Awaited<ReturnType<ReturnType<typeof NativeProcessObserver.prepare>["open"]>>;
type Target = Awaited<ReturnType<Observer["acquire"]>>;
interface Transport {
  send(frame: Record<string, unknown>): void;
  close(): void;
  /** Final frame processing, awaited only after independent kernel departure. */
  settled?: Promise<void>;
}
interface Role {
  transport: Transport;
  announcement: Record<string, unknown>;
  phase: "enrolling" | "held" | "released" | "abandoned" | "retired";
  admission: Promise<void>;
  parent?: Target;
  target?: Target;
  completion?: Record<string, unknown>;
  failure?: unknown;
  abrupt?: boolean;
}
interface Controller {
  readonly nonce: string;
  receive(frame: unknown, transport: Transport): Promise<void>;
  request(role: string, operation: string): Promise<unknown>;
  disconnected(transport: Transport): void;
  listen(root: string): Promise<{ port: number; nonce: string; directory: string }>;
  close(): Promise<void>;
  joined(): boolean;
}
function positivePid(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0)
    throw new Error("Invalid held enrollment PID");
  return value;
}
function object(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new Error("Controller frame must be an object");
  return value as Record<string, unknown>;
}
function transportCommand(current: Role, nonce: string, role: string, operation: string): void {
  current.abrupt = operation !== "release";
  current.transport.send({ version: 1, nonce, role, event: "command", operation });
}
function publish(file: string, value: unknown): void {
  fs.writeFileSync(file + ".pending", JSON.stringify(value));
  fs.renameSync(file + ".pending", file);
}

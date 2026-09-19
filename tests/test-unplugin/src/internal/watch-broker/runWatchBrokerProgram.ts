import path from "node:path";

/**
 * Run the watch broker's child program in this process, against watch backends
 * the test drives.
 *
 * The program is the CommonJS text the broker spawns with `node -e`. Here it
 * runs through `new Function`, with `require` answering the modules it loads
 * and a `process` whose IPC channel is two arrays: `receive` delivers a message
 * as the parent would send it, and `sent` records every message the child sends
 * back. `fs.watch` and any other module stand in for the native backends, so a
 * test can fire exactly the event a platform reports, an overflow or a
 * dropped-event flag among them, without having to provoke one.
 *
 * @param source The program, as `watchBrokerSource` returns it.
 * @param modules Replacements by module id, merged over `node:path` and a
 *   `node:os` whose temporary directory is `tmpdir`.
 */
export function runWatchBrokerProgram(
  source: string,
  modules: Record<string, unknown>,
  tmpdir = path.resolve("/tmp"),
): {
  receive(message: object): void;
  sent: Record<string, unknown>[];
} {
  const handlers = new Map<string, ((message: unknown) => void)[]>();
  const sent: Record<string, unknown>[] = [];
  const fakeProcess = {
    exit: () => undefined,
    kill: () => {
      const error = new Error("no such process") as NodeJS.ErrnoException;
      error.code = "ESRCH";
      throw error;
    },
    on: (event: string, handler: (message: unknown) => void) => {
      handlers.set(event, [...(handlers.get(event) ?? []), handler]);
    },
    pid: 1,
    platform: process.platform,
    send: (message: Record<string, unknown>) => {
      sent.push(message);
      return true;
    },
  };
  const all: Record<string, unknown> = {
    "node:os": { tmpdir: () => tmpdir },
    "node:path": path,
    ...modules,
  };
  const require = (id: string): unknown => {
    if (!(id in all)) throw new Error(`Cannot find module '${id}'`);
    return all[id];
  };
  new Function("require", "process", source)(require, fakeProcess);
  return {
    receive: (message) => {
      for (const handler of handlers.get("message") ?? []) handler(message);
    },
    sent,
  };
}

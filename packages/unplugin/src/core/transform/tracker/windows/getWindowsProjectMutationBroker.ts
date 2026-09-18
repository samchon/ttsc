import { spawn } from "node:child_process";

import { WINDOWS_PROJECT_MUTATION_BROKER } from "./WINDOWS_PROJECT_MUTATION_BROKER";
import type { WindowsProjectMutationBroker } from "./WindowsProjectMutationBroker";
import { routeWindowsProjectMutationMessage } from "./routeWindowsProjectMutationMessage";

/**
 * Return the process-wide Windows watch broker, starting it on first use.
 *
 * Node's Windows fs-event backend can hit a native assertion that aborts the
 * whole process when a watched temporary tree is deleted. Every Windows
 * generation tracker therefore lives in one isolated child process: a crash
 * there becomes an ordinary exit that fails the affected trackers, and those
 * generations fall back to proving themselves from recorded state instead of
 * taking the host down. The child is unreferenced between requests, so it never
 * keeps a host alive.
 */
export function getWindowsProjectMutationBroker(): WindowsProjectMutationBroker {
  if (WINDOWS_PROJECT_MUTATION_BROKER.current !== undefined) {
    return WINDOWS_PROJECT_MUTATION_BROKER.current;
  }
  const child = spawn(process.execPath, ["-e", WINDOWS_WATCH_BROKER_SOURCE], {
    stdio: ["ignore", "ignore", "ignore", "ipc"],
    windowsHide: true,
  });
  const broker: WindowsProjectMutationBroker = {
    child,
    drains: new Map(),
    nextId: 1,
    pendingDrains: 0,
    pendingRegistrations: 0,
    trackers: new Map(),
  };
  const fail = (): void => {
    for (const registration of broker.trackers.values()) {
      registration.tracker.failed = true;
      registration.ready();
    }
    broker.trackers.clear();
    // A broker that died answers no round-trip. Release every waiter instead of
    // stalling the deliveries behind them; their trackers are failed now, so
    // validation falls back to proving the generation from its own state.
    for (const release of broker.drains.values()) release();
    broker.drains.clear();
    if (WINDOWS_PROJECT_MUTATION_BROKER.current === broker) {
      WINDOWS_PROJECT_MUTATION_BROKER.current = undefined;
    }
  };
  child.on("error", fail);
  child.on("exit", fail);
  child.on("message", (message: unknown) =>
    routeWindowsProjectMutationMessage(broker, message),
  );
  WINDOWS_PROJECT_MUTATION_BROKER.current = broker;
  return broker;
}

const WINDOWS_WATCH_BROKER_SOURCE = [
  'const fs = require("node:fs");',
  "const groups = new Map();",
  'process.on("message", (message) => {',
  '  if (message.op === "drain") {',
  // Two turns, not one: the first lets the loop poll for watch completions the
  // kernel had already queued, the second answers after their callbacks ran.
  "    setImmediate(() => setImmediate(() => process.send?.({ drained: true, id: message.id })));",
  "    return;",
  "  }",
  '  if (message.op === "remove") {',
  "    close(message.id);",
  "    return;",
  "  }",
  '  if (message.op !== "add") return;',
  "  const watchers = [];",
  "  let failed = false;",
  "  for (const location of message.locations) {",
  "    try {",
  "      const names = location.names === undefined ? undefined : new Set(location.names.map((name) => name.toLowerCase()));",
  "      const watcher = fs.watch(location.directory, { persistent: false, recursive: location.recursive === true }, (event, filename) => {",
  "        const matches = names === undefined || filename === null || names.has(String(filename).toLowerCase());",
  '        if (matches && (message.allEvents || event === "rename" || location.recursive === true)) process.send?.({ directory: location.directory, eventType: event, filename: filename === null ? null : String(filename), id: message.id });',
  "      });",
  '      watcher.on("error", () => process.send?.({ failed: true, id: message.id }));',
  "      watchers.push(watcher);",
  "    } catch {",
  "      failed = true;",
  "    }",
  "  }",
  "  groups.set(message.id, watchers);",
  "  process.send?.({ failed, id: message.id, ready: true });",
  "});",
  'process.on("disconnect", () => {',
  "  for (const id of groups.keys()) close(id);",
  "  process.exit(0);",
  "});",
  "function close(id) {",
  "  for (const watcher of groups.get(id) ?? []) watcher.close();",
  "  groups.delete(id);",
  "}",
].join("\n");

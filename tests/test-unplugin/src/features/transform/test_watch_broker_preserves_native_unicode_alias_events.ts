import assert from "node:assert/strict";
import path from "node:path";

import { watchBrokerSource } from "../../../../../packages/unplugin/src/core/transform/tracker/broker/watchBrokerSource";
import { runWatchBrokerProgram } from "../../internal/watch-broker/runWatchBrokerProgram";

/**
 * Verifies an exact-name broker registration retains uncertain Unicode events.
 *
 * Native directory aliases need not share JavaScript lowercase spellings. The
 * parent must receive uncertain spellings to recheck native metadata. Windows
 * can report an ASCII short name. Without an alias-free naming capability, an
 * ASCII-only registration cannot discard an unmatched native basename either.
 *
 * 1. Register Unicode, ordinary ASCII and long/short-name candidates separately.
 * 2. Deliver Unicode aliases in both directions and Windows short-name events.
 * 3. Check that content-only callbacks do not satisfy rename subscriptions and
 *    that each watch closes exactly once.
 *
 * @evidence contracts/testing.md#behavioral-verification Evaluates actual watchBrokerSource subscriptions. Unicode aliases in both directions reach the parent; Windows long/short spelling events also reach it. Unmatched ASCII rename events reach the parent without an alias-free capability, while a content-only event does not reach a rename subscription. Repeated removal closes each handle exactly once.
 * @evidence contracts/testing.md#independent-expectations Authored composed/decomposed and Kelvin/ASCII pairs model uncertain native spelling. Microsoft's FILE_NOTIFY_INFORMATION contract permits either long or short names, and SetFileShortNameW permits caller-assigned aliases, so Windows unmatched ASCII cannot prove irrelevance. Literal message arrays require this uncertainty to reach native validation without using a production normalizer as oracle.
 * @evidence contracts/testing.md#distinguishing-cases Composed/decomposed and Kelvin/ASCII spellings cover both directions; Windows long/short spelling rows exercise its documented ambiguous event naming. Unicode and ASCII registrations retain unmatched ASCII uncertainty; rename versus content event-kind selection supplies the adjacent negative. This test does not provoke native aliasing or transport.
 * @evidence contracts/testing.md#execution-ownership The test-unplugin runner discovers this exported entry. runWatchBrokerProgram executes authored child text in this process with injected fs.watch listeners and message arrays, without a child process or native watcher. All five registrations are removed in finally. Platform branches use the actual host platform; the test does not create native short names.
 */
export function test_watch_broker_preserves_native_unicode_alias_events(): void {
  const directory = path.resolve("/unicode-project");
  const listeners: ((event: string, filename: string | null) => void)[] = [];
  const closed = [0, 0, 0, 0, 0];
  const broker = runWatchBrokerProgram(watchBrokerSource(), {
    "node:fs": {
      watch: (
        _directory: string,
        _options: object,
        listener: (event: string, filename: string | null) => void,
      ) => {
        const index = listeners.length;
        listeners.push(listener);
        return {
          close: () => {
            closed[index] = closed[index]! + 1;
          },
          on: () => undefined,
        };
      },
    },
  });
  try {
    for (const [index, name] of [
      "\u00e9.config",
      "K.config",
      "\u212a.config",
      "LongConfig.config",
      "LONGCO~1.CON",
    ].entries())
      broker.receive({
        allEvents: false,
        id: index + 1,
        locations: [{ directory, names: [name] }],
        op: "add",
      });
    assert.equal(listeners.length, 5);
    const start = broker.sent.length;
    listeners[1]!("change", "K.config");
    listeners[1]!("rename", "unrelated.config");
    listeners[0]!("rename", "e\u0301.config");
    listeners[1]!("rename", "\u212a.config");
    listeners[2]!("rename", "K.config");
    listeners[0]!("rename", "unrelated.config");
    if (process.platform === "win32") {
      listeners[3]!("rename", "LONGCO~1.CON");
      listeners[4]!("rename", "LongConfig.config");
    }
    assert.deepEqual(broker.sent.slice(start), [
      { directory, eventType: "rename", filename: "unrelated.config", id: 2 },
      { directory, eventType: "rename", filename: "e\u0301.config", id: 1 },
      { directory, eventType: "rename", filename: "\u212a.config", id: 2 },
      { directory, eventType: "rename", filename: "K.config", id: 3 },
      { directory, eventType: "rename", filename: "unrelated.config", id: 1 },
      ...(process.platform === "win32"
        ? [
            { directory, eventType: "rename", filename: "LONGCO~1.CON", id: 4 },
            {
              directory,
              eventType: "rename",
              filename: "LongConfig.config",
              id: 5,
            },
          ]
        : []),
    ]);
  } finally {
    for (const id of [1, 2, 3, 4, 5]) {
      broker.receive({ id, op: "remove" });
      broker.receive({ id, op: "remove" });
    }
  }
  assert.deepEqual(closed, [1, 1, 1, 1, 1]);
}

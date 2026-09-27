import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { type WatchInputChange } from "../../../../../packages/ttsc/lib/launcher/internal/watch/WatchInputChange.js";
import { WatchTopology } from "../../../../../packages/ttsc/lib/launcher/internal/watch/WatchTopology.js";

/**
 * Verifies a named change notification that arrives after a refresh admitted
 * its file is dropped when the file still holds the admitted bytes, and
 * reported when it does not.
 *
 * On Windows the recursive watcher reports a new file's creation and its first
 * write as separate events. The creation refreshed the topology, whose rebuild
 * compiled the file, and the write's `change`, arriving after that rebuild read
 * it, was taken at its word: `ttsc --watch` rebuilt a second time for a change
 * the first rebuild already read (samchon/ttsc#1580). A refresh now
 * acknowledges each file it admits by its content.
 *
 * 1. Resolve a project whose `src` holds one file, with watchers that record their
 *    listeners instead of watching.
 * 2. Create `src/later/value.ts` and deliver the new directory's creation to the
 *    watchers that observe it: the refresh admits the file and reports a
 *    topology change.
 * 3. Deliver a `change` for the same bytes to every watcher that observes the
 *    file, and assert nothing is reported.
 * 4. Write other bytes, deliver a `change` again, and assert it is reported once.
 */
export const test_watch_topology_drops_a_late_notification_for_an_admitted_file =
  async (): Promise<void> => {
    const root = fs.realpathSync.native(
      TestProject.tmpdir("ttsc-watch-late-notification-"),
    );
    fs.mkdirSync(path.join(root, "src"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: { module: "commonjs", noEmit: true, strict: true },
        include: ["src"],
      }),
      "utf8",
    );
    fs.writeFileSync(
      path.join(root, "src", "seed.ts"),
      "export const seed = 1;\n",
      "utf8",
    );

    const watchers: IRecordedWatcher[] = [];
    const originalWatch = fs.watch;
    Object.defineProperty(fs, "watch", {
      configurable: true,
      value: ((location: fs.PathLike, ...rest: unknown[]) => {
        const listener = rest.find(
          (value): value is WatchListener => typeof value === "function",
        );
        const options = rest.find(
          (value): value is { recursive?: boolean } =>
            typeof value === "object" && value !== null,
        );
        const watcher: IRecordedWatcher = {
          close: () => undefined,
          listener: listener ?? (() => undefined),
          location: path.resolve(String(location)),
          on: () => watcher,
          recursive: options?.recursive === true,
        };
        watchers.push(watcher);
        return watcher as unknown as fs.FSWatcher;
      }) as typeof fs.watch,
      writable: true,
    });

    const changes: WatchInputChange[] = [];
    let topologyChanges = 0;
    const topology = new WatchTopology(
      {
        cwd: root,
        files: [],
        projectRoot: root,
        tsconfig: path.join(root, "tsconfig.json"),
      },
      {
        onError: (_location, error) => {
          throw error;
        },
        onInputChange: (change) => changes.push(change),
        onTopologyChange: () => {
          topologyChanges += 1;
        },
      },
    );
    try {
      topology.refresh(false);
      await settle();
      changes.length = 0;
      topologyChanges = 0;

      const value = path.join(root, "src", "later", "value.ts");
      fs.mkdirSync(path.dirname(value));
      fs.writeFileSync(value, "export const value = 1;\n", "utf8");
      deliver(watchers, path.dirname(value), "rename");
      await settle();
      assert.equal(topologyChanges, 1, "the creation did not admit the file");
      assert.deepEqual([...changes], []);

      deliver(watchers, value, "change");
      await settle();
      assert.deepEqual(
        [...changes],
        [],
        "a notification for bytes the refresh admitted was reported",
      );

      fs.writeFileSync(value, "export const value = 2;\n", "utf8");
      deliver(watchers, value, "change");
      await settle();
      assert.deepEqual(
        changes.map((change) => change.path),
        [value],
        "an edit after admission was not reported",
      );
    } finally {
      topology.close();
      Object.defineProperty(fs, "watch", {
        configurable: true,
        value: originalWatch,
        writable: true,
      });
    }
  };

type WatchListener = (event: string, filename: string | null) => void;

interface IRecordedWatcher {
  close(): void;
  listener: WatchListener;
  location: string;
  on(): IRecordedWatcher;
  recursive: boolean;
}

/**
 * Deliver an event for `entry` to every registered watcher that observes it,
 * named as each backend names it: a watcher of the entry itself and a watcher
 * of its parent directory by its base name, and a recursive watcher of an
 * ancestor by its path below that ancestor.
 */
function deliver(
  watchers: readonly IRecordedWatcher[],
  entry: string,
  event: string,
): void {
  let delivered = 0;
  for (const watcher of watchers) {
    const relative = path.relative(watcher.location, entry);
    const observed =
      relative === "" ||
      relative === path.basename(entry) ||
      (watcher.recursive &&
        !relative.startsWith("..") &&
        !path.isAbsolute(relative));
    if (!observed) continue;
    watcher.listener(event, relative === "" ? path.basename(entry) : relative);
    delivered += 1;
  }
  assert.ok(delivered !== 0, `no registered watcher observes ${entry}`);
}

/** Let queued microtasks and timers run once. */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 20));
}

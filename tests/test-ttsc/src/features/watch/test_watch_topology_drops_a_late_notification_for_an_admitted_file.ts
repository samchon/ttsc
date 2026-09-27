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
 * 2. Create `src/later/value.ts` and deliver its creation to the watcher that
 *    covers it: the refresh admits the file and reports a topology change.
 * 3. Deliver a named `change` for the same bytes, and assert nothing is reported.
 * 4. Write other bytes, deliver a named `change` again, and assert it is reported.
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
        const watcher: IRecordedWatcher = {
          close: () => undefined,
          listener: listener ?? (() => undefined),
          location: path.resolve(String(location)),
          on: () => watcher,
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
      deliver(watchers, value, "rename");
      await settle();
      assert.equal(topologyChanges, 1, "the creation did not admit the file");
      assert.deepEqual(changes, []);

      deliver(watchers, value, "change");
      await settle();
      assert.deepEqual(
        changes,
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
}

/**
 * Deliver an event for `file` to the nearest registered directory watcher that
 * covers it, naming the file relative to that directory, as a directory watcher
 * names what changed below it.
 */
function deliver(
  watchers: readonly IRecordedWatcher[],
  file: string,
  event: string,
): void {
  const covering = watchers
    .filter((watcher) => {
      const relative = path.relative(watcher.location, file);
      return (
        relative !== "" &&
        !relative.startsWith("..") &&
        !path.isAbsolute(relative)
      );
    })
    .sort((left, right) => right.location.length - left.location.length)[0];
  assert.ok(covering, `no registered watcher covers ${file}`);
  covering.listener(event, path.relative(covering.location, file));
}

/** Let queued microtasks and timers run once. */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 20));
}

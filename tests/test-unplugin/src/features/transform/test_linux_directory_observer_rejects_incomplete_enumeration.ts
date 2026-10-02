import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import type { ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { LINUX_DIRECTORY_WATCHES } from "../../../../../packages/unplugin/src/core/transform/tracker/linux/LINUX_DIRECTORY_WATCHES";
import { LINUX_WATCH_HELPER } from "../../../../../packages/unplugin/src/core/transform/tracker/linux/LINUX_WATCH_HELPER";
import type { LinuxWatchHelper } from "../../../../../packages/unplugin/src/core/transform/tracker/linux/LinuxWatchHelper";
import { openLinuxDirectoryObserver } from "../../../../../packages/unplugin/src/core/transform/tracker/linux/openLinuxDirectoryObserver";
import { routeLinuxWatchHelperLine } from "../../../../../packages/unplugin/src/core/transform/tracker/linux/routeLinuxWatchHelperLine";

/**
 * Requires directory enumeration as well as acknowledged watches before an
 * observer can claim recursive coverage. Initial root and child enumeration
 * errors refuse readiness; an error while revisiting an already watched child
 * withdraws coverage through onError after initial readiness has completed.
 *
 * The helper answers are authored. Real directories supply Dirents, while one
 * selected readdirSync call throws EIO. Healthy enumeration opens one watch per
 * directory, delivers a nested file event and releases every watch on close.
 * This does not reproduce an inotify error or measure native delivery timing.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls openLinuxDirectoryObserver and routes actual helper replies. Asserts healthy readiness, directory-only subscriptions, nested delivery, initial root/child enumeration refusal, widened subtree error and exact removal on close.
 * @evidence contracts/testing.md#independent-expectations A watch acknowledgment cannot establish which child directories an unreadable listing contains. Literal false readiness and one coverage error follow that missing proof; healthy literal paths and event names come from the authored tree, not observer state.
 * @evidence contracts/testing.md#distinguishing-cases Separates healthy enumeration, root versus child EIO during opening and EIO when wider admission revisits an existing child. Later failure uses onError rather than pretending a previously resolved readiness promise can change. Each row closes twice to distinguish idempotent release and restores both shared descriptors in finally.
 * @evidence contracts/testing.md#execution-ownership Unit test: directly exercises the observer, shared directory subscription and protocol router with a scripted LinuxWatchHelper and native temporary directories. The exported body forwards readdirSync except one exact selected directory, restoring its descriptor and the prior helper. No Linux helper process, inotify watch, compiler or host runs.
 */
export async function test_linux_directory_observer_rejects_incomplete_enumeration(): Promise<void> {
  for (const row of ["healthy", "root", "child", "widened"] as const) {
    const root = path.resolve(TestProject.tmpdir("ttsc-linux-enumeration-"));
    const nested = path.join(root, "nested");
    const deep = path.join(nested, "deep");
    fs.mkdirSync(deep, { recursive: true });
    fs.writeFileSync(path.join(deep, "input.ts"), "export {};\n");
    const priorHelper = LINUX_WATCH_HELPER.current;
    const descriptor = Object.getOwnPropertyDescriptor(fs, "readdirSync")!;
    const originalRead = fs.readdirSync;
    const sent: { id: number; op: string; path?: string }[] = [];
    const quiet = { ref: () => undefined, unref: () => undefined };
    const helper: LinuxWatchHelper = {
      answered: false,
      child: {
        ...quiet,
        stdin: {
          destroyed: false,
          writable: true,
          write: (line: string) => {
            sent.push(JSON.parse(line) as (typeof sent)[number]);
            return true;
          },
        },
        stdout: quiet,
      } as unknown as ChildProcess,
      nextId: 1,
      pending: 0,
      subscriptions: new Map(),
      syncs: new Map(),
    };
    const route = (line: object): void =>
      routeLinuxWatchHelperLine(helper, JSON.stringify(line));
    const turn = (): Promise<void> =>
      new Promise((resolve) => setImmediate(resolve));
    const heard: [string, string | null][] = [];
    let errors = 0;
    let expanded = row !== "widened";
    let unreadable = row === "root" ? root : row === "child" ? nested : undefined;
    const failedReads: string[] = [];
    let observer: ReturnType<typeof openLinuxDirectoryObserver> | undefined;
    LINUX_WATCH_HELPER.current = helper;
    try {
      Object.defineProperty(fs, "readdirSync", {
        ...descriptor,
        value: (...args: Parameters<typeof fs.readdirSync>) => {
          if (typeof args[0] === "string" && path.resolve(args[0]) === unreadable) {
            failedReads.push(path.resolve(args[0]));
            throw Object.assign(new Error("authored enumeration failure"), {
              code: "EIO",
            });
          }
          return Reflect.apply(originalRead, fs, args);
        },
      });
      observer = openLinuxDirectoryObserver(
        root,
        (directory) => expanded || directory !== deep,
        (type, filename) => heard.push([type, filename]),
        () => {
          errors += 1;
        },
      );
      assert.deepEqual(sent.splice(0), [{ id: 1, op: "add", path: root }], row);
      route({ id: 1, ready: true });
      await turn();
      if (row !== "root") {
        assert.deepEqual(sent.splice(0), [{ id: 2, op: "add", path: nested }], row);
        route({ id: 2, ready: true });
        await turn();
      }
      if (row === "healthy") {
        assert.deepEqual(sent.splice(0), [{ id: 3, op: "add", path: deep }]);
        route({ id: 3, ready: true });
        await turn();
      }
      assert.deepEqual(sent, [], "no file watches or duplicate directory opens");
      assert.equal(
        await observer.ready,
        row === "healthy" || row === "widened",
        row,
      );
      assert.equal(errors, row === "root" || row === "child" ? 1 : 0, row);
      assert.deepEqual(heard, [], "initial enumeration does not invent mutations");
      if (row === "healthy") {
        route({ id: 3, type: "change", name: "input.ts" });
        assert.deepEqual(heard.splice(0), [
          ["change", path.join("nested", "deep", "input.ts")],
        ]);
        observer.track(root, true);
        await turn();
        assert.deepEqual(sent, [], "revisiting live directories reuses their watches");
        assert.equal(errors, 0);
        assert.deepEqual(failedReads, []);
      } else if (row === "widened") {
        expanded = true;
        unreadable = nested;
        observer.track(root, true);
        await turn();
        assert.equal(errors, 1, "failed widening withdraws recursive coverage");
        assert.deepEqual(failedReads, [nested]);
        assert.deepEqual(sent, [], "unread descendants cannot acquire guessed watches");
        assert.deepEqual(heard, [], "failed widening is not a successful opening batch");
      } else {
        assert.deepEqual(failedReads, [row === "root" ? root : nested]);
      }
      observer.close();
      observer.close();
      assert.deepEqual(
        sent.splice(0),
        row === "root"
          ? [{ id: 1, op: "remove" }]
          : row === "healthy"
            ? [
                { id: 1, op: "remove" },
                { id: 2, op: "remove" },
                { id: 3, op: "remove" },
              ]
            : [{ id: 1, op: "remove" }, { id: 2, op: "remove" }],
        row,
      );
      assert.deepEqual(
        [root, nested, deep].map((directory) =>
          LINUX_DIRECTORY_WATCHES.has(directory),
        ),
        [false, false, false],
        "closing retires all owned directory entries",
      );
    } finally {
      observer?.close();
      Object.defineProperty(fs, "readdirSync", descriptor);
      LINUX_WATCH_HELPER.current = priorHelper;
    }
  }
}

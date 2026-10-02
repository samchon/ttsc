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
 * Named rename topology errors EIO/EACCES also withdraw coverage instead of
 * treating unknown metadata as deletion; actual subtree deletion retires its
 * watches without a coverage error. A backend gone line does not turn failed
 * presence inspection into known absence: its own watch is already retired,
 * while inaccessible descendants remain owned until the caller closes.
 *
 * The helper answers are authored. Real directories supply Dirents, while one
 * selected readdirSync call throws EIO. Healthy enumeration opens one watch per
 * directory, delivers a nested file event and releases every watch on close.
 * This does not reproduce an inotify error or measure native delivery timing.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls openLinuxDirectoryObserver and routes actual helper replies. Asserts healthy readiness, directory-only subscriptions, nested delivery, initial root/child enumeration refusal, widened subtree error, named and backend topology uncertainty versus confirmed deletion and exact removal on close.
 * @evidence contracts/testing.md#independent-expectations A watch acknowledgment cannot establish which child directories an unreadable listing contains. Literal false readiness and one coverage error follow that missing proof. EIO/EACCES cannot establish absence, while deleting the actual child establishes subtree retirement; healthy literal paths and event names come from the authored tree, not observer state.
 * @evidence contracts/testing.md#distinguishing-cases Separates healthy enumeration, root versus child EIO during opening and EIO when wider admission revisits an existing child, plus named rename and backend gone EIO/EACCES versus native ENOENT after actual deletion. A backend gone line retires only its own subscription before the observer classifies presence. Later failure uses onError rather than pretending a previously resolved readiness promise can change. Each row closes twice to distinguish idempotent release and restores both shared descriptors in finally.
 * @evidence contracts/testing.md#execution-ownership Unit test: directly exercises the observer, shared directory subscription and protocol router with a scripted LinuxWatchHelper and native temporary directories. The exported body forwards readdirSync/lstatSync/existsSync except the selected exact directory and failure phase, restoring all descriptors and the prior helper. No Linux helper process, inotify watch, compiler or host runs.
 */
export async function test_linux_directory_observer_rejects_incomplete_enumeration(): Promise<void> {
  for (const row of [
    "healthy",
    "root",
    "child",
    "widened",
    "rename-eio",
    "rename-eacces",
    "deleted",
    "backend-eio",
    "backend-eacces",
    "backend-deleted",
  ] as const) {
    const root = path.resolve(TestProject.tmpdir("ttsc-linux-enumeration-"));
    const nested = path.join(root, "nested");
    const deep = path.join(nested, "deep");
    fs.mkdirSync(deep, { recursive: true });
    fs.writeFileSync(path.join(deep, "input.ts"), "export {};\n");
    assert.equal(fs.existsSync(nested), true);
    const priorHelper = LINUX_WATCH_HELPER.current;
    const descriptor = Object.getOwnPropertyDescriptor(fs, "readdirSync")!;
    const originalRead = fs.readdirSync;
    const lstatDescriptor = Object.getOwnPropertyDescriptor(fs, "lstatSync")!;
    const originalLstat = fs.lstatSync;
    const existsDescriptor = Object.getOwnPropertyDescriptor(fs, "existsSync")!;
    const originalExists = fs.existsSync;
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
    const failedLstats: string[] = [];
    let lstatError: "EIO" | "EACCES" | undefined;
    let inaccessible = false;
    const fullTree = row !== "root" && row !== "child" && row !== "widened";
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
      Object.defineProperty(fs, "lstatSync", {
        ...lstatDescriptor,
        value: (...args: Parameters<typeof fs.lstatSync>) => {
          if (lstatError !== undefined && args[0] === nested) {
            failedLstats.push(nested);
            throw Object.assign(new Error("authored topology uncertainty"), {
              code: lstatError,
            });
          }
          return Reflect.apply(originalLstat, fs, args);
        },
      });
      Object.defineProperty(fs, "existsSync", {
        ...existsDescriptor,
        value: (...args: Parameters<typeof fs.existsSync>) =>
          inaccessible && args[0] === nested
            ? false
            : Reflect.apply(originalExists, fs, args),
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
      if (fullTree) {
        assert.deepEqual(sent.splice(0), [{ id: 3, op: "add", path: deep }]);
        route({ id: 3, ready: true });
        await turn();
      }
      assert.deepEqual(sent, [], "no file watches or duplicate directory opens");
      assert.equal(
        await observer.ready,
        row !== "root" && row !== "child",
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
      } else if (row === "rename-eio" || row === "rename-eacces") {
        lstatError = row === "rename-eio" ? "EIO" : "EACCES";
        route({ id: 1, type: "rename", name: "nested" });
        assert.equal(errors, 1, "unresolved named topology withdraws coverage");
        assert.deepEqual(failedLstats, [nested]);
        assert.deepEqual(failedReads, []);
        assert.deepEqual(sent, [], "unknown topology is not evidence of deletion");
      } else if (row === "backend-eio" || row === "backend-eacces") {
        lstatError = row === "backend-eio" ? "EIO" : "EACCES";
        inaccessible = true;
        route({ id: 2, gone: true });
        assert.equal(errors, 1, "backend loss with unknown presence withdraws coverage");
        assert.deepEqual(failedLstats, [nested]);
        assert.deepEqual(sent, [], "backend loss does not prove descendant deletion");
        assert.equal(LINUX_DIRECTORY_WATCHES.has(nested), false);
        assert.equal(LINUX_DIRECTORY_WATCHES.has(deep), true);
      } else if (row === "backend-deleted") {
        fs.rmSync(nested, { recursive: true, force: true });
        assert.equal(fs.existsSync(nested), false);
        route({ id: 2, gone: true });
        assert.equal(errors, 0, "confirmed backend absence retires the subtree");
        assert.deepEqual(failedLstats, []);
        assert.deepEqual(sent.splice(0), [{ id: 3, op: "remove" }]);
        assert.equal(LINUX_DIRECTORY_WATCHES.has(nested), false);
        assert.equal(LINUX_DIRECTORY_WATCHES.has(deep), false);
      } else if (row === "deleted") {
        fs.rmSync(nested, { recursive: true, force: true });
        assert.equal(fs.existsSync(nested), false);
        route({ id: 1, type: "rename", name: "nested" });
        assert.equal(errors, 0, "confirmed absence retires only the missing subtree");
        assert.deepEqual(failedLstats, []);
        assert.deepEqual(sent.splice(0), [
          { id: 2, op: "remove" },
          { id: 3, op: "remove" },
        ]);
        assert.deepEqual(heard, [["rename", "nested"]]);
      } else {
        assert.deepEqual(failedReads, [row === "root" ? root : nested]);
      }
      observer.close();
      observer.close();
      assert.deepEqual(
        sent.splice(0),
        row === "root" || row === "deleted" || row === "backend-deleted"
          ? [{ id: 1, op: "remove" }]
          : row === "backend-eio" || row === "backend-eacces"
            ? [{ id: 1, op: "remove" }, { id: 3, op: "remove" }]
            : fullTree
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
      Object.defineProperty(fs, "lstatSync", lstatDescriptor);
      Object.defineProperty(fs, "existsSync", existsDescriptor);
      LINUX_WATCH_HELPER.current = priorHelper;
    }
  }
}

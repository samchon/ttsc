import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createInputObserver } from "../../../../../packages/unplugin/src/core/observer/createInputObserver";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Large native waves yield to host turns without dropping late conditions.
 *
 * The real final file changes under an alias-named event. During the first
 * yield a second event changes an already visited input, so a later wave must
 * recheck it. A separate observer is disposed in that yield and must emit no
 * late report, including when its retired poll callback is invoked.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual observer registrations and real changed bytes produce one callback per wave. A timer must run before the final condition reports, and an event during that timer must independently report its earlier condition; disposal cancels the unfinished wave.
 * @evidence contracts/testing.md#independent-expectations Authored first/last files and separate owner names define literal reload lists. A native timer's progress is observed independently of the observer, and no assertion depends on its chunk quota or elapsed speed.
 * @evidence contracts/testing.md#distinguishing-cases The large unchanged prefix contrasts with the changed final condition, then a newly changed already-visited input distinguishes preserving next-wave events from clearing them. Disposal before the last chunk and a stale poll callback contrast with the live observer's eventual reports.
 * @evidence contracts/testing.md#execution-ownership This source unit invokes createInputObserver over temporary native files through supported watch/poll capabilities. It creates no real native watcher, host, compiler or producer; finally awaits both disposals and joins its timer work.
 */
export async function test_input_observer_yields_without_losing_conditions(): Promise<void> {
  const root = TestProject.createProject(
    Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`input-${i}.ts`, "before"])),
  );
  const files = Array.from({ length: 200 }, (_, i) => path.join(root, `input-${i}.ts`));
  const reports: string[][] = [];
  let emit!: (event: string, file: string | null) => void;
  let yielded = false;
  let finished!: () => void;
  const done = new Promise<void>((resolve) => { finished = resolve; });
  const firstOwner = path.join(root, "first-owner");
  const lastOwner = path.join(root, "last-owner");
  const aliasOwner = path.join(root, "alias-owner");
  fs.mkdirSync(path.join(root, "left"));
  fs.mkdirSync(path.join(root, "right"));
  fs.writeFileSync(path.join(root, "left/input.ts"), "same");
  fs.writeFileSync(path.join(root, "right/input.ts"), "same");
  const link = path.join(root, "linked");
  const linkKind = process.platform === "win32" ? "junction" : "dir";
  fs.symlinkSync(path.join(root, "left"), link, linkKind);
  const observer = createInputObserver(({ reload }) => {
    assert.equal(yielded, true, "a host turn precedes the late condition's report");
    reports.push([...reload]);
    if (reports.length === 2) finished();
  }, {
    caseSensitive: () => true,
    poll: () => ({ close: () => undefined }),
    watch: (_root, listener) => { emit = listener; return { close: () => undefined }; },
  });
  let deadline: NodeJS.Timeout | undefined;
  try {
    observer.open(root, false);
    observer.replace(firstOwner, [{ file: files[0]! }], false, observer.begin());
    observer.replace(lastOwner, files.slice(1).map((file) => ({ file })), false, observer.begin());
    observer.replace(aliasOwner, [{ file: path.join(link, "input.ts") }], false, observer.begin());
    fs.writeFileSync(files.at(-1)!, "after");
    emit("change", path.join(root, "NATIVE~1.TS"));
    const turn = new Promise<void>((resolve) => setTimeout(() => {
      yielded = true;
      fs.unlinkSync(link);
      fs.symlinkSync(path.join(root, "right"), link, linkKind);
      fs.writeFileSync(files[0]!, "after");
      emit("change", path.join(root, "OTHER~1.TS"));
      resolve();
    }, 0));
    await Promise.race([
      done,
      new Promise<never>((_resolve, reject) => {
        deadline = setTimeout(() => reject(new Error("observer waves did not settle")), 3_000);
      }),
    ]);
    await turn;
    assert.deepEqual(reports, [[lastOwner, aliasOwner], [firstOwner]]);
  } finally {
    clearTimeout(deadline);
    await observer.dispose();
  }

  let disposedReports = 0;
  let retiredPoll: (() => void) | undefined;
  const disposed = createInputObserver(() => { ++disposedReports; }, {
    caseSensitive: () => true,
    poll: (listener) => { retiredPoll = listener; return { close: () => undefined }; },
    watch: (_root, listener) => { emit = listener; return { close: () => undefined }; },
  });
  try {
    disposed.open(root, false);
    disposed.replace(lastOwner, files.map((file) => ({ file })), false, disposed.begin());
    fs.writeFileSync(files.at(-1)!, "disposed-change");
    emit("change", path.join(root, "DISPOSE~1.TS"));
    await new Promise<void>((resolve) => setTimeout(() => {
      disposed.open(root, true);
      void disposed.dispose().then(resolve);
    }, 0));
    assert.ok(retiredPoll);
    retiredPoll();
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(disposedReports, 0, "dispose cancels remaining chunks and stale poll callbacks");
  } finally {
    await disposed.dispose();
  }
}

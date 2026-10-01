import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createViteServeInputWatch } from "../../../../../packages/unplugin/src/core/vite/createViteServeInputWatch";

/**
 * Verifies the Vite serve watcher notices an external scope whose root was
 * replaced, although the replacement produced no event (samchon/ttsc#1384).
 *
 * An inotify watch follows the directory it opened on, and FSEvents does not
 * report a watched root that moves, so replacing an external scope's root, or
 * any ancestor of it, leaves the observer on the old directory while every
 * input in the new one goes unheard. The bounded poll re-checks each external
 * root's device and file id once per tick, and a mismatch hands the scope's
 * entries to the poll, which compares them at once.
 *
 * 1. Register an input outside the project through a watch seam that never reports
 *    anything, and take the shared poll.
 * 2. Tick once with the external root untouched and assert nothing is invalidated.
 * 3. Replace the external root with a copy whose input differs, tick, and assert
 *    the importer is invalidated.
 * @evidence contracts/testing.md#behavioral-verification
 *   Registers an external declaration, checks an unchanged poll is quiet, replaces its directory with changed declaration bytes and requires the importer to invalidate at the next poll.
 * @evidence contracts/testing.md#independent-expectations
 *   A scope rooted at the old directory cannot witness the replacement. Literal quiet then one-importer results require the poll to detect actual root identity and input changes.
 * @evidence contracts/testing.md#distinguishing-cases
 *   Contrasts the unchanged external scope with a same-spelled replacement directory containing different bytes; no event is emitted, so retaining the old scope proof fails.
 * @evidence contracts/testing.md#execution-ownership
 *   test_vite_compiler_watch_withdraws_a_replaced_external_scope calls createViteServeInputWatch.attach/replace and captured poll before/after a real temporary external-directory replacement; this entry owns importer invalidation and finally disposal, not a native notification backend.
 */
export async function test_vite_compiler_watch_withdraws_a_replaced_external_scope(): Promise<void> {
  const base = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-vite-watch-replaced-scope-"),
  );
  const root = path.join(base, "project");
  const external = path.join(base, "external");
  fs.mkdirSync(root);
  fs.mkdirSync(external);
  const input = path.join(external, "shared.d.ts");
  fs.writeFileSync(input, "export declare const shared: 1;\n");
  const invalidated = new Set<string>();
  let poll: (() => void) | undefined;
  const watch = createViteServeInputWatch({
    poll(listener) {
      poll = listener;
      return { close: () => (poll = undefined) };
    },
    watch: () => ({ close: () => undefined }),
  });
  const importer = path.join(root, "main.ts").replace(/\\/g, "/");
  watch.attach({
    config: { root },
    moduleGraph: {
      getModulesByFile: (file) =>
        file === importer ? new Set([{ file }]) : undefined,
      invalidateModule: (node) =>
        invalidated.add((node as { file: string }).file),
    },
  });
  try {
    watch.replace(importer, [{ file: input }]);
    assert.ok(poll, "an external scope must keep the shared poll open");
    poll();
    assert.equal(invalidated.size, 0, "an unchanged root must hold");

    await TestProject.rename(external, `${external}-old`);
    fs.mkdirSync(external);
    fs.writeFileSync(input, "export declare const shared: 2;\n");
    poll();
    assert.deepEqual(
      [...invalidated],
      [importer],
      "a replaced external root must hand its inputs to the poll at once",
    );
  } finally {
    await watch.dispose();
  }
}

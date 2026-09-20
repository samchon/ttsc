import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createViteServeInputWatch } from "../../../../../packages/unplugin/lib/core/vite/createViteServeInputWatch.js";

/**
 * Verifies the Vite serve watcher places an input spelled physically in the
 * project scope of a root named through a link, and hears it under the root's
 * own name (samchon/ttsc#1459).
 *
 * Vite's resolver spells a module physically, after every link, while the
 * server names its root as configured: through the temporary directory's link
 * on macOS, or a linked workspace anywhere. Compared by spelling, no input of
 * such a project was the project's: each opened an external scope of its own,
 * up to the bound, and the rest were polled, while an event the project scope
 * reported under the root's name matched no entry.
 *
 * 1. Link a project, attach the watcher on the link, and register an input under
 *    the physical directory through a watch seam that records each scope it
 *    opens.
 * 2. Assert only the project scope was opened, on the link, and that an event for
 *    the input under the link's name invalidates the importer.
 */
export async function test_vite_compiler_watch_hears_a_physical_input_under_a_linked_root(): Promise<void> {
  const physical = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-vite-watch-linked-root-"),
  );
  const linked = path.join(TestProject.tmpdir("ttsc-link-"), "project");
  fs.symlinkSync(
    physical,
    linked,
    process.platform === "win32" ? "junction" : "dir",
  );
  fs.mkdirSync(path.join(physical, "src"));
  const input = path.join(physical, "src", "types.d.ts");
  fs.writeFileSync(input, "export declare const shared: 1;\n");
  const opened: string[] = [];
  const invalidated: string[] = [];
  let emit: ((eventType: string, file: string) => void) | undefined;
  const watch = createViteServeInputWatch({
    poll: () => ({ close: () => undefined }),
    watch: (scope, listener) => {
      opened.push(path.resolve(scope));
      emit ??= listener;
      return { close: () => undefined };
    },
  });
  const importer = path.join(linked, "src", "main.ts").replace(/\\/g, "/");
  watch.attach({
    config: { root: linked },
    moduleGraph: {
      getModulesByFile: (file) =>
        file === importer ? new Set([{ file }]) : undefined,
      invalidateModule: (node) =>
        invalidated.push((node as { file: string }).file),
    },
  });
  try {
    watch.replace(importer, [{ file: input }]);
    assert.deepEqual(
      opened,
      [path.resolve(linked)],
      "the physical input joins the project scope on the link, opening no other",
    );
    fs.writeFileSync(input, "export declare const shared: 2;\n");
    emit?.("change", path.join(linked, "src", "types.d.ts"));
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.deepEqual(
      invalidated,
      [importer],
      "an event under the link's name reaches the physical input's importer",
    );
  } finally {
    await watch.dispose();
  }
}

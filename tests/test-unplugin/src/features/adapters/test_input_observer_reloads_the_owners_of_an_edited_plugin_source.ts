import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createInputObserver } from "../../../../../packages/unplugin/lib/core/observer/createInputObserver.js";
import { pluginSourceState } from "../../../../../packages/unplugin/lib/core/transform/inputs/pluginSourceState.js";
import type { TtscWatchInput } from "../../../../../packages/unplugin/lib/core/transform/watch/TtscWatchInput.js";

/**
 * Verifies the input observer hears a plugin's Go source as a whole subtree,
 * and reloads its owners exactly when the source's digest moves
 * (samchon/ttsc#1487).
 *
 * A watching session, the Vite dev server or a build host's bridge, observes
 * what each generation depended on. A plugin's source is one directory whose
 * digest any file below it can move, which no event on the directory itself
 * reports; and the directories the plugin build passes over, a nested
 * `node_modules` or a repository's `.git`, can change without moving it.
 *
 * 1. Register an owner of a plugin source directory, and assert an unchanged
 *    source is quiet.
 * 2. Write below its `node_modules` and `.git`, and assert nothing is reported.
 * 3. Edit a Go file two levels below the directory, and assert the owner is
 *    reloaded.
 * 4. Register the new digest, add a Go file, and assert the owner is reloaded
 *    again.
 */
export async function test_input_observer_reloads_the_owners_of_an_edited_plugin_source(): Promise<void> {
  const root = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-input-observer-plugin-source-"),
  );
  TestProject.writeFiles(root, {
    "plugin/go.mod": "module example.com/plugin\n\ngo 1.26\n",
    "plugin/main.go": "package main\n\nfunc main() {}\n",
    "plugin/internal/rules/rule.go": "package rules\n",
  });
  const source = path.join(root, "plugin");
  const owner = path.join(root, "owner");
  const input = (): TtscWatchInput => ({
    evidence: {
      identity: source,
      missing: false,
      state: { codec: "tree", digest: pluginSourceState(source)! },
    },
    file: source,
  });
  const reports: string[][] = [];
  let emit: ((eventType: string, file: string | null) => void) | undefined;
  const observer = createInputObserver(
    ({ reload }) => reports.push([...reload]),
    {
      poll: () => ({ close: () => undefined }),
      watch: (_scope, listener) => {
        emit = listener;
        return { close: () => undefined };
      },
    },
  );
  /** Let the observer's flush run, then take what it reported. */
  const settled = async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
    return reports.splice(0);
  };
  try {
    observer.open(root, false);
    observer.replace(owner, [input()]);
    assert.deepEqual(await settled(), [], "an unchanged source is quiet");

    for (const pruned of ["node_modules", ".git"]) {
      const written = path.join(source, pruned, "ignored.go");
      fs.mkdirSync(path.dirname(written), { recursive: true });
      fs.writeFileSync(written, "package x\n");
      emit?.("rename", written);
    }
    assert.deepEqual(await settled(), [], "a pruned write is quiet");

    const rule = path.join(source, "internal", "rules", "rule.go");
    fs.appendFileSync(rule, "// edited\n");
    emit?.("change", rule);
    assert.deepEqual(await settled(), [[owner]], "an edit reloads the owner");

    observer.replace(owner, [input()]);
    assert.deepEqual(await settled(), []);
    const added = path.join(source, "extra.go");
    fs.writeFileSync(added, "package main\n");
    emit?.("rename", added);
    assert.deepEqual(await settled(), [[owner]], "a new file reloads it too");
  } finally {
    await observer.dispose();
  }
}

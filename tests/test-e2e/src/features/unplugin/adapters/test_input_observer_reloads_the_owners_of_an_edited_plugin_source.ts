import { TestProject } from "../../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createInputObserver } from "../../../../../../packages/unplugin/src/core/observer/createInputObserver";
import { pluginSourceState } from "../../../../../../packages/unplugin/src/core/transform/inputs/pluginSourceState";
import type { TtscWatchInput } from "../../../../../../packages/unplugin/src/core/transform/watch/TtscWatchInput";

/**
 * Verifies the input observer hears a plugin's Go source as a whole subtree,
 * and reloads its owners exactly when the source's state moves
 * (samchon/ttsc#1487).
 *
 * A watching session, the Vite dev server or a build host's bridge, observes
 * what each generation depended on. A plugin's source is one directory whose
 * state any file below it can move, which no event on the directory itself
 * reports; and the directories the plugin build passes over, a nested
 * `node_modules` or a repository's `.git`, can change without moving it.
 *
 * 1. Register an owner of a plugin source directory, and assert an unchanged
 *    source is quiet.
 * 2. Write below its `node_modules` and `.git`, and assert nothing is reported.
 * 3. Edit a Go file two levels below the directory, and assert the owner is
 *    reloaded.
 * 4. Register the new state, add a Go file, and assert the owner is reloaded
 *    again.
 * @evidence contracts/testing.md#behavioral-verification
 *   Authored createInputObserver observes a source-tree proof; fixture edits and injected notifications assert nested Go edits and additions reload the owner while unchanged and pruned directories remain quiet.
 * @evidence contracts/testing.md#independent-expectations
 *   Build-source identity includes authored source files and excludes node_modules and .git. Literal quiet/report expectations follow that ownership contract; no source is built as a binary.
 * @evidence contracts/testing.md#distinguishing-cases
 *   Covers unchanged state, pruned writes, nested existing-file edits, re-registration and a newly created Go file.
 * @evidence contracts/testing.md#execution-ownership
 *   test_input_observer_reloads_the_owners_of_an_edited_plugin_source owns createInputObserver.open/replace and the captured watch listener for each pruned/edit/addition row; actual pluginSourceState/holds reads fixture source plus go env/go version and GOROOT toolchain identity; observer disposal is in finally and no native artifact is built.
 *
 * @evidence contracts/e2e.md#necessary-boundary The observer must interpret actual Go-source proofs produced under the available Go toolchain and reload only owners of changed selected inputs. Direct digest composition cannot establish this Go provider connection; the original actual source/environment assertions remain here.
 * @evidence contracts/e2e.md#shared-execution The static Go baseline is shared with metadata and rollback proofs, then copied into this private module before mutation. All edits share that copy and one Node process with the installed Go toolchain; unchanged environment observations reuse the provider reading, and no plugin binary or consumer installation is prepared.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity TestProject owns the private copied fixture root and observer disposal remains in finally. Each selected source mutation gets its original fresh proof; the entry changes no process environment and never writes the shared baseline.
 * @evidence contracts/e2e.md#preserved-coverage The common baseline retains all three original files byte for byte. Every original edit, literal assertion, negative control and cleanup statement remains in this entry; source proof identities stay private to its copied tree.
 */
export async function test_input_observer_reloads_the_owners_of_an_edited_plugin_source(): Promise<void> {
  const root = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-input-observer-plugin-source-"),
  );
  const source = path.join(root, "plugin");
  TestProject.copyDirectory(
    path.join(TestProject.WORKSPACE_ROOT, "packages/unplugin/test/fixtures/plugin-source-baseline"),
    source,
  );
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

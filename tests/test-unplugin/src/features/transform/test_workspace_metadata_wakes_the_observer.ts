import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { PluginBuildEnvironmentWitness } from "ttsc/plugin-source";

import { createInputObserver } from "../../../../../packages/unplugin/src/core/observer/createInputObserver";
import { watchInputEvidenceMatchesDisk } from "../../../../../packages/unplugin/src/core/transform/watch/watchInputEvidenceMatchesDisk";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies that Go workspace metadata retains mode, directory membership and
 * exact POSIX path changes when delivered to the live observer.
 *
 * 1. Compare a file before and after a mode-only change.
 * 2. Check a directory observer after a child appears.
 * 3. On POSIX, retain parent traversal after an alias and poll its retarget.
 * 4. Poll a representable ancestor after changing a raw filename where supported.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the native witness and adapter disk proof for mode, then the production observer for directory, alias and raw changes.
 * @evidence contracts/testing.md#independent-expectations Fixture operations change permissions, add a file, retarget a link where lexical normalization reaches a different parent, or replace raw file bytes.
 * @evidence contracts/testing.md#distinguishing-cases Stable registrations stay quiet. A directory event reports membership change, and polling detects both an alias retarget and a changed raw file without an event.
 * @evidence contracts/testing.md#execution-ownership Uses real temporary filesystem inputs, injected event/poll delivery and the real observer. Closes the observer, restores file accessibility, and unlinks raw filenames by bytes. Darwin EILSEQ skips only the raw filename case.
 */
export async function test_workspace_metadata_wakes_the_observer(): Promise<void> {
  const root = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-workspace-proof-"),
  );
  const sdk = path.join(root, "sdk");
  const file = path.join(sdk, "go");
  fs.mkdirSync(sdk);
  fs.writeFileSync(file, "one");
  const mode = new Map<string, string>();
  PluginBuildEnvironmentWitness.add(mode, file);
  const evidence = {
    identity: file,
    missing: false,
    workspace: { entries: [...mode] },
  };
  assert.equal(watchInputEvidenceMatchesDisk(file, evidence), true);
  fs.chmodSync(file, 0o444);
  try {
    assert.equal(watchInputEvidenceMatchesDisk(file, evidence), false);
  } finally {
    fs.chmodSync(file, 0o600);
  }

  const loads: string[] = [];
  let poll: (() => void) | undefined;
  const watchers = new Map<
    string,
    (event: string, file: string | null) => void
  >();
  const observer = createInputObserver(({ reload }) => loads.push(...reload), {
    poll: (listener) => {
      poll = listener;
      return { close: () => void (poll = undefined) };
    },
    watch: (scope, listener) => {
      watchers.set(scope, listener);
      return { close: () => void watchers.delete(scope) };
    },
  });
  const module = path.join(root, "main.ts");
  const register = (witness: PluginBuildEnvironmentWitness.Record) => {
    observer.replace(
      module,
      Object.entries(
        PluginBuildEnvironmentWitness.watchInputs([witness], root),
      ).map(([anchor, group]) => ({
        file: anchor,
        evidence: {
          identity: anchor,
          missing: false,
          workspace: group,
        },
      })),
    );
  };
  try {
    observer.open(root, false);
    const directory = new Map<string, string>();
    PluginBuildEnvironmentWitness.add(directory, sdk);
    register(directory);
    assert.deepEqual(loads, []);
    const added = path.join(sdk, "new.go");
    fs.writeFileSync(added, "package sdk");
    for (const listener of watchers.values()) listener("rename", added);
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.deepEqual(loads, [module]);

    if (process.platform !== "win32") {
      loads.length = 0;
      const child = path.join(sdk, "child");
      const lexical = path.join(root, "lexical");
      const alias = path.join(lexical, "alias");
      fs.mkdirSync(child);
      fs.mkdirSync(lexical);
      fs.symlinkSync(child, alias, "dir");
      const candidate = `${alias}/../go`;
      fs.writeFileSync(path.join(lexical, "go"), "unrelated");
      const traversal = new Map<string, string>();
      PluginBuildEnvironmentWitness.add(traversal, candidate);
      const projected = PluginBuildEnvironmentWitness.watchInputs(
        [traversal],
        root,
      );
      assert.deepEqual(Object.keys(projected), [file]);
      assert.equal(projected[file]?.poll, true);
      assert.equal(projected[file]?.entries[0]?.[0], candidate);
      register(traversal);
      assert.deepEqual(loads, []);
      fs.unlinkSync(alias);
      fs.symlinkSync(sdk, alias, "dir");
      assert.ok(poll);
      poll();
      await new Promise((resolve) => setTimeout(resolve, 30));
      assert.deepEqual(loads, [module]);

      loads.length = 0;
      const raw = Buffer.concat([Buffer.from(sdk + "/"), Buffer.from([0xff])]);
      try {
        fs.writeFileSync(raw, "raw");
      } catch (error) {
        if (
          process.platform === "darwin" &&
          (error as NodeJS.ErrnoException).code === "EILSEQ"
        )
          return;
        throw error;
      }
      try {
        const bytes = new Map<string, string>();
        const key = "/\0ttsc-raw/" + raw.toString("base64url");
        PluginBuildEnvironmentWitness.add(bytes, key);
        const groups = PluginBuildEnvironmentWitness.watchInputs([bytes], root);
        assert.deepEqual(Object.keys(groups), [sdk]);
        assert.equal(groups[sdk]?.recursive, true);
        register(bytes);
        assert.deepEqual(loads, []);
        fs.writeFileSync(raw, "changed raw bytes");
        assert.ok(poll);
        poll();
        await new Promise((resolve) => setTimeout(resolve, 30));
        assert.deepEqual(loads, [module]);
      } finally {
        fs.unlinkSync(raw);
      }
    }
  } finally {
    await observer.dispose();
  }
}

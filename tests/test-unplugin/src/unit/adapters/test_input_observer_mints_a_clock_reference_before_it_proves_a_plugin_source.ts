import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createInputObserver } from "../../../../../packages/unplugin/src/core/observer/createInputObserver";
import { filesystemClockReferences } from "../../../../../packages/unplugin/src/core/transform/clock/filesystemClockReferences";
import { refreshFilesystemClockReference } from "../../../../../packages/unplugin/src/core/transform/clock/refreshFilesystemClockReference";
import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../packages/unplugin/src/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import { pluginSourceState } from "../../../../../packages/unplugin/src/core/transform/inputs/pluginSourceState";
import type { TtscWatchInput } from "../../../../../packages/unplugin/src/core/transform/watch/TtscWatchInput";

/**
 * Verifies the input observer mints a clock reference of its own when it proves
 * a plugin source, instead of judging the source's file metadata against
 * whatever reference a delivery minted last.
 *
 * The observer proves a plugin source by the state its build keyed on
 * (`pluginSourceHolds`, samchon/ttsc#1487), whose digest is kept while the
 * files' metadata holds (`pluginSourceFilesDigest`). That metadata stands for
 * the bytes only against a clock reference minted since any rollback, which the
 * observer, holding no generation, never minted: it proved the source against a
 * delivery's old reference, or against none. It now mints one before the first
 * plugin source a check proves, in the probe directory its process keeps. The
 * observer reads the host's filesystem, which no scenario can step back, so
 * what is asserted is the reference the check leaves; that a proof trusts
 * metadata only against the current reference is asserted where the digest is
 * kept.
 *
 * 1. Register an owner of a plugin source, then clear every clock reference on the
 *    host's filesystem.
 * 2. Edit a file below the source, and assert the owner is reloaded and a
 *    reference exists again, minted by the check.
 * @evidence contracts/testing.md#behavioral-verification
 *   Authored observer checks a source-tree proof after a clock-reference reset; the input edit must reload its owner and leave one newly minted filesystem reference.
 * @evidence contracts/testing.md#independent-expectations
 *   A source proof must establish a current host filesystem clock reference before reusing metadata. Counts zero before and one after are independent requirements, not values computed by the observer.
 * @evidence contracts/testing.md#distinguishing-cases
 *   Covers quiet initial registration, the explicitly cleared-reference boundary and an edited source causing both owner reload and reference creation. Digest rollback trust has complementary ownership in the source proof tests.
 * @evidence contracts/testing.md#execution-ownership
 *   test_input_observer_mints_a_clock_reference_before_it_proves_a_plugin_source calls createInputObserver.open/replace, clears filesystemClockReferences, injects a changed Go-file notification and disposes in finally; real pluginSourceState/holds may probe go env/go version and GOROOT identity, but no plugin binary is built.
 */
export async function test_input_observer_mints_a_clock_reference_before_it_proves_a_plugin_source(): Promise<void> {
  const root = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-input-observer-clock-reference-"),
  );
  TestProject.writeFiles(root, {
    "plugin/go.mod": "module example.com/plugin\n\ngo 1.26\n",
    "plugin/main.go": "package main\n\nfunc main() {}\n",
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
  const references = () =>
    filesystemClockReferences(DEFAULT_FILESYSTEM_OPERATIONS).size;
  try {
    // 1. An owner, and no reference.
    observer.open(root, false);
    observer.replace(owner, [input()]);
    assert.deepEqual(await settled(), []);
    refreshFilesystemClockReference(undefined, DEFAULT_FILESYSTEM_OPERATIONS);
    assert.equal(references(), 0);

    // 2. The check that proves the source mints one.
    const main = path.join(source, "main.go");
    fs.appendFileSync(main, "// edited\n");
    emit?.("change", main);
    assert.deepEqual(await settled(), [[owner]], "the edit reloads the owner");
    assert.equal(references(), 1, "the check minted its own reference");
  } finally {
    await observer.dispose();
  }
}

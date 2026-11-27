import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createInputObserver } from "../../../../../packages/unplugin/src/core/observer/createInputObserver";
import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../packages/unplugin/src/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscWatchInputEvidence } from "../../../../../packages/unplugin/src/core/transform/watch/TtscWatchInputEvidence";
import { captureRecoveryTreeDigest } from "../../../../../packages/unplugin/src/core/transform/watch/captureRecoveryTreeDigest";
import { notifyFailedGenerationInputs } from "../../../../../packages/unplugin/src/core/transform/watch/notifyFailedGenerationInputs";
import { watchInputEvidenceMatchesDisk } from "../../../../../packages/unplugin/src/core/transform/watch/watchInputEvidenceMatchesDisk";
import { readProjectMembershipPolicy } from "../../../../../packages/unplugin/src/core/tsconfig/readProjectMembershipPolicy";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies that failed compiler source watches detect nested edits and the
 * appearance of a directory that a dangling link names.
 *
 * The repair lives outside the project and can leave its declared path's
 * metadata unchanged.
 *
 * 1. Deliver a failure and check that the source's subtree is admitted.
 * 2. Edit a nested Go file and report its native event.
 * 3. Deliver a failure through a dangling link, then create its target and check
 *    the recovery poll without sending an event.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual failed delivery registers the observer over real native paths. The observer reports the delivered owner after each repair, and the detached state comparison rejects the edited source.
 * @evidence contracts/testing.md#independent-expectations A nested source edit and an empty directory's arrival are independent fixture actions, with literal quiet and reload expectations.
 * @evidence contracts/testing.md#distinguishing-cases A stable directory and a dangling link are initially quiet. An existing source edit is reported through a nested event, while a dangling target is recovered through a poll without a lexical event.
 * @evidence contracts/testing.md#execution-ownership The unit calls the real delivery and observer over native temporary files using the supported watch and poll seams. It disposes the observer and starts no compiler, Go process or native watch.
 */
export async function test_failed_compiler_source_tree_wakes_the_observer(): Promise<void> {
  const root = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-failed-compiler-source-"),
  );
  TestProject.writeFiles(root, {
    "project/tsconfig.json": '{"include":["main.ts"]}',
    "project/main.ts": "export const value = 1;\n",
    "compiler/internal/driver/driver.go": "package driver\n",
  });
  const project = path.join(root, "project");
  const tsconfig = path.join(project, "tsconfig.json");
  const owner = path.join(project, "main.ts");
  const compiler = path.join(root, "compiler");
  const nested = path.join(compiler, "internal", "driver", "driver.go");
  const target = path.join(root, "missing-target");
  const link = path.join(root, "compiler-link");
  fs.mkdirSync(target);
  fs.symlinkSync(
    target,
    link,
    process.platform === "win32" ? "junction" : "dir",
  );
  fs.rmdirSync(target);

  const reports: string[][] = [];
  const watchers = new Map<
    string,
    {
      admit: ((directory: string) => boolean) | undefined;
      listener: (event: string, file: string | null) => void;
    }
  >();
  let poll: (() => void) | undefined;
  const observer = createInputObserver(
    ({ reload }) => reports.push([...reload]),
    {
      poll: (listener) => {
        poll = listener;
        return { close: () => void (poll = undefined) };
      },
      watch: (scope, listener, _onError, admit) => {
        watchers.set(scope, { admit, listener });
        return { close: () => void watchers.delete(scope) };
      },
    },
  );
  const deliver = (source: string) => {
    const digest = captureRecoveryTreeDigest(source);
    let evidence: TtscWatchInputEvidence | undefined;
    notifyFailedGenerationInputs(
      {
        addWatchFiles: (inputs, failed) => {
          assert.equal(failed, true);
          evidence = inputs.find((input) => input.file === source)?.evidence;
          observer.replace(owner, inputs, failed);
        },
      },
      {
        failedCompilerSource: { file: source, digest },
        externalInputPaths: [source],
        inputHashes: {},
        membershipPolicy: readProjectMembershipPolicy(tsconfig),
        projectRoot: project,
        result: { type: "exception", error: new Error("compiler failed") },
        tsconfig,
      },
      owner,
      { consulted: [], filesystem: DEFAULT_FILESYSTEM_OPERATIONS, tsconfig },
    );
    assert.ok(evidence);
    return evidence;
  };
  const settled = async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
    return reports.splice(0);
  };
  try {
    observer.open(project, false);
    const evidence = deliver(compiler);
    assert.deepEqual(await settled(), []);
    assert.equal(watchers.get(compiler)?.admit?.(path.dirname(nested)), true);
    fs.appendFileSync(nested, "// repaired\n");
    watchers.get(compiler)?.listener("change", nested);
    assert.deepEqual(await settled(), [[owner]]);
    assert.equal(watchInputEvidenceMatchesDisk(compiler, evidence), false);

    const dangling = deliver(link);
    assert.deepEqual(await settled(), []);
    assert.ok(poll);
    fs.mkdirSync(target);
    poll();
    assert.deepEqual(await settled(), [[owner]]);
    assert.equal(watchInputEvidenceMatchesDisk(link, dangling), false);
  } finally {
    await observer.dispose();
  }
}

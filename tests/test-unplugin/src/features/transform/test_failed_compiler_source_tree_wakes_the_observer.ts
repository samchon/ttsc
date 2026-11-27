import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { projectRecordMoved } from "../../../../../packages/unplugin/src/core/bridge/projectRecordMoved";
import { readProjectRecordFile } from "../../../../../packages/unplugin/src/core/bridge/readProjectRecordFile";
import { createInputObserver } from "../../../../../packages/unplugin/src/core/observer/createInputObserver";
import type { TtscCachedProjectTransform } from "../../../../../packages/unplugin/src/core/transform/cache/TtscCachedProjectTransform";
import { envelopeDerivation } from "../../../../../packages/unplugin/src/core/transform/envelope/envelopeDerivation";
import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../packages/unplugin/src/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import { failedGenerationEnvironmentChanged } from "../../../../../packages/unplugin/src/core/transform/generation/failedGenerationEnvironmentChanged";
import { projectWalkFailureFingerprint } from "../../../../../packages/unplugin/src/core/transform/generation/projectWalkFailureFingerprint";
import { collectProjectInputSnapshot } from "../../../../../packages/unplugin/src/core/transform/project/collectProjectInputSnapshot";
import { walkProjectInputs } from "../../../../../packages/unplugin/src/core/transform/project/walkProjectInputs";
import { captureCompilerArguments } from "../../../../../packages/unplugin/src/core/transform/tsconfig/captureCompilerArguments";
import { captureRecoveryTreeDigest } from "../../../../../packages/unplugin/src/core/transform/watch/captureRecoveryTreeDigest";
import { notifyFailedGenerationInputs } from "../../../../../packages/unplugin/src/core/transform/watch/notifyFailedGenerationInputs";
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
 * 2. Edit a nested Go file and check the live and terminal recovery paths.
 * 3. Deliver a failure through a dangling link, then create its target and check
 *    the recovery poll without sending an event.
 * 4. Register a source at the membership root, after its recorded contents
 *    changed, and check that recovery triggers without a new event.
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
    "project/internal/work.go": "package internal\n",
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
  const membershipPolicy = readProjectMembershipPolicy(tsconfig);
  const deliver = (
    source: string,
    digest = captureRecoveryTreeDigest(source),
    startedAt = observer.begin(),
  ) => {
    notifyFailedGenerationInputs(
      {
        membership: true,
        addWatchFiles: (inputs, failed) => {
          assert.equal(failed, true);
          if (source === project)
            assert.equal(
              inputs.find((input) => input.file === project)?.evidence?.state
                ?.codec,
              "membership",
            );
          observer.replace(owner, inputs, failed, startedAt);
        },
      },
      {
        failedCompilerSource: { file: source, digest },
        externalInputPaths: [source],
        inputHashes: {},
        membershipPolicy,
        projectDirectories: walkProjectInputs(
          project,
          undefined,
          membershipPolicy,
        ).directories,
        projectRoot: project,
        result: { type: "exception", error: new Error("compiler failed") },
        tsconfig,
      },
      owner,
      { consulted: [], filesystem: DEFAULT_FILESYSTEM_OPERATIONS, tsconfig },
    );
  };
  const settled = async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
    return reports.splice(0);
  };
  try {
    observer.open(project, false);
    const digest = captureRecoveryTreeDigest(compiler, undefined, {
      projectRoot: project,
      environment: { TTSC_CACHE_DIR: path.join(root, "cache") },
    });
    assert.equal(digest, captureRecoveryTreeDigest(compiler));
    const cached: TtscCachedProjectTransform = {
      failedCompilerSource: { file: compiler, digest },
      inputHashes: {},
      membershipPolicy,
      projectRoot: project,
      result: { type: "exception", error: new Error("compiler failed") },
      tsconfig,
    };
    const filesystem = DEFAULT_FILESYSTEM_OPERATIONS;
    const identities = envelopeDerivation(cached).identityContext;
    const snapshot = collectProjectInputSnapshot(
      project,
      identities,
      filesystem,
      undefined,
      { policy: membershipPolicy },
    );
    cached.projectDirectories = snapshot.projectDirectories;
    const terminal = {
      cached,
      declaredInputs: undefined,
      inputStates: new Map(),
      projectInputHashes: snapshot.hashes,
      projectWalkComplete: true,
      projectWalkFailures: projectWalkFailureFingerprint(
        snapshot,
        undefined,
        project,
        identities,
      ),
    };
    const terminalChanged = () =>
      failedGenerationEnvironmentChanged(terminal, {
        currentFile: owner,
        currentSource: fs.readFileSync(owner, "utf8"),
        filesystem,
      });
    assert.equal(terminalChanged(), false);
    deliver(compiler, digest);
    assert.deepEqual(await settled(), []);
    assert.equal(watchers.get(compiler)?.admit?.(path.dirname(nested)), true);
    fs.appendFileSync(nested, "// repaired\n");
    watchers.get(compiler)?.listener("change", nested);
    assert.deepEqual(await settled(), [[owner]]);
    assert.equal(terminalChanged(), true);
    const compilerArguments = captureCompilerArguments({});
    const recordFile = path.join(root, "record.json");
    fs.writeFileSync(
      recordFile,
      JSON.stringify({
        compilerArguments,
        inputs: {},
        membership: null,
        recoveryTree: { file: compiler, digest },
        root: project,
        signal: 0,
        tsconfig,
      }),
    );
    const record = readProjectRecordFile(recordFile);
    assert.ok(record);
    assert.equal(
      projectRecordMoved(record, undefined, compilerArguments.identity),
      compiler,
    );

    deliver(link);
    assert.deepEqual(await settled(), []);
    assert.ok(poll);
    fs.mkdirSync(target);
    poll();
    assert.deepEqual(await settled(), [[owner]]);

    const startedAt = observer.begin();
    const beforeCompile = captureRecoveryTreeDigest(project);
    fs.appendFileSync(
      path.join(project, "internal", "work.go"),
      "// repaired\n",
    );
    deliver(project, beforeCompile, startedAt);
    assert.deepEqual(await settled(), [[owner]]);

    if (process.platform === "linux") {
      const rawLink = path.join(root, "compiler-byte-target");
      const targets = [0xfe, 0xff].map((byte) =>
        Buffer.concat([
          Buffer.from(path.join(root, "source-")),
          Buffer.from([byte]),
        ]),
      );
      const digestAt = (target: Buffer): string | null => {
        fs.symlinkSync(target, rawLink);
        try {
          return captureRecoveryTreeDigest(rawLink);
        } finally {
          fs.unlinkSync(rawLink);
        }
      };
      const created: { directory: Buffer; file: Buffer }[] = [];
      try {
        for (const directory of targets) {
          fs.mkdirSync(directory);
          const file = Buffer.concat([directory, Buffer.from("/main.go")]);
          created.push({ directory, file });
          fs.writeFileSync(file, "package main\n");
        }
        const before = digestAt(targets[0]!);
        const after = digestAt(targets[1]!);
        assert.ok(before);
        assert.ok(after);
        assert.notEqual(
          before,
          after,
          "equal bytes under distinct raw targets",
        );
      } finally {
        for (const { directory, file } of created) {
          if (fs.existsSync(file)) fs.unlinkSync(file);
          fs.rmdirSync(directory);
        }
      }
    }
  } finally {
    await observer.dispose();
  }
}

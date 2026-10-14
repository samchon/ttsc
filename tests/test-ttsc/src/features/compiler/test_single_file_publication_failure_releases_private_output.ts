import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { runSingleFileEmit } from "../../../../../packages/ttsc/src/compiler/internal/runSingleFileEmit";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies failed single-file publication releases its actual private output.
 *
 * The output directory spans the awaited handoff, so failure must reenter the
 * emitting producer's finally block before the invocation finishes.
 *
 * 1. Pause actual single-file preparation before its native compilation phase.
 * 2. Observe its new private allocation and reject the project publication.
 * 3. Assert removal and contrast synchronous promise refusal with cleanup.
 *
 * @evidence contracts/testing.md#behavioral-verification Real asynchronous and synchronous single-file entries allocate private output, then fail at project-input publication; filesystem observations require that allocation to disappear before the failure returns.
 * @evidence contracts/testing.md#independent-expectations The authored deferred handler independently prevents compilation and supplies the exact rejection; the documented invocation-owned temporary lifetime requires cleanup rather than retained output.
 * @evidence contracts/testing.md#distinguishing-cases A pending asynchronous handoff keeps its allocation live, rejection releases it, and synchronous promise refusal also releases it. Successful native emission and provenance selection remain owned by compiler E2E coverage.
 * @evidence contracts/testing.md#execution-ownership This exported source unit uses an owned temporary config and source with plugins false and process.execPath only as an existing identity. No response args require option inspection, and publication failure precedes compilation, so no native process, worker or watcher starts. Only the observed new private allocation and fixture root are cleaned.
 */
export async function test_single_file_publication_failure_releases_private_output(): Promise<void> {
  const root = TestProject.physicalPath(
    TestProject.createProject({
      "tsconfig.json": '{"files":["main.ts"]}',
      "main.ts": "export const value = 1;\n",
    }),
  );
  const temporary = fs.realpathSync.native(os.tmpdir());
  const allocationNames = () =>
    fs
      .readdirSync(temporary)
      .filter((name) => name.startsWith("ttsc-single-file-"));
  const options = {
    binary: process.execPath,
    cwd: root,
    file: "main.ts",
    plugins: false as const,
  };
  const failure = new Error("single-file watch registration refused");
  const publication = Promise.withResolvers<void>();
  const started = Promise.withResolvers<void>();
  const before = new Set(allocationNames());
  let ownedOutput: string | undefined;
  let synchronousOutput: string | undefined;
  const operation = runSingleFileEmit.async({
    ...options,
    onProjectInputs: () => {
      started.resolve();
      return publication.promise;
    },
  });
  const rejected = assert.rejects(operation, (error) => error === failure);
  try {
    await Promise.race([
      started.promise,
      operation.then(
        () => {
          throw new Error("emission completed before project publication");
        },
        (error: unknown) => {
          throw error;
        },
      ),
    ]);
    const created = allocationNames().filter((name) => !before.has(name));
    assert.equal(
      created.length,
      1,
      "the pending invocation owns one private output directory",
    );
    ownedOutput = path.join(temporary, created[0]!);
    assert.equal(fs.statSync(ownedOutput).isDirectory(), true);
    publication.reject(failure);
    await rejected;
    assert.equal(
      fs.existsSync(ownedOutput),
      false,
      "publication rejection must finish private-output cleanup",
    );

    const beforeSync = new Set(allocationNames());
    assert.throws(
      () =>
        runSingleFileEmit({
          ...options,
          onProjectInputs: () => {
            const createdSync = allocationNames().filter(
              (name) => !beforeSync.has(name),
            );
            assert.equal(createdSync.length, 1);
            synchronousOutput = path.join(temporary, createdSync[0]!);
            return Promise.reject(failure);
          },
        }),
      /asynchronous build entry/,
    );
    assert.notEqual(synchronousOutput, undefined);
    assert.equal(fs.existsSync(synchronousOutput!), false);
  } finally {
    publication.reject(failure);
    await rejected;
    if (ownedOutput !== undefined)
      fs.rmSync(ownedOutput, { recursive: true, force: true });
    if (synchronousOutput !== undefined)
      fs.rmSync(synchronousOutput, { recursive: true, force: true });
    fs.rmSync(root, { recursive: true, force: true });
  }
}

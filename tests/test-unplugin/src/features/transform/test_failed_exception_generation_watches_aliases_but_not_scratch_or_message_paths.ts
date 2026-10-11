import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../packages/unplugin/src/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import { notifyFailedGenerationInputs } from "../../../../../packages/unplugin/src/core/transform/watch/notifyFailedGenerationInputs";
import { readProjectMembershipPolicy } from "../../../../../packages/unplugin/src/core/tsconfig/readProjectMembershipPolicy";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies a failed exception generation hands the host every retained alias of
 * its inputs, but neither its scratch tree nor a path a generic message line
 * only looks like.
 *
 * A host exception is delivered by the compile that produced it; a cached one
 * is never replayed (samchon/ttsc#1400). Its watches must still let a repair
 * arrive through any lexical alias the generation read, while a disposed
 * scratch tree or a non-diagnostic line must not become a watch.
 *
 * 1. Link two directory aliases to one real input directory, and retain the real
 *    input and both aliases as the generation's external inputs.
 * 2. Fail the generation with an exception whose message names a scratch file in
 *    standard diagnostic form and `foo.ts` in a generic line.
 * 3. Assert both aliases are watched, and neither the scratch file nor `foo.ts`.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual notifyFailedGenerationInputs hands the watch batch for a real exception envelope over real directory links.
 * @evidence contracts/testing.md#independent-expectations The authored alias, scratch and message paths are the expectations; the links' shared realpath is checked natively first.
 * @evidence contracts/testing.md#distinguishing-cases Two retargetable aliases of one file stay separate watches, a scratch path in diagnostic form is excluded, and a generic line names no watch.
 * @evidence contracts/testing.md#execution-ownership This source unit calls the owning operation directly; no compiler, plugin or host runs. The E2E recovery batch owns the public API's refusal to replay a cached exception.
 */
export function test_failed_exception_generation_watches_aliases_but_not_scratch_or_message_paths(): void {
  const root = TestProject.tmpdir("ttsc-failed-exception-watch-");
  TestProject.writeFiles(root, {
    "tsconfig.json": '{"include":["src"]}',
    "src/main.ts": "export const value = 1;\n",
    "inputs/shared.d.ts": "export declare const shared: number;\n",
  });
  const target = path.join(root, "inputs", "shared.d.ts");
  const aliases = ["failure-watch-a", "failure-watch-b"].map((name) =>
    path.join(root, "node_modules", name),
  );
  fs.mkdirSync(path.join(root, "node_modules"));
  for (const alias of aliases)
    fs.symlinkSync(
      path.dirname(target),
      alias,
      process.platform === "win32" ? "junction" : "dir",
    );
  const aliasInputs = aliases.map((alias) => path.join(alias, "shared.d.ts"));
  assert.equal(
    fs.realpathSync.native(aliasInputs[0]!),
    fs.realpathSync.native(aliasInputs[1]!),
    "the aliases must share one current physical target",
  );
  const scratchDirectory = path.join(root, ".scratch");
  const scratchInput = path.join(scratchDirectory, "owned.tmp");
  const tsconfig = path.join(root, "tsconfig.json");
  const file = path.join(root, "src", "main.ts");

  const watched: string[] = [];
  let failureBatches = 0;
  notifyFailedGenerationInputs(
    {
      addWatchFiles: (inputs, failure) => {
        if (failure === true) ++failureBatches;
        watched.push(...inputs.map((input) => input.file));
      },
    },
    {
      externalInputPaths: [target, ...aliasInputs],
      inputHashes: {},
      membershipPolicy: readProjectMembershipPolicy(tsconfig),
      projectRoot: root,
      result: {
        type: "exception",
        error: new Error(
          `${scratchInput}:1:2 - error TS9000: scratch failure\nfoo.ts:1:2 - error while loading\nhost exploded`,
        ),
      },
      scratchDirectory,
      tsconfig,
    },
    file,
    { consulted: [], filesystem: DEFAULT_FILESYSTEM_OPERATIONS, tsconfig },
  );

  assert.equal(failureBatches, 1, "one failure batch reaches the host");
  assert.deepEqual(
    aliasInputs.filter((input) => watched.includes(input)),
    aliasInputs,
    "a failed generation must preserve every independently retargetable lexical alias",
  );
  assert.ok(
    !watched.includes(path.resolve(root, "foo.ts")),
    `a generic exception line must not manufacture a diagnostic watch path; watched: ${watched.join(", ")}`,
  );
  assert.ok(
    !watched.includes(scratchInput),
    "a failed generation must not register its disposed scratch tree",
  );
}

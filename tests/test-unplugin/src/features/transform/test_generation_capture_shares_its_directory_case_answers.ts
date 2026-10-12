import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import type { ITtscCompilerTransformation } from "ttsc";

import { TRANSFORM_RESULT_FILESYSTEM } from "../../../../../packages/unplugin/src/core/transform/cache/TRANSFORM_RESULT_FILESYSTEM";
import { generationCaseSensitivity } from "../../../../../packages/unplugin/src/core/transform/envelope/generationCaseSensitivity";
import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../packages/unplugin/src/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import type { TtscTransformFilesystemOperations } from "../../../../../packages/unplugin/src/core/transform/filesystem/TtscTransformFilesystemOperations";
import { createHostPathIdentityContext } from "../../../../../packages/unplugin/src/core/transform/filesystem/createHostPathIdentityContext";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies the identity contexts that capture one generation share the
 * generation's directory case answers over its registered view, while another
 * view keeps observing for itself (samchon/ttsc#1742).
 *
 * Capturing a generation built an identity context per input selection and per
 * tracker baseline, and each asked every directory's case policy again; on
 * Windows a directory whose names cannot settle it costs an `fsutil` process
 * per question.
 *
 * 1. Register a counting view for a compiler result and resolve a missing file
 *    below one directory through three contexts built with the generation's
 *    answers: the directory is listed once.
 * 2. Resolve the same path through three contexts over another view: each context
 *    lists the directory for itself.
 *
 * @evidence contracts/testing.md#behavioral-verification Real host identity contexts resolve a real missing path through the real case probe over counting views; directory listings are the observed behavior.
 * @evidence contracts/testing.md#independent-expectations One listing for the generation and one per context for another view follow from the sharing contract, independently of the answer.
 * @evidence contracts/testing.md#distinguishing-cases The registered view and an unregistered view are separate rows.
 * @evidence contracts/testing.md#execution-ownership This source unit owns its temporary directory and a result object registered only for it; no compiler or watcher starts.
 */
export function test_generation_capture_shares_its_directory_case_answers(): void {
  const root = TestProject.physicalPath(
    TestProject.tmpdir("ttsc-generation-case-answers-"),
  );
  const directory = path.join(root, "Docs");
  fs.mkdirSync(directory);
  fs.writeFileSync(path.join(directory, "Readme.md"), "# readme\n");
  const missing = path.join(directory, "missing.md");

  const countingView = () => {
    let listed = 0;
    const view: TtscTransformFilesystemOperations = {
      ...DEFAULT_FILESYSTEM_OPERATIONS,
      readdir: (location) => {
        if (path.resolve(location) === directory) listed++;
        return DEFAULT_FILESYSTEM_OPERATIONS.readdir(location);
      },
    };
    return { view, listed: () => listed };
  };
  const result = {
    type: "success",
    typescript: {},
    diagnostics: [],
  } as unknown as ITtscCompilerTransformation;

  const registered = countingView();
  TRANSFORM_RESULT_FILESYSTEM.set(result, registered.view);
  const shared = generationCaseSensitivity({
    filesystem: registered.view,
    projectRoot: root,
    result,
  });
  for (let context = 0; context < 3; context++)
    createHostPathIdentityContext(registered.view, shared).resolve(missing);
  assert.equal(registered.listed(), 1, "one generation lists it once");

  const other = countingView();
  const own = generationCaseSensitivity({
    filesystem: other.view,
    projectRoot: root,
    result,
  });
  for (let context = 0; context < 3; context++)
    createHostPathIdentityContext(other.view, own).resolve(missing);
  assert.equal(other.listed(), 3, "another view observes per context");
}

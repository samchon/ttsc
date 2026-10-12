import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { createCaseSensitivityObservations } from "../../../../../packages/ttsc/src/internal/pathIdentity/createCaseSensitivityObservations";
import { createFilesystemPathIdentityContext } from "../../../../../packages/ttsc/src/internal/pathIdentity/createFilesystemPathIdentityContext";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies one set of case observations probes each directory once for every
 * identity context sharing it, and a new set probes again (samchon/ttsc#1742).
 *
 * Identity contexts memoize case answers for themselves, so a unit of work that
 * built several contexts probed a directory once per context; on Windows an
 * inconclusive directory costs an `fsutil` process per probe.
 *
 * 1. Resolve a missing file below one directory through three contexts sharing one
 *    observation set: the directory is listed once.
 * 2. Repeat through a second set: the directory is listed again, and both sets
 *    reach the same answer from their memos.
 *
 * @evidence contracts/testing.md#behavioral-verification Real identity contexts resolve real missing paths through the real probe; directory listings counted through the injected reader are the observed behavior.
 * @evidence contracts/testing.md#independent-expectations One listing per directory per set follows from the sharing contract, independently of the answer the probe reaches.
 * @evidence contracts/testing.md#distinguishing-cases A shared set and a second set are separate rows.
 * @evidence contracts/testing.md#execution-ownership This source unit owns its temporary directory; no process starts on platforms whose probe concludes from names, which the authored entries provide.
 */
export function test_case_sensitivity_observations_answer_once_per_unit(): void {
  const root = TestProject.physicalPath(
    TestProject.tmpdir("ttsc-case-observations-"),
  );
  const directory = path.join(root, "Docs");
  fs.mkdirSync(directory);
  fs.writeFileSync(path.join(directory, "Readme.md"), "# readme\n");
  const listed: string[] = [];
  const observations = () =>
    createCaseSensitivityObservations({
      readdir: (location) => {
        listed.push(path.resolve(location));
        return fs.readdirSync(location);
      },
    });
  const missing = path.join(directory, "missing.md");
  const listings = () =>
    listed.filter((location) => location === path.resolve(directory)).length;

  const shared = observations();
  for (let context = 0; context < 3; context++)
    createFilesystemPathIdentityContext({ caseSensitive: shared }).resolve(
      missing,
    );
  assert.equal(listings(), 1, "one set lists the directory once");

  const next = observations();
  for (let context = 0; context < 3; context++)
    createFilesystemPathIdentityContext({ caseSensitive: next }).resolve(
      missing,
    );
  assert.equal(listings(), 2, "a new set lists it again");

  assert.equal(
    shared(directory),
    next(directory),
    "both sets reach the same answer",
  );
  assert.equal(listings(), 2, "answers repeat from each set's memo");
}

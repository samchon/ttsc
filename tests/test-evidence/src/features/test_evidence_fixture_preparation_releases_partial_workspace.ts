import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createProject } from "../../../utils/src/evidence/createProject";

/**
 * Verifies failed fixture preparation releases the partial private workspace.
 *
 * An exception while writing compiler configuration happens after the temporary
 * workspace and package manifest exist, before any package/native resolution.
 * Preparation owns those files even when it never returns a cleanup callback.
 *
 * 1. Supply circular compiler options to the real fixture preparation owner.
 * 2. Require its actual JSON serialization error without replacing filesystem IO.
 * 3. Assert that no uniquely named partial workspace remains in the temp parent.
 *
 * @evidence contracts/testing.md#behavioral-verification The real createProject operation allocates its workspace and writes the package manifest before circular compiler options fail serialization; its preparation-error path must remove that actual partial tree.
 * @evidence contracts/testing.md#independent-expectations A unique literal fixture-name prefix identifies only this invocation, and JavaScript circular JSON serialization independently establishes the expected TypeError. The absence assertion reads the actual temp parent rather than a cleanup-return value.
 * @evidence contracts/testing.md#distinguishing-cases Failure occurs after allocation and an initial write, so an implementation that returns no fixture but leaks its partial directory fails. Package linking and native producer preparation are later operations and are not exercised by this case.
 * @evidence contracts/testing.md#execution-ownership The matching named source-unit function calls authored createProject in its Node process, creates no installed consumer and launches no compiler or Go process. Its recovery finally removes only paths matching this invocation's unique prefix if the cleanup regression occurs.
 */
export function test_evidence_fixture_preparation_releases_partial_workspace(): void {
  const name = `preparation-unit-${randomUUID()}`;
  const prefix = `evidence-${name}-`;
  const options: Record<string, unknown> = {};
  options.circular = options;
  try {
    assert.throws(
      () => createProject({
        name,
        compilerOptions: options,
        lintConfig: "export default {};\n",
        files: {},
      }),
      TypeError,
    );
    assert.deepEqual(
      fs.readdirSync(os.tmpdir()).filter((entry) => entry.startsWith(prefix)),
      [],
      "Failed preparation must not leave an allocated fixture behind.",
    );
  } finally {
    for (const entry of fs.readdirSync(os.tmpdir()))
      if (entry.startsWith(prefix))
        fs.rmSync(path.join(os.tmpdir(), entry), { recursive: true, force: true });
  }
}

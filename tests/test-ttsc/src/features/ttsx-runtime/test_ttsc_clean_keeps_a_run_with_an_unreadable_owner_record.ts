import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { runtimeRunsDirectory } from "../../internal/ttsx-run";

/**
 * Verifies clean keeps a run whose owner record cannot prove abandonment.
 *
 * A torn or unreadable owner file is different from no owner file. Deleting its
 * run would take active output whose owner could not be inspected, so the
 * cleanup path keeps it and reports that a run may still be in progress.
 *
 * 1. Create a run directory with a malformed owner record.
 * 2. Run the real `ttsc clean` command.
 * 3. Assert the directory remains and the command reports it as kept.
 */
export const test_ttsc_clean_keeps_a_run_with_an_unreadable_owner_record =
  (): void => {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ name: "unknown-run", private: true }),
      "tsconfig.json": JSON.stringify({ include: ["src"] }),
      "src/main.ts": "export const value = 1;\n",
    });
    const directory = path.join(runtimeRunsDirectory(root), "unknown");
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, "owner-12.json"), "{", "utf8");

    const result = TestProject.spawn(
      TestProject.TTSC_BIN,
      ["clean", "--cwd", root],
      { cwd: root },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.existsSync(directory), true, result.stdout);
    assert.match(result.stdout, /ttsc: kept /);
  };

import cp from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { TestExecutor } from "./TestExecutor";

/** Execute source units before the independent boundaries in a local suite. */
export namespace TestSourceUnits {
  export const run = (boundaries: string[]): boolean => {
    const unitOnly = process.env.TTSC_TEST_LAYER === "unit";
    if (process.env.TTSC_TEST_WORKER_FILES && !unitOnly) return true;
    const unitsSelected = TestExecutor.hasCases({
      location: path.join(process.cwd(), "src", "unit"),
    });
    const boundariesSelected = TestExecutor.hasCases({ location: boundaries });
    // If neither layer matched, the original executor reports the empty
    // selection. A match in one layer never makes the other layer an error.
    if (!unitsSelected && !unitOnly) return true;
    const result = cp.spawnSync(
      process.execPath,
      [
        "--import",
        new URL("../../../scripts/register-unit-loader.mjs", import.meta.url)
          .href,
        fileURLToPath(
          new URL("../../../scripts/ci/run-source-units.mts", import.meta.url),
        ),
        ...process.argv.slice(2),
      ],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          TTSC_TEST_LAYER: "unit",
          TTSC_TEST_WORKERS: "1",
        },
        stdio: "inherit",
        windowsHide: true,
      },
    );
    if (result.error) console.error(result.error);
    if (result.error || result.status !== 0) process.exitCode = 1;
    return !unitOnly && boundariesSelected;
  };
}

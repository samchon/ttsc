import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";


type Files = Readonly<Record<string, string>>;
type Spawn = typeof TestProject.spawn;
type Profile = {
  name: string;
  files: Files;
  run(root: string, persistent: string, spawn: Spawn): void;
};

/**
 * Supplies the remaining placement profile requests.
 *
 * The source-race population runs in the existing shared Runtime instead of
 * this profile array; its real executable comes from shared source preparation.
 * The remaining placement recipe still owns two standalone runtime requests and
 * is not counted as consolidated by the shared Runtime outer host.
 *
 * @evidence contracts/common.md#principled-implementation Actual launcher receipts and selected cache paths distinguish remaining placement behavior.
 * @evidence contracts/common.md#clear-and-simple-design The existing placement input retains its own cache authority; source race no longer delegates through this execution array.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Remaining two launches are disclosed independent requests, not renamed shared DAG work.
 * @evidence contracts/common.md#meaningful-documentation States the remaining recipes and the transferred source-race owner without claiming the whole runtime family is consolidated.
 * @evidence contracts/portability.md#os-neutral-implementation Native paths and stat controls retain the original platform boundaries.
 * @evidence contracts/performance.md#efficient-algorithms Executable rewrites and reads cost its byte population; cache scans cost its entries, excluding native work.
 * @evidence contracts/performance.md#reuse-equivalent-work Each original recipe keeps its cache warm across its distinguishing requests.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Original returned status/signal guards precede source or executable changes; uncertain closure retains the parent owner.
 * @evidence contracts/testing.md#behavioral-verification Actual lowered output and cache placement distinguish explicit/default delivery; executable identity is now consumed by the selected Runtime.
 * @evidence contracts/testing.md#independent-expectations Literal lowered output and original exact cache-file counts remain independent expectations.
 * @evidence contracts/testing.md#distinguishing-cases Explicit/default placement and default project cache versus an explicit cache and temporary-directory absence remain.
 * @evidence contracts/testing.md#execution-ownership The existing canonical parent invokes the remaining real callbacks; the selected shared runtime owns the removed source-race recipe.
 * @evidence contracts/e2e.md#necessary-boundary Actual cache delivery and executable movement require their installed runtime boundary.
 * @evidence contracts/e2e.md#shared-execution Two remaining requests are still unconsolidated; the removed two source-race requests are now loads within one existing Runtime.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Original receipt and call-local environment controls remain, with no additional profile or host.
 * @evidence contracts/e2e.md#preserved-coverage Placement expectations remain here; shared source preparation and native-source-borrower.cjs own actual publication and the two/one race values.
 */
export function canonicalCommonJsOrphanProfiles(
  inputs: { placement: Files },
): Profile[] {
  const collect = (failures: unknown[], assertion: () => void): void => {
    try {
      assertion();
    } catch (error) {
      failures.push(error);
    }
  };

  const publishFailures = (name: string, failures: unknown[]): void => {
    if (failures.length) throw new AggregateError(failures, name);
  };
  const childEnvironment = (): NodeJS.ProcessEnv => ({
    ORPHAN_RACE_COMPILER: undefined,
    ORPHAN_RACE_SOURCE: undefined,
    ORPHAN_RACE_DONE: undefined,
  });
  return [
    {
      name: "orphan-placement",
      files: inputs.placement,
      run(root, persistent, spawn): void {
        const failures: unknown[] = [];
        const temp = path.join(persistent, "placement-temp");
        fs.mkdirSync(temp);
        const run = (args: string[]) =>
          spawn(TestProject.TTSX_BIN, ["--cwd", root, ...args, "src/main.ts"], {
            cwd: root,
            env: {
              ...childEnvironment(),
              TEMP: temp,
              TMP: temp,
              TMPDIR: temp,
              TTSC_CACHE_DIR: undefined,
            },
          });
        const lowered = (directory: string): string[] =>
          fs.existsSync(directory)
            ? fs.readdirSync(directory).filter((name) => name.endsWith(".js"))
            : [];
        const named = path.join(persistent, "placement-named-cache");
        const first = run(["--cache-dir", named]);
        if (first) {
          collect(failures, () => assert.equal(first.status, 0, first.stderr));
          collect(failures, () => assert.equal(first.stdout.trim(), "lowered"));
        }
        collect(failures, () =>
          assert.equal(lowered(path.join(named, "ttsx-orphan")).length, 1),
        );
        const second = run([]);
        if (second) {
          collect(failures, () =>
            assert.equal(second.status, 0, second.stderr),
          );
          collect(failures, () =>
            assert.equal(second.stdout.trim(), "lowered"),
          );
        }
        collect(failures, () =>
          assert.equal(
            lowered(
              path.join(root, "node_modules", ".cache", "ttsc", "ttsx-orphan"),
            ).length,
            1,
          ),
        );
        collect(failures, () =>
          assert.equal(
            fs.existsSync(path.join(temp, "ttsc-orphan")),
            false,
            "a lowering went to the temporary directory",
          ),
        );
        publishFailures("orphan placement", failures);
      },
    },
  ];
}

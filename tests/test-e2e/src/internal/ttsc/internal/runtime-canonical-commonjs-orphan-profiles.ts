import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { isOrdinarilyClosedReadonlyLauncher } from "../../../../../utils/src/isOrdinarilyClosedReadonlyLauncher";

type Files = Readonly<Record<string, string>>;
type Spawn = typeof TestProject.spawn;
type Profile = {
  name: string;
  files: Files;
  run(root: string, persistent: string, spawn: Spawn): void;
};

/**
 * Supplies the remaining placement and compiler-identity profile requests.
 *
 * The source-race population runs in the existing shared Runtime instead of
 * this profile array; its real executable comes from shared source preparation.
 * These two remaining recipes still own five standalone runtime requests and
 * are not counted as consolidated by the shared Runtime outer host.
 *
 * @evidence contracts/common.md#principled-implementation Actual launcher receipts, selected cache paths and rewritten executable identity distinguish remaining placement and identity behavior.
 * @evidence contracts/common.md#clear-and-simple-design Two existing profile inputs retain their own cache authorities; source race no longer delegates through this execution array.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Remaining five launches are disclosed independent requests, not renamed shared DAG work.
 * @evidence contracts/common.md#meaningful-documentation States the remaining recipes and the transferred source-race owner without claiming the whole runtime family is consolidated.
 * @evidence contracts/portability.md#os-neutral-implementation Native paths and stat controls retain the original platform boundaries.
 * @evidence contracts/performance.md#efficient-algorithms Executable rewrites and reads cost its byte population; cache scans cost its entries, excluding native work.
 * @evidence contracts/performance.md#reuse-equivalent-work Each original recipe keeps its cache warm across its distinguishing requests.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Original returned status/signal guards precede source or executable changes; uncertain closure retains the parent owner.
 * @evidence contracts/testing.md#behavioral-verification Actual lowered and cached-marker outputs distinguish placement and changed executable identity.
 * @evidence contracts/testing.md#independent-expectations Literal lowered/cached-marker outputs and original exact cache-file counts remain independent expectations.
 * @evidence contracts/testing.md#distinguishing-cases Explicit/default placement and warm marker versus same-byte executable rewrite remain.
 * @evidence contracts/testing.md#execution-ownership The existing canonical parent invokes the remaining real callbacks; the selected shared runtime owns the removed source-race recipe.
 * @evidence contracts/e2e.md#necessary-boundary Actual cache delivery and executable movement require their installed runtime boundary.
 * @evidence contracts/e2e.md#shared-execution Five remaining requests are still unconsolidated; the removed two source-race requests are now loads within one existing Runtime.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Original receipt and call-local environment controls remain, with no additional profile or host.
 * @evidence contracts/e2e.md#preserved-coverage Placement and identity expectations remain here; shared source preparation and native-source-borrower.cjs own actual publication and the two/one race values.
 */
export function canonicalCommonJsOrphanProfiles(
  inputs: { placement: Files; identity: Files },
): Profile[] {
  const collect = (failures: unknown[], assertion: () => void): void => {
    try {
      assertion();
    } catch (error) {
      failures.push(error);
    }
  };

  const joined = (...receipts: (ReturnType<Spawn> | undefined)[]): void => {
    for (const receipt of receipts) {
      assert.ok(receipt, "BLOCKED: no completed request receipt");
      assert.equal(
        isOrdinarilyClosedReadonlyLauncher(receipt),
        true,
        "BLOCKED: uncertain launcher metadata",
      );
      assert.equal(
        receipt.error,
        undefined,
        "BLOCKED: incomplete native request",
      );
      assert.notEqual(
        receipt.status,
        null,
        "BLOCKED: incomplete native request",
      );
      assert.equal(
        receipt.signal,
        null,
        "BLOCKED: abnormal native termination",
      );
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
    {
      name: "orphan-compiler-identity",
      files: inputs.identity,
      run(root, persistent, spawn): void {
        const failures: unknown[] = [];
        const compilerDir = path.join(persistent, "identity-compiler");
        assert.equal(
          fs.existsSync(compilerDir),
          false,
          "fresh copied compiler required",
        );
        fs.cpSync(path.dirname(TestProject.TSGO_BINARY), compilerDir, {
          recursive: true,
        });
        const compiler = path.join(
          compilerDir,
          path.basename(TestProject.TSGO_BINARY),
        );
        fs.chmodSync(compiler, 0o755);
        const stamp = 1_700_000_000;
        fs.utimesSync(compiler, stamp, stamp);
        const cacheDir = path.join(persistent, "identity-orphan-cache");
        const run = () =>
          spawn(TestProject.TTSX_BIN, ["--cwd", root, "src/main.ts"], {
            cwd: root,
            env: {
              ...childEnvironment(),
              TTSC_CACHE_DIR: cacheDir,
              TTSC_TSGO_BINARY: compiler,
            },
          });
        const first = run();
        if (first) {
          collect(failures, () => assert.equal(first.status, 0, first.stderr));
          collect(failures, () => assert.equal(first.stdout.trim(), "lowered"));
        }
        // Cache topology is an observed publication, not a derived expected
        // fingerprint. Failed publication remains an independent failure.
        const orphanDir = path.join(cacheDir, "ttsx-orphan");
        collect(failures, () => {
          joined(first);
          const cached = fs
            .readdirSync(orphanDir)
            .filter((name) => name.endsWith(".js"));
          assert.equal(cached.length, 1, cached.join(", "));
          fs.appendFileSync(
            path.join(orphanDir, cached[0]!),
            '\nconsole.log("served from cache");\n',
          );
        });
        const second = run();
        if (second) {
          collect(failures, () =>
            assert.equal(second.status, 0, second.stderr),
          );
          collect(failures, () =>
            assert.match(second.stdout, /served from cache/),
          );
        }
        // No host is active here. Keep the same binary path, bytes, size and
        // exact whole-second mtime while producing a real filesystem rewrite.
        collect(failures, () => {
          joined(first, second);
          const before = fs.statSync(compiler, { bigint: true });
          fs.writeFileSync(compiler, fs.readFileSync(compiler));
          fs.utimesSync(compiler, stamp, stamp);
          const after = fs.statSync(compiler, { bigint: true });
          assert.equal(after.mtimeNs, before.mtimeNs);
          assert.equal(after.size, before.size);
        });
        const third = run();
        if (third) {
          collect(failures, () => assert.equal(third.status, 0, third.stderr));
          collect(failures, () => assert.equal(third.stdout.trim(), "lowered"));
        }
        publishFailures("orphan compiler identity", failures);
      },
    },
  ];
}

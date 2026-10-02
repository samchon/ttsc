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
 * Prepares three CommonJS orphan profiles with exact authored input maps and
 * actual owning native callbacks. Placement retains two hosts, executable
 * identity retains three, and source-race retains two through one externally
 * published actual forwarding artifact. No command runs merely by constructing
 * these profiles. Missing publisher authority blocks only the two race
 * requests; the other eight profiles keep their sixteen independent requests.
 * The supplied path is the publisher's returned string, not a fabricated result
 * field.
 *
 * @evidence contracts/common.md#principled-implementation Independent source/cache observations accompany real host results; source restoration and executable rewrites require ordinary returned metadata.
 * @evidence contracts/common.md#clear-and-simple-design Three named callbacks distinguish cache placement, executable identity and compiler-read source changes without allocating consumer roots.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Real source files, copied compiler bytes and the externally owned native forwarding artifact supply observations; no fixture digest or fabricated successful binary replaces them.
 * @evidence contracts/common.md#meaningful-documentation States seven logical requests and that the caller must separately establish actual native publication rather than infer it from an existing file.
 * @evidence contracts/portability.md#os-neutral-implementation Native path/copy/stat operations preserve platform identity and scope environment selections to actual children.
 * @evidence contracts/performance.md#efficient-algorithms Copying and rewriting compiler B bytes and reading cache E entries costs O(B+E), excluding real compiler/runtime work.
 * @evidence contracts/performance.md#reuse-equivalent-work The already published forwarding artifact is reused; identity and source-race requests retain their same profile cache across the distinguishing mutations.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Mutations follow completed receipt guards. The parent assembler blocks later spawns and moves on uncertain metadata and owns retaining the consumer root.
 * @evidence contracts/testing.md#behavioral-verification Actual ttsx output, cache-file counts, planted markers and restored-source output distinguish the original three behaviors.
 * @evidence contracts/testing.md#independent-expectations Literal lowered/cached-marker/one/two outputs, one cached JavaScript file and unchanged metadata are independent authored expectations.
 * @evidence contracts/testing.md#distinguishing-cases Explicit/default placement, cached marker versus same-byte executable rewrite, and changed-between-read-and-emit versus restored original source remain separate.
 * @evidence contracts/testing.md#execution-ownership The discoverable canonical parent supplies authored maps and the actual published artifact; these callbacks call only the provided actual owning launcher path.
 * @evidence contracts/e2e.md#necessary-boundary A real compiler-read timing edit and later served output cannot be established from stable source or identity units alone.
 * @evidence contracts/e2e.md#shared-execution Three profiles share one consumer root and one parent-owned artifact, retaining seven host requests and their incompatible cache authority.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Call-local environment selects tool/cache authority. No process globals change; edits occur only after ordinary completion and actual caches remain warm where required.
 * @evidence contracts/e2e.md#preserved-coverage The original placement, compiler identity and source-race assertions remain individually collected; publication success remains the publisher separate responsibility.
 */
export function canonicalCommonJsOrphanProfiles(
  inputs: { placement: Files; identity: Files; race: Files },
  raceCompiler: string | undefined,
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
    {
      name: "orphan-source-race",
      files: inputs.race,
      run(root, persistent, spawn): void {
        const failures: unknown[] = [];
        // The producer's actual publication/build status is a separate owning
        // native assertion. Existence alone does not replace that assertion.
        if (raceCompiler === undefined)
          throw new Error(
            "BLOCKED: canonical source publisher produced no race compiler artifact",
          );
        assert.equal(fs.statSync(raceCompiler).isFile(), true);
        const orphan = path.join(root, "node_modules", "rawpkg", "index.ts");
        const env = {
          ORPHAN_RACE_COMPILER: TestProject.TSGO_BINARY,
          ORPHAN_RACE_DONE: path.join(persistent, "source-race-done"),
          ORPHAN_RACE_SOURCE: orphan,
          TTSC_CACHE_DIR: path.join(persistent, "source-race-cache"),
          TTSC_TSGO_BINARY: raceCompiler,
        };
        assert.equal(fs.existsSync(env.ORPHAN_RACE_DONE), false);
        const run = () =>
          spawn(TestProject.TTSX_BIN, ["--cwd", root, "src/main.ts"], {
            cwd: root,
            env,
          });
        const first = run();
        if (first) {
          collect(failures, () => assert.equal(first.status, 0, first.stderr));
          collect(failures, () =>
            assert.equal(
              first.stdout.trim(),
              "two",
              "the emit read the rewritten source",
            ),
          );
        }
        collect(failures, () => {
          joined(first);
          fs.writeFileSync(
            orphan,
            'export const value: string = "one";\n',
            "utf8",
          );
        });
        const second = run();
        if (second) {
          collect(failures, () =>
            assert.equal(second.status, 0, second.stderr),
          );
          collect(failures, () =>
            assert.equal(
              second.stdout.trim(),
              "one",
              "the key of the first bytes served the lowering of other bytes",
            ),
          );
        }
        publishFailures("orphan source race", failures);
      },
    },
  ];
}

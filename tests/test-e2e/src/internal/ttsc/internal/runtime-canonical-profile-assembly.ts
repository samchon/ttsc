import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { isOrdinarilyClosedReadonlyLauncher } from "../../../../../utils/src/isOrdinarilyClosedReadonlyLauncher";

type Receipt = ReturnType<typeof TestProject.spawn>;
type Files = Readonly<Record<string, string>>;
type Profile = {
  name: string;
  files: Files;
  // The actual owning body supplies literal assertions and genuine commands.
  // An emission prediction or metadata simulator is not an admissible body.
  run(root: string, persistent: string, spawn: typeof TestProject.spawn, ownAsyncProcess: () => () => void): void | Promise<void>;
};

/**
 * Runs supplied owning runtime profiles sequentially in one already joined
 * canonical consumer root. The original graph is held by shallow rename and
 * exact authored inputs select each profile. Ordinary launcher metadata permits
 * transitions; uncertain launches retain current and held inputs through the
 * actual tracked allocation owner. This does not infer kernel liveness or
 * native descendant counts.
 *
 * @evidence contracts/common.md#principled-implementation Actual synchronous launcher receipts and owning async join acknowledgments gate graph transitions; uncertainty blocks later requests and restores no active input. The shared classifier supplies metadata authority only.
 * @evidence contracts/common.md#clear-and-simple-design One assembler stages supplied authored maps and invokes owning callbacks; real TestProject.spawn and retainTemporaryDirectory own process launch and allocation retention.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No simulated host, output, permission failure or cache identity replaces actual operations. The reserved invocation-owned holding namespace cannot be supplied as an active profile input.
 * @evidence contracts/common.md#meaningful-documentation Documents shallow original ownership, independent profile callbacks, ordinary nonzero completion and retained uncertainty.
 * @evidence contracts/portability.md#os-neutral-implementation Native realpath/rename/wx files bound operations to the owned root; path containment does not assume filesystem case rules.
 * @evidence contracts/performance.md#efficient-algorithms Writing C authored bytes and inspecting E top-level entries and B path characters has O(C+E+B) assembly work, excluding each callback native compilation and snapshot cost.
 * @evidence contracts/performance.md#reuse-equivalent-work One already allocated consumer root is borrowed; different original configurations and all nineteen logical requests remain separate actual work.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Completed profiles preserve their observed entries. Unknown results latch before another request or move and transfer the exact lexical allocation out of exit cleanup; failed preservation or restoration stops later moves.
 * @evidence contracts/testing.md#behavioral-verification The parent invokes each actual profile callback and observes returned failures and safe cleanup authority; this assembler supplies no guessed native result.
 * @evidence contracts/testing.md#independent-expectations Authored profile maps and callback literals determine correctness independently; the holding directory carries only this invocation state and is excluded from active-profile oracles.
 * @evidence contracts/testing.md#distinguishing-cases Ordinary status zero and negative exits permit independent later profiles; error, null status, signal and invalid process identity retain inputs. Collision and staged-move failures remain failures.
 * @evidence contracts/testing.md#execution-ownership The existing discoverable CommonJS corpus owns callers, authored maps and native launch lifetimes. This exported helper allocates no replacement consumer or hidden test host.
 * @evidence contracts/e2e.md#necessary-boundary Native compilation, runtime loading and output ownership must pass through real launchers; source metadata classification alone cannot prove those connections.
 * @evidence contracts/e2e.md#shared-execution The default parent supplies ten former consumer allocations and nineteen original requests; consolidated selection adds five response-file decorator profiles/five requests and up to seventy-eight language profiles/one hundred twenty-five public-worker requests plus two bounded departed-owner setup sequences (the compiler-wrapper profile retains its original POSIX-only selection) on the same root. Programs and nested children await independent measurement, not inference from callback totals.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Shallow holding removes prior profile config/cache aliases from active authority. Unknown processes or unacknowledged owning async joins keep the current graph and held originals without restoring or deleting inputs.
 * @evidence contracts/e2e.md#preserved-coverage Each owning callback retains its original literal assertions and failure identity; the assembler does not replace compiler, source-race, map or output evidence.
 */
export async function runCanonicalRuntimeProfiles(
  lexicalRoot: string,
  profiles: readonly Profile[],
): Promise<{ failures: Error[]; phases: string[]; safeForCleanup: boolean }> {
  assert.equal(
    new Set(profiles.map((profile) => profile.name)).size,
    profiles.length,
    "profile names must be unique",
  );
  const root = fs.realpathSync.native(lexicalRoot);
  assert.notEqual(root, path.parse(root).root);
  const holding = path.join(root, "runtime-profile-holding");
  assert.equal(
    fs.existsSync(holding),
    false,
    "fresh assembly namespace required",
  );
  fs.mkdirSync(holding);
  const original = path.join(holding, "original");
  const observed = path.join(holding, "observed");
  const persistent = path.join(holding, "persistent");
  for (const directory of [original, observed, persistent])
    fs.mkdirSync(directory);
  const failures: Error[] = [];
  const phases: string[] = [];
  let safeForCleanup = true;
  const owningPath = (relative: string): string => {
    const absolute = path.resolve(root, relative);
    const membership = path.relative(root, absolute);
    assert.ok(
      membership !== "" &&
        membership !== ".." &&
        !membership.startsWith(".." + path.sep) &&
        !path.isAbsolute(membership),
    );
    assert.notEqual(membership.split(path.sep)[0], path.basename(holding));
    return absolute;
  };
  // Exact profile staging holds every prior top-level canonical entry, including
  // output/cache aliases, so none can mask an original profile population.
  // The reserved holding namespace remains outside each active-profile oracle.
  for (const profile of profiles) {
    assert.match(profile.name, /^[a-zA-Z0-9_-]+$/);
    for (const relative of Object.keys(profile.files)) {
      owningPath(relative);
    }
  }
  const moved: string[] = [];
  const move = (from: string, to: string): void => {
    try {
      fs.lstatSync(to);
      assert.fail("move destination already exists, including a dangling link");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    fs.renameSync(from, to);
  };
  try {
    for (const name of fs
      .readdirSync(root)
      .filter((entry) => entry !== path.basename(holding))) {
      const input = owningPath(name);
      // lstat detects an existing dangling symlink as an owned top-level entry.
      try {
        fs.lstatSync(input);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
        throw error;
      }
      move(input, path.join(original, name));
      moved.push(name);
    }
    const stable = new Set(fs.readdirSync(root));
    for (const profile of profiles) {
      if (!safeForCleanup) {
        failures.push(
          new Error("BLOCKED: unresolved previous host " + profile.name),
        );
        continue;
      }
      const destination = path.join(observed, profile.name);
      fs.mkdirSync(destination);
      try {
        for (const [relative, bytes] of Object.entries(profile.files)) {
          const file = owningPath(relative);
          fs.mkdirSync(path.dirname(file), { recursive: true });
          // Exclusive file creation forbids overwriting staged aliases/files.
          fs.writeFileSync(file, bytes, { encoding: "utf8", flag: "wx" });
        }
        phases.push(profile.name);
        const spawn: typeof TestProject.spawn = (command, args, options) => {
          assert.equal(
            safeForCleanup,
            true,
            "BLOCKED: previous request has uncertain launcher metadata",
          );
          // Latch before the actual call: a thrown launch has no usable receipt.
          safeForCleanup = false;
          let receipt: Receipt;
          try {
            receipt = TestProject.spawn(command, args, options);
          } catch (cause) {
            failures.push(
              new Error("Unresolved native request " + profile.name, { cause }),
            );
            throw cause;
          }
          safeForCleanup = isOrdinarilyClosedReadonlyLauncher(receipt);
          if (!safeForCleanup) {
            const failure = new Error(
              "Unresolved native request " + profile.name,
              {
                cause:
                  receipt.error ??
                  new Error(
                    JSON.stringify({
                      status: receipt.status,
                      signal: receipt.signal,
                      pid: receipt.pid,
                    }),
                  ),
              },
            );
            failures.push(failure);
            throw failure;
          }
          return receipt;
        };
        let pendingOwnedProcesses = 0;
        const ownAsyncProcess = (): (() => void) => {
          assert.equal(safeForCleanup, true, "BLOCKED: previous request has uncertain launcher metadata");
          pendingOwnedProcesses++;
          let joined = false;
          return () => {
            assert.equal(joined, false, "owned process join must be acknowledged once");
            joined = true;
            pendingOwnedProcesses--;
          };
        };
        try {
          await profile.run(root, persistent, spawn, ownAsyncProcess);
        } finally {
          // A callback acknowledges only its real owned join. Failure or absence
          // of that acknowledgment retains the exact live input graph.
          if (pendingOwnedProcesses !== 0) safeForCleanup = false;
        }
      } catch (cause) {
        failures.push(new Error("Runtime profile " + profile.name, { cause }));
      } finally {
        // Unknown descendants retain their exact source/cache view. Normal
        // nonzero application exits still permit independent later profiles.
        if (safeForCleanup) {
          for (const name of fs.readdirSync(root)) {
            if (stable.has(name)) continue;
            try {
              move(owningPath(name), path.join(destination, name));
            } catch (cause) {
              safeForCleanup = false;
              failures.push(new Error("Preserve profile " + name, { cause }));
              break;
            }
          }
        }
      }
    }
  } catch (cause) {
    failures.push(
      new Error("Canonical runtime profile prerequisite", { cause }),
    );
  } finally {
    if (safeForCleanup) {
      for (const name of moved) {
        try {
          move(path.join(original, name), owningPath(name));
        } catch (cause) {
          safeForCleanup = false;
          failures.push(
            new Error("Restore canonical input " + name, { cause }),
          );
          break;
        }
      }
    }
  }
  if (!safeForCleanup) {
    try {
      TestProject.retainTemporaryDirectory(
        lexicalRoot,
        "unresolved canonical runtime profile inputs",
      );
    } catch (cause) {
      failures.push(
        new Error("Retain canonical runtime profile inputs", { cause }),
      );
    }
  }
  return { failures, phases, safeForCleanup };
}

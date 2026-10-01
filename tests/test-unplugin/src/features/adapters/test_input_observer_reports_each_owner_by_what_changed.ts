import { TestProject } from "../../../../utils/src/TestProject";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import type { InputObserverChange } from "../../../../../packages/unplugin/src/core/observer/InputObserverChange";
import { createInputObserver } from "../../../../../packages/unplugin/src/core/observer/createInputObserver";
import { projectMembershipDigest } from "../../../../../packages/unplugin/src/core/transform/project/projectMembershipDigest";
import { walkProjectInputs } from "../../../../../packages/unplugin/src/core/transform/project/walkProjectInputs";
import type { TtscWatchInput } from "../../../../../packages/unplugin/src/core/transform/watch/TtscWatchInput";
import { readProjectMembershipPolicy } from "../../../../../packages/unplugin/src/core/tsconfig/readProjectMembershipPolicy";

/**
 * Verifies the input observer tells its owner which owners' inputs changed, and
 * each owner once, by what changed (samchon/ttsc#1485).
 *
 * The Vite dev server and a watching build's bridge share one observer of
 * compiler inputs. The bridge used to reach it by posing as a Vite dev server
 * whose module graph mapped each record to a fabricated module node, so the
 * observer's verdict only reached a record through a lookup keyed by a
 * rewritten spelling of it. The observer now reports owners directly: `reload`
 * names an owner an input of which changed, `invalidate` one whose project only
 * gained or lost a root file, and an owner with both is reloaded, which covers
 * the invalidation.
 *
 * 1. Register an owner before the observer opens, open it, change the input, and
 *    assert nothing is reported: no root anchored the owner yet.
 * 2. Register an owner of a file, one of the project's membership, and one of
 *    both; change the file, and assert the file's owners are reloaded.
 * 3. Add a root file to the project, and assert the membership's owners are
 *    invalidated.
 * 4. Register all three again, then change the file and add another root file in
 *    the same batch, and assert one report reloads the file's owners and
 *    invalidates only the membership's owner that is not reloaded.
 * @evidence contracts/testing.md#behavioral-verification
 *   Authored createInputObserver receives injected notification operations and fixture file/membership proofs; assertions distinguish reload owners from membership-only invalidation owners and coalesce both into one report.
 * @evidence contracts/testing.md#independent-expectations
 *   The observer contract requires content owners to reload and root-membership owners to invalidate, with reload covering invalidation for the same owner. Literal owner arrays define those independent expectations.
 * @evidence contracts/testing.md#distinguishing-cases
 *   Covers pre-open registration, quiet unchanged state, content-only change, membership-only change and both in one flush, including one owner subscribing to both kinds.
 * @evidence contracts/testing.md#execution-ownership
 *   test_input_observer_reports_each_owner_by_what_changed calls createInputObserver.open/replace with an injected watch/poll seam and drives change/rename events by hand against four owners (unopened, file, membership, both) over a real temporary project; it owns every flush report and disposes the observer in a finally block. No native watcher or process starts.
 */
export async function test_input_observer_reports_each_owner_by_what_changed(): Promise<void> {
  const root = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-input-observer-owners-"),
  );
  TestProject.writeFiles(root, {
    "src/main.ts": "export const value = 1;\n",
    "tsconfig.json": JSON.stringify({ include: ["src"] }),
  });
  const at = (...segments: string[]): string => path.join(root, ...segments);
  const policy = readProjectMembershipPolicy(at("tsconfig.json"));
  const membership = (): TtscWatchInput => {
    const walked = walkProjectInputs(root, undefined, policy);
    return {
      evidence: {
        identity: root,
        missing: false,
        state: {
          codec: "membership",
          digest: projectMembershipDigest(policy, walked.directories),
          directories: walked.directories.map((directory) => directory.path),
          policy,
        },
      },
      file: root,
    };
  };
  const source: TtscWatchInput = { file: at("src", "main.ts") };
  const owners = {
    both: path.resolve(root, "owners", "both"),
    file: path.resolve(root, "owners", "file"),
    membership: path.resolve(root, "owners", "membership"),
    unopened: path.resolve(root, "owners", "unopened"),
  };

  const reports: { invalidate: string[]; reload: string[] }[] = [];
  let emit: ((eventType: string, file: string | null) => void) | undefined;
  const observer = createInputObserver(
    ({ invalidate, reload }: InputObserverChange) =>
      reports.push({
        invalidate: [...invalidate].sort(),
        reload: [...reload].sort(),
      }),
    {
      poll: () => ({ close: () => undefined }),
      watch: (_scope, listener) => {
        emit = listener;
        return { close: () => undefined };
      },
    },
  );
  /** Let the observer's flush run, then take what it reported. */
  const settled = async () => {
    await new Promise((resolve) => setTimeout(resolve, 30));
    return reports.splice(0);
  };
  try {
    // 1. Nothing is observed before the observer opens.
    observer.replace(owners.unopened, [source]);
    observer.open(root, false);
    fs.writeFileSync(at("src", "main.ts"), "export const value = 2;\n");
    emit?.("change", at("src", "main.ts"));
    assert.deepEqual(await settled(), [], "an owner before the open");

    // 2. A changed input reloads its owners.
    const register = (): void => {
      observer.replace(owners.file, [source]);
      observer.replace(owners.membership, [membership()]);
      observer.replace(owners.both, [source, membership()]);
    };
    register();
    assert.deepEqual(await settled(), [], "an unchanged project is quiet");
    fs.writeFileSync(at("src", "main.ts"), "export const value = 3;\n");
    emit?.("change", at("src", "main.ts"));
    assert.deepEqual(await settled(), [
      { invalidate: [], reload: [owners.both, owners.file].sort() },
    ]);

    // 3. A new root file invalidates the membership's owners.
    fs.writeFileSync(at("src", "extra.ts"), "export {};\n");
    emit?.("rename", at("src", "extra.ts"));
    assert.deepEqual(await settled(), [
      { invalidate: [owners.both, owners.membership].sort(), reload: [] },
    ]);

    // 4. One batch with both: an owner is reported once, reloaded.
    register();
    assert.deepEqual(await settled(), []);
    fs.writeFileSync(at("src", "main.ts"), "export const value = 4;\n");
    fs.writeFileSync(at("src", "another.ts"), "export {};\n");
    emit?.("change", at("src", "main.ts"));
    emit?.("rename", at("src", "another.ts"));
    assert.deepEqual(await settled(), [
      {
        invalidate: [owners.membership],
        reload: [owners.both, owners.file].sort(),
      },
    ]);
  } finally {
    await observer.dispose();
  }
}

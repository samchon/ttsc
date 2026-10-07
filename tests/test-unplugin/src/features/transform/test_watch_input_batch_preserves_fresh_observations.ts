import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../packages/unplugin/src/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import { captureWatchInputBaselines } from "../../../../../packages/unplugin/src/core/transform/watch/captureWatchInputBaselines";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Batch proof must reread bytes and native namespace facts in both phases. Real
 * files contrast stable BOM codecs with content, kind and link changes;
 * explicit capability wrappers count actual reads without replacing fs APIs.
 *
 * @evidence contracts/testing.md#behavioral-verification The actual batch capture reads real temporary files and directory links. Assertions require current raw/compiler hashes, independent phase reads, namespace sharing, per-input rejection and fresh later invocations.
 * @evidence contracts/testing.md#independent-expectations SHA-256 of literal raw BOM bytes and decoded text defines the codec oracle. Authored filesystem mutations define which paths must decline; query counts distinguish two phases from repeated sibling probes or historical reuse without asserting elapsed time.
 * @evidence contracts/testing.md#distinguishing-cases Empty and duplicate selections, stable missing siblings, BOM text, directory kind, read failure, content replacement, missing creation, deletion/recreation, and a retargeted directory link cover batch boundaries. A changed sibling cannot reject the stable sibling; a later call must observe the new state.
 * @evidence contracts/testing.md#execution-ownership A source unit uses the supported filesystem operation table over TestProject files. It invokes no compiler, native build, host or process, and retains no watcher or timer; the fixture owner cleans temporary files.
 */
export function test_watch_input_batch_preserves_fresh_observations(): void {
  const root = TestProject.createProject({
    "stable.ts": "stable",
    "changing.ts": "before",
    "left/input.ts": "same",
    "right/input.ts": "same",
  });
  const stable = path.join(root, "stable.ts");
  const changing = path.join(root, "changing.ts");
  const missing = path.join(root, "missing.ts");
  const bom = Buffer.from([0xfe, 0xff, 0, 0x41, 0]);
  fs.writeFileSync(stable, bom);
  const digest = (bytes: string | Buffer): string =>
    createHash("sha256").update(bytes).digest("hex");
  let reads = 0;
  let policies = 0;
  const view = {
    ...DEFAULT_FILESYSTEM_OPERATIONS,
    caseSensitive: () => {
      ++policies;
      return true;
    },
    readFile: (file: string) => {
      ++reads;
      return fs.readFileSync(file);
    },
  };
  assert.equal(captureWatchInputBaselines([], view).size, 0);
  const stableBatch = captureWatchInputBaselines(
    [stable, stable, missing],
    view,
  );
  assert.equal(stableBatch.size, 2);
  assert.equal(reads, 4, "both unique inputs are actually read in each phase");
  assert.equal(stableBatch.get(stable)?.hostHash, digest(bom));
  assert.equal(stableBatch.get(stable)?.graphReadHash, digest("A"));
  assert.equal(stableBatch.get(missing)?.stat, "missing");
  const firstPolicies = policies;
  captureWatchInputBaselines([stable, missing], view);
  assert.equal(
    policies,
    firstPolicies * 2,
    "a later batch cannot borrow native case observations",
  );

  const absent = Array.from({ length: 20 }, (_, i) =>
    path.join(root, "unresolved", "nested", `absent-${i}.ts`),
  );
  policies = 0;
  const absentBatch = captureWatchInputBaselines(absent, view);
  assert.ok(
    [...absentBatch.values()].every((value) => value?.stat === "missing"),
  );
  assert.equal(
    policies,
    2,
    "one shared directory policy per independent phase",
  );

  const upper = path.join(root, "MissingUpper.ts");
  const lower = path.join(root, "missingupper.ts");
  for (const sensitive of [true, undefined, false]) {
    const cases = captureWatchInputBaselines([upper, lower], {
      ...view,
      caseSensitive: () => sensitive,
    });
    assert.equal(
      cases.get(upper)?.identity === cases.get(lower)?.identity,
      sensitive === false,
      "only observed insensitive policy can merge missing case variants",
    );
  }
  const mixed = path.join(root, "MissingMixedCase.ts");
  let mixedReads = 0;
  assert.equal(
    captureWatchInputBaselines([mixed], {
      ...view,
      caseSensitive: () => (mixedReads < 2 ? false : true),
      readFile: (file: string) => {
        ++mixedReads;
        return fs.readFileSync(file);
      },
    }).get(mixed),
    undefined,
    "the second phase must reacquire changed case authority",
  );

  for (const transition of [
    "content",
    "create",
    "recreate",
    "delete",
  ] as const) {
    const file = transition === "create" ? missing : changing;
    if (transition === "create") fs.rmSync(file, { force: true });
    else fs.writeFileSync(file, "before");
    let count = 0;
    const mutated = captureWatchInputBaselines([file, stable], {
      ...view,
      readFile: (location: string) => {
        if (location === file && ++count === 2) {
          if (transition === "delete" || transition === "recreate")
            fs.unlinkSync(file);
          if (transition !== "delete") fs.writeFileSync(file, "after");
        }
        return fs.readFileSync(location);
      },
    });
    assert.equal(mutated.get(file), undefined, transition);
    assert.equal(mutated.get(stable)?.graphReadHash, digest("A"));
    assert.notEqual(
      captureWatchInputBaselines([file], view).get(file),
      undefined,
      "new state can recover",
    );
  }

  const link = path.join(root, "link");
  fs.symlinkSync(
    path.join(root, "left"),
    link,
    process.platform === "win32" ? "junction" : "dir",
  );
  const alias = path.join(link, "input.ts");
  let aliasReads = 0;
  const retargeted = captureWatchInputBaselines([alias, stable], {
    ...view,
    readFile: (file: string) => {
      if (file === alias && ++aliasReads === 2) {
        fs.unlinkSync(link);
        fs.symlinkSync(
          path.join(root, "right"),
          link,
          process.platform === "win32" ? "junction" : "dir",
        );
      }
      return fs.readFileSync(file);
    },
  });
  assert.equal(
    retargeted.get(alias),
    undefined,
    "equal bytes cannot hide a changed physical target",
  );
  assert.notEqual(retargeted.get(stable), undefined);
  const directory = captureWatchInputBaselines([root], view).get(root);
  assert.equal(directory?.stat, "directory");
  assert.equal(directory?.graphReadHash, null);
  const unreadable = captureWatchInputBaselines([stable], {
    ...view,
    readFile: () => {
      throw new Error("read refused");
    },
  }).get(stable);
  assert.equal(unreadable?.fileExists, true);
  assert.equal(unreadable?.graphReadHash, null);
  assert.equal(unreadable?.hostHash, "missing");
}

import { TestProject } from "../../../utils/src/TestProject";
import { unplugin } from "../../../../packages/unplugin/src/core/unplugin";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { membershipRecordDigest } from "../../../../packages/unplugin/src/core/bridge/membershipRecordDigest";
import { projectRecordDigest } from "../../../../packages/unplugin/src/core/bridge/projectRecordDigest";
import { projectRecordFile } from "../../../../packages/unplugin/src/core/bridge/projectRecordFile";
import { readProjectRecordFile } from "../../../../packages/unplugin/src/core/bridge/readProjectRecordFile";
import { writeProjectRecordFile } from "../../../../packages/unplugin/src/core/bridge/writeProjectRecordFile";
import { resolveOptions } from "../../../../packages/unplugin/src/core/options/resolveOptions";
import { rollupDeliveryOptions } from "../../../../packages/unplugin/src/core/rollup/rollupDeliveryOptions";
import { createAliasPaths } from "../../../../packages/unplugin/src/core/transform/alias/createAliasPaths";
import { createHostPathIdentityContext } from "../../../../packages/unplugin/src/core/transform/filesystem/createHostPathIdentityContext";
import { pathIdentityKey } from "../../../../packages/unplugin/src/core/transform/filesystem/pathIdentityKey";
import { hostInputStateHash } from "../../../../packages/unplugin/src/core/transform/inputs/hostInputStateHash";
import { walkProjectInputs } from "../../../../packages/unplugin/src/core/transform/project/walkProjectInputs";
import { readProjectMembershipPolicy } from "../../../../packages/unplugin/src/core/tsconfig/readProjectMembershipPolicy";

/**
 * Verifies a build start proves the project records of its tool directory only
 * for a host whose own cache the adapter cannot answer module by module, and
 * that Rollup proves the record of each project whose module it is about to
 * serve from its cache, once per build (samchon/ttsc#1481).
 *
 * Every build start proved every record of the tool directory, one per tsconfig
 * ever built from that root, and grew with each. The proof exists for a host
 * that restores a module without running the adapter. webpack, Rspack, and Farm
 * do so from caches that say nothing of which projects they hold, and webpack's
 * and Rspack's key a module by neither the tsconfig nor the options it was
 * compiled under, measured, so they prove every record still. Rollup asks
 * before it serves each module from the cache it was handed, which names the
 * module's record (samchon/ttsc#1491), and a dev server keeps no module across
 * a restart.
 *
 * 1. In a root of its own, write the records of two projects whose recorded
 *    declarations were edited since, and assert the build starts of Rollup and
 *    of a Vite dev server without a watcher leave both records where they are.
 * 2. Start Farm, and assert both records moved.
 * 3. Write both records again, start Rollup, and ask whether a module of the first
 *    project it would serve from its cache must run; assert it must, its record
 *    moved and the other's did not, and asking for another module of the same
 *    project proves the record no more.
 *
 * @evidence contracts/testing.md#behavioral-verification unplugin.raw buildStart leaves two stale records untouched for Rollup/Vite serve, refreshes both for Farm, and Rollup cache lookup proves only its named project once.
 * @evidence contracts/testing.md#independent-expectations Literal signal zero/one expectations and independently edited declaration bytes specify which host must prove which record; no cached compiler output generates the oracle.
 * @evidence contracts/testing.md#distinguishing-cases Rollup, Vite serve with watch null and Farm differ by cache ownership; two projects distinguish global proof from per-module proof and repeated same-project lookup.
 * @evidence contracts/testing.md#execution-ownership Calls raw buildStart/configResolved/shouldTransformCachedModule against host doubles and temporary records, restoring cwd in finally; no bundler or compiler producer runs.
 */
export async function test_build_start_proves_records_only_for_a_cache_it_cannot_answer(): Promise<void> {
  const root = fs.realpathSync.native(
    TestProject.tmpdir("ttsc-unplugin-build-start-proof-"),
  );
  const tool = path.join(root, ".ttsc");
  const identities = createHostPathIdentityContext();
  const evidenced = (file: string) => ({
    identity: pathIdentityKey(file, identities),
    missing: false,
    state: { codec: "host" as const, hash: hostInputStateHash(file)! },
  });
  // A project whose record holds its declaration as it was before an edit.
  const project = (name: string) => {
    const directory = path.join(root, name);
    TestProject.writeFiles(directory, {
      "src/main.ts": 'import "./types";\nexport {};\n',
      "src/types.d.ts": `declare const ${name}: 1;\n`,
      "tsconfig.json": JSON.stringify({ include: ["src"] }),
    });
    const tsconfig = path.join(directory, "tsconfig.json");
    const declaration = path.join(directory, "src", "types.d.ts");
    const record = projectRecordFile(tool, tsconfig);
    const write = () => {
      fs.writeFileSync(declaration, `declare const ${name}: 1;\n`);
      const policy = readProjectMembershipPolicy(tsconfig);
      const walked = walkProjectInputs(directory, undefined, policy);
      writeProjectRecordFile(record, {
        inputs: {
          [declaration]: evidenced(declaration),
          [tsconfig]: evidenced(tsconfig),
        },
        membership: {
          digest: membershipRecordDigest(policy, walked.directories),
          directories: walked.directories.map((entry) => entry.path),
          policy,
        },
        root: directory,
        signal: 0,
        tsconfig,
      });
      fs.writeFileSync(declaration, `declare const ${name}: 2;\n`);
    };
    write();
    return { directory, record, write };
  };
  const first = project("first");
  const second = project("second");
  const signal = (record: string) => readProjectRecordFile(record)?.signal;
  const rollup = { meta: { rollupVersion: "4", watchMode: false } };

  const cwd = process.cwd();
  process.chdir(root);
  try {
    // 1. Hosts whose caches the adapter answers, or that keep none.
    await unplugin
      .raw(undefined, { framework: "rollup" })
      .buildStart!.call(rollup as never);
    const vite = unplugin.raw(undefined, { framework: "vite" });
    (vite.vite!.configResolved as (config: unknown) => void)({
      command: "serve",
      resolve: { alias: [] },
      root,
      server: { watch: null },
    });
    await vite.buildStart!.call(rollup as never);
    assert.equal(signal(first.record), 0, "Rollup and a dev server prove none");
    assert.equal(signal(second.record), 0);

    // 2. A host with a cache of its own.
    await unplugin.raw(undefined, { framework: "farm" }).buildStart!.call({
      getNativeBuildContext: () => ({ context: {}, framework: "farm" }),
    } as never);
    assert.equal(signal(first.record), 1, "Farm proves every record");
    assert.equal(signal(second.record), 1);

    // 3. Rollup proves a record as it is about to serve its project's module.
    first.write();
    second.write();
    const plugin = unplugin.raw(undefined, { framework: "rollup" });
    await plugin.buildStart!.call(rollup as never);
    const ask = (file: string) =>
      (
        plugin.rollup!.shouldTransformCachedModule as (module: {
          id: string;
          meta: Record<string, unknown>;
        }) => boolean | null
      )({
        id: path.join(first.directory, "src", file),
        meta: {
          [plugin.name]: {
            options: rollupDeliveryOptions(
              resolveOptions(),
              createAliasPaths(undefined),
            ),
            record: {
              digest: projectRecordDigest(fs.readFileSync(first.record)),
              file: first.record,
            },
          },
        },
      });
    assert.equal(ask("main.ts"), true, "a module of a moved project runs");
    assert.equal(signal(first.record), 1, "its record was proven");
    assert.equal(signal(second.record), 0, "the other project's was not");
    assert.equal(
      ask("other.ts"),
      null,
      "a delivery that holds the record's bytes now is served",
    );
    assert.equal(signal(first.record), 1, "and is proven once per build");
  } finally {
    process.chdir(cwd);
  }
}

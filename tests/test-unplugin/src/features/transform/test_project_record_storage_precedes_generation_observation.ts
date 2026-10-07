import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { createHostPathIdentityContext } from "../../../../../packages/unplugin/src/core/transform/filesystem/createHostPathIdentityContext";
import { readProjectRecordFile } from "../../../../../packages/unplugin/src/core/bridge/readProjectRecordFile";
import type { TtscCachedProjectTransform } from "../../../../../packages/unplugin/src/core/transform/cache/TtscCachedProjectTransform";
import { transformFilesystem } from "../../../../../packages/unplugin/src/core/transform/cache/transformFilesystem";
import { nativeInputPredicateMatches } from "../../../../../packages/unplugin/src/core/transform/inputs/nativeInputPredicateMatches";
import { createCachedDeliveryUnitFixture } from "../../internal/transform-project-cache/createCachedDeliveryUnitFixture";
import { observeValidationUnitGeneration } from "../../internal/transform-project-cache/observeValidationUnitGeneration";

/**
 * Record storage is acquired before the coordinator awaits a generation.
 *
 * @evidence contracts/testing.md#behavioral-verification An unresolved supported cache owner receives a real transform delivery; both record parents already exist before settling it. Actual record handoff preserves the independently authored root directory predicate, while a new source member still invalidates it. A blocked primary uses the existing fallback handoff.
 * @evidence contracts/testing.md#independent-expectations Literal src, tsconfig.json, node_modules, .ttsc and .fallback names and directory/file markers define the SHA-256 witness independently of the production listing. Without early acquisition the pre-settle directory assertions fail, and late handoff changes the root witness.
 * @evidence contracts/testing.md#distinguishing-cases Absent storage versus acquired empty parents, primary versus blocked-primary/fallback, unchanged root versus added source, and wrapper bypass versus eligible delivery retain distinct outcomes.
 * @evidence contracts/testing.md#execution-ownership Actual filesystem acquisition, transform coordinator, directory predicate replay and record writer run in process on one temporary corpus. The unresolved cache value is supported authored consumer input; no compiler, child, native capture count or installed adapter is simulated. The existing full Metro E2E owns two-worker native single-execution and adoption.
 */
export async function test_project_record_storage_precedes_generation_observation(): Promise<void> {
  const fixture = createCachedDeliveryUnitFixture();
  const root = fs.realpathSync.native(path.dirname(path.dirname(fixture.file)));
  // The POSIX compiler case-policy observer may populate this default cache.
  // Author its root member before the independent directory witness on all hosts.
  fs.mkdirSync(path.join(root, "node_modules"), { recursive: true });
  const primary = path.join(root, ".ttsc");
  const fallback = path.join(root, ".fallback");
  const records: string[] = [];
  let settle!: (value: TtscCachedProjectTransform) => void;
  const owner = new Promise<TtscCachedProjectTransform>((resolve) => {
    settle = resolve;
  });
  fixture.cache.set(fixture.key, owner);
  const project = {
    toolDirectory: primary,
    fallbackToolDirectory: fallback,
    watching: true,
    register: ({ record }: { record: string }): void => {
      records.push(record);
    },
  };
  try {
    const bypassStorage = path.join(root, "bypassed");
    assert.equal(
      await fixture.api.transformTtsc(
        fixture.file + "?raw", fixture.source, fixture.options, undefined,
        fixture.cache, { project: { ...project, toolDirectory: bypassStorage } },
      ),
      undefined,
    );
    assert.equal(fs.existsSync(bypassStorage), false);
    assert.equal(fs.existsSync(fallback), false);
    const delivery = fixture.api.transformTtsc(
      fixture.file, fixture.source, fixture.options, undefined,
      fixture.cache, { project },
    );
    // Before the first await can settle, all accepted parent locations exist.
    assert.equal(fs.statSync(path.join(primary, "records")).isDirectory(), true);
    assert.equal(fs.statSync(path.join(fallback, "records")).isDirectory(), true);
    assert.deepEqual(fs.readdirSync(path.join(primary, "records")), []);
    assert.deepEqual(fs.readdirSync(path.join(fallback, "records")), []);
    assert.equal(fixture.cache.get(fixture.key), owner);
    const filesystem = transformFilesystem(fixture.cache);
    const identities = createHostPathIdentityContext(filesystem);
    const rootMembers = [".fallback", ".ttsc", "node_modules", "src", "tsconfig.json"];
    assert.deepEqual(fs.readdirSync(root).sort(), rootMembers);
    const predicate = {
      version: 1 as const,
      kind: "directory" as const,
      scope: "watch" as const,
      realpath: root,
      identityStable: true,
      digest: createHash("sha256")
        .update(".fallback\0directory\0\0.ttsc\0directory\0\0node_modules\0directory\0\0src\0directory\0\0tsconfig.json\0file\0")
        .digest("hex"),
    };
    assert.equal(nativeInputPredicateMatches(root, predicate, filesystem, identities), true);
    const observed = observeValidationUnitGeneration(root, fixture.good.result);
    assert.deepEqual(fs.readdirSync(root).sort(), rootMembers);
    assert.equal(nativeInputPredicateMatches(root, predicate, filesystem, identities), true);
    settle(observed);
    assert.equal((await delivery)?.code, fixture.code);
    assert.equal(fixture.cache.get(fixture.key), owner);
    assert.equal(records.length, 1);
    assert.equal(path.dirname(records[0]!), path.join(primary, "records"));
    assert.ok(readProjectRecordFile(records[0]!));
    assert.deepEqual(fs.readdirSync(root).sort(), rootMembers);
    assert.equal(nativeInputPredicateMatches(root, predicate, filesystem, identities), true);
    const added = path.join(root, "added.ts");
    fs.writeFileSync(added, "export {};\n");
    assert.equal(nativeInputPredicateMatches(root, predicate, filesystem, identities), false);
    fs.unlinkSync(added);
    assert.equal(nativeInputPredicateMatches(root, predicate, filesystem, identities), true);
    const blocked = path.join(fallback, "blocked-record-storage");
    fs.writeFileSync(blocked, "not a directory\n");
    assert.equal(
      (await fixture.api.transformTtsc(
        fixture.file, fixture.source, fixture.options, undefined,
        fixture.cache, { project: { ...project, toolDirectory: blocked } },
      ))?.code,
      fixture.code,
    );
    assert.equal(records.length, 2);
    assert.equal(path.dirname(records[1]!), path.join(fallback, "records"));
    assert.ok(readProjectRecordFile(records[1]!));
    assert.equal(fs.readFileSync(blocked, "utf8"), "not a directory\n");
  } finally {
    settle(fixture.good);
    fixture.dispose();
  }
}

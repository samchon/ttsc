import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { ITtscCompilerTransformation } from "ttsc";

import { DEFAULT_FILESYSTEM_OPERATIONS } from "../../../../../packages/unplugin/src/core/transform/filesystem/DEFAULT_FILESYSTEM_OPERATIONS";
import { captureWatchInputBaseline } from "../../../../../packages/unplugin/src/core/transform/watch/captureWatchInputBaseline";
import { isWatchInputKeyBaseline } from "../../../../../packages/unplugin/src/core/transform/watch/isWatchInputKeyBaseline";
import { watchInputEvidenceMatchesBaseline } from "../../../../../packages/unplugin/src/core/transform/watch/watchInputEvidenceMatchesBaseline";

/**
 * Keep native byte predicates distinct from ordinary and compiler observations.
 *
 * 1. Capture every native kind and compare independently authored codec bytes.
 * 2. Refuse unrequested, unstable, conflicting and malformed native evidence.
 * 3. Recapture content, directory membership, entry-kind and absence changes.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls actual broad capture, persisted-baseline guard and generation comparison over owned filesystem paths, including all four native kinds and both valid scopes.
 * @evidence contracts/testing.md#independent-expectations Authored raw buffers and literal version-one framing establish expected SHA256 values; native realpath supplies the independent target coordinate. No digest is copied from the baseline being checked.
 * @evidence contracts/testing.md#distinguishing-cases Contrasts native and compiler text, unrequested fields, both scopes, contradictory same-kind witnesses, unstable identity, unknown version, malformed serialized carriers and four filesystem transitions. Frozen baseline comparison remains independent of later disk reads.
 * @evidence contracts/testing.md#execution-ownership Source unit uses the ordinary loader, owned temporary files and synchronous native filesystem reads only. It starts no compiler, child, installer or native producer; TestProject owns cleanup.
 */
export async function test_native_predicates_survive_key_baselines(): Promise<void> {
  const root = TestProject.tmpdir("ttsc-native-baseline-");
  const file = path.join(root, "raw.ts");
  const directory = path.join(root, "directory");
  const missing = path.join(root, "missing");
  const entry = path.join(root, "entry");
  const bytes = Buffer.from([0xff, 0xfe, 0x41, 0x00]);
  fs.writeFileSync(file, bytes);
  fs.mkdirSync(directory);
  fs.writeFileSync(entry, "entry");
  const sha = (value: string | Buffer): string =>
    createHash("sha256").update(value).digest("hex");
  type Predicate = NonNullable<
    ITtscCompilerTransformation.IInputObservation["nativePredicates"]
  >[number];
  const rows: [string, Predicate["kind"], string][] = [
    [file, "file", sha(bytes)],
    [file, "optional-file", sha(Buffer.concat([Buffer.from("file\0"), bytes]))],
    [file, "entry", sha("file\0")],
    [directory, "directory", sha("")],
    [directory, "entry", sha("directory\0")],
    [directory, "optional-file", sha("missing\0")],
    [missing, "optional-file", sha("missing\0")],
    [missing, "entry", sha("missing\0")],
    [entry, "entry", sha("file\0")],
  ];
  for (const [selected, kind, digest] of rows) {
    const baseline = captureWatchInputBaseline(selected, undefined, {
      nativePredicates: [kind],
    });
    assert.ok(baseline);
    assert.ok(isWatchInputKeyBaseline(baseline));
    const physical = fs.existsSync(selected) ? fs.realpathSync.native(selected) : null;
    assert.deepEqual(baseline.nativePredicates?.[kind], {
      digest,
      realpath: physical,
    });
    const predicate: Predicate = {
      version: 1,
      kind,
      digest,
      realpath: physical,
      identityStable: true,
      scope: "cache",
    };
    const evidence = {
      identity: baseline.identity,
      missing: !baseline.fileExists,
      state: { codec: "predicates" as const, observation: { nativePredicates: [predicate] } },
    };
    const matches = (predicates: Predicate[], against = baseline): boolean =>
      watchInputEvidenceMatchesBaseline(
        { ...evidence, state: { codec: "predicates", observation: { nativePredicates: predicates } } },
        against,
      );
    assert.ok(matches([predicate]));
    assert.ok(matches([{ ...predicate, scope: "watch" }]));
    assert.ok(matches([predicate], JSON.parse(JSON.stringify(baseline))));
    assert.equal(matches([{ ...predicate, identityStable: false }]), false);
    assert.equal(matches([{ ...predicate, digest: sha("other") }]), false);
    assert.equal(matches([{ ...predicate, version: 2 } as unknown as Predicate]), false);
    assert.equal(matches([predicate, { ...predicate, digest: sha("conflict") }]), false);
    assert.equal(matches([{ ...predicate, realpath: root }]), false);
    const ordinary = captureWatchInputBaseline(selected);
    assert.ok(ordinary);
    assert.equal(matches([predicate], ordinary), false);
  }
  const fileBaseline = captureWatchInputBaseline(file, undefined, {
    nativePredicates: ["file", "optional-file", "entry"],
  });
  assert.ok(fileBaseline);
  assert.notEqual(fileBaseline.graphReadHash, fileBaseline.nativePredicates?.file?.digest);
  for (const malformed of [
    {},
    { alien: { digest: sha(""), realpath: root } },
    { file: { digest: "not-a-hash", realpath: root } },
    { file: { digest: sha(""), realpath: "relative" } },
    { file: { digest: sha(""), realpath: root, extra: true } },
    [],
  ]) {
    assert.equal(isWatchInputKeyBaseline({ ...fileBaseline, nativePredicates: malformed }), false);
  }
  fs.writeFileSync(file, Buffer.from([0xff, 0xfe, 0x42, 0x00]));
  fs.writeFileSync(path.join(directory, "appeared"), "member");
  fs.writeFileSync(missing, "present");
  fs.rmSync(entry);
  fs.mkdirSync(entry);
  for (const [selected, kind, digest] of rows) {
    const current = captureWatchInputBaseline(selected, undefined, { nativePredicates: [kind] });
    assert.ok(current);
    const expectedChange =
      (selected === file && kind !== "entry") ||
      (selected === directory && kind === "directory") ||
      selected === missing || selected === entry;
    assert.equal(current.nativePredicates?.[kind]?.digest !== digest, expectedChange);
  }
  assert.equal(
    captureWatchInputBaseline(directory, {
      ...DEFAULT_FILESYSTEM_OPERATIONS,
      platform: "linux",
      readdirRaw: undefined,
    }, { nativePredicates: ["directory"] }),
    undefined,
    "an unavailable native byte-name capability cannot establish listing proof",
  );
  let nativeReads = 0;
  const observeMutation = (): void => {
    if (++nativeReads === 1) {
      fs.writeFileSync(path.join(directory, "between-phases"), "changed");
    }
  };
  const unstable = captureWatchInputBaseline(directory, {
    ...DEFAULT_FILESYSTEM_OPERATIONS,
    readdir(selected) {
      const entries = DEFAULT_FILESYSTEM_OPERATIONS.readdir(selected);
      if (selected === directory) observeMutation();
      return entries;
    },
    readdirRaw(selected) {
      const entries = DEFAULT_FILESYSTEM_OPERATIONS.readdirRaw!(selected);
      if (selected === directory) observeMutation();
      return entries;
    },
  }, { nativePredicates: ["directory"] });
  assert.ok(nativeReads >= 2);
  assert.equal(unstable, undefined, "independent native captures must agree");
}

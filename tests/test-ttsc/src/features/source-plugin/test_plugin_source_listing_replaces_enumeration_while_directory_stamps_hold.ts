import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { PluginContentIdentities } from "../../../../../packages/ttsc/src/plugin/internal/source/PluginContentIdentities";
import { pluginSourceDigest } from "../../../../../packages/ttsc/src/plugin/internal/source/pluginSourceDigest";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies a plugin source record keeps the listing its walk read and replays
 * it instead of enumerating the source tree, only while every listed
 * directory's stamps hold on a device whose directory stamps move.
 *
 * A warm plugin load proved the ttsc package, thousands of files, by listing
 * every directory, seconds per process on Windows (samchon/ttsc#1852). A
 * directory's stamps move when an entry is created, removed or renamed in it,
 * so while they hold the population is the recorded one and only file metadata
 * remains to compare. Corrupting the recorded digest distinguishes reuse from a
 * fresh reading, and counting directory listings below the module
 * distinguishes a replay from a walk.
 *
 * 1. Opening stores admits the module's device once its probe moves a directory's
 *    stamps.
 * 2. A hit records the listing its walk read.
 * 3. A held listing returns the record without listing any directory.
 * 4. A store that has not admitted the device walks, and still reuses by signature.
 * 5. A file added in a nested directory moves that directory's stamps; the proof
 *    walks and reads the content again.
 * 6. Removing that file and setting the directory's modification time back still
 *    leaves its change stamp moved; the proof walks and reads again.
 *
 * @evidence contracts/testing.md#behavioral-verification PluginContentIdentities.open and sourceDirectory run against a real module tree and a real cache root; the returned digest, the record on disk and the native listings the proof issued are the observed behavior.
 * @evidence contracts/testing.md#independent-expectations pluginSourceDigest called with no store is the oracle for every fresh reading, the corrupted literal for a reused record, and a zero listing count for a replay.
 * @evidence contracts/testing.md#distinguishing-cases An unchanged tree replays; an unadmitted device walks yet reuses; a nested addition and a removal whose directory modification time was set back each walk and read again.
 * @evidence contracts/testing.md#execution-ownership The named unit calls the owning source operations directly over a copied package fixture and a private cache root; no Go process or product host runs.
 */
export function test_plugin_source_listing_replaces_enumeration_while_directory_stamps_hold(): void {
  const root = TestProject.physicalPath(
    TestProject.tmpdir("ttsc-source-listing-"),
  );
  const module = path.join(root, "plugin");
  const cache = path.join(root, "cache");
  TestProject.copyDirectory(
    path.join(
      TestProject.WORKSPACE_ROOT,
      "packages",
      "ttsc",
      "test",
      "fixtures",
      "unit",
      "plugincontentidentities_reuses_a_digest_only_while_its_metadata_holds",
      "inputs-1",
    ),
    root,
  );
  for (const parts of [["main.go"], ["internal", "mark", "mark.go"]]) {
    const file = path.join(module, ...parts);
    fs.renameSync(`${file}.txt`, file);
  }
  const device = fs.statSync(module, { bigint: true }).dev;
  const settle = (): void => {
    const past = new Date(Date.now() - 3_600_000);
    for (const file of listFiles(module)) fs.utimesSync(file, past, past);
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 30);
  };
  const open = (): PluginContentIdentities.Store => {
    const store = PluginContentIdentities.open({
      projectRoot: root,
      cacheDir: cache,
      env: {},
    });
    assert.ok(store, "a cache outside the sources opens a store");
    return store;
  };
  /** A store whose device premise is the module's, so each step is decided. */
  const admitted = (): PluginContentIdentities.Store => {
    const store = open();
    return { ...store, listings: new Set([...store.listings, device]) };
  };
  const recordFile = (): string => {
    const directory = path.join(cache, "identities");
    const entries = fs
      .readdirSync(directory)
      .filter((name) => name.endsWith(".json"));
    assert.equal(entries.length, 1, "one directory, one record");
    return path.join(directory, entries[0]!);
  };
  const corrupted = "0".repeat(64);
  const corrupt = (): void => {
    const file = recordFile();
    const entry = JSON.parse(fs.readFileSync(file, "utf8"));
    entry.digest = corrupted;
    fs.writeFileSync(file, JSON.stringify(entry));
  };
  /** The proof's digest and how many directories below the module it listed. */
  const prove = (store: PluginContentIdentities.Store): [string, number] => {
    const original = fs.readdirSync;
    let listings = 0;
    (fs as { readdirSync: unknown }).readdirSync = function (
      this: unknown,
      ...args: unknown[]
    ) {
      if (
        typeof args[0] === "string" &&
        path.resolve(args[0]).startsWith(module)
      )
        listings += 1;
      return (original as (...args: unknown[]) => unknown).apply(this, args);
    };
    try {
      return [PluginContentIdentities.sourceDirectory(store, module), listings];
    } finally {
      fs.readdirSync = original;
    }
  };

  settle();
  let shown = false;
  for (let attempt = 0; attempt < 10 && !shown; attempt += 1)
    shown = open().listings.has(device);
  assert.ok(shown, "a device that moves directory stamps is admitted");

  assert.equal(
    PluginContentIdentities.sourceDirectory(admitted(), module),
    pluginSourceDigest(module),
    "a cold reading records the content digest",
  );
  PluginContentIdentities.sourceDirectory(admitted(), module);
  const listing = JSON.parse(fs.readFileSync(recordFile(), "utf8")).listing;
  assert.ok(listing, "a hit records the listing its walk read");
  assert.deepEqual(
    listing.directories.map(([directory]: [string, string]) => directory),
    ["", "internal", path.join("internal", "mark")],
  );

  corrupt();
  assert.deepEqual(
    prove(admitted()),
    [corrupted, 0],
    "a held listing returns the record without listing a directory",
  );

  const unadmitted = { ...open(), listings: new Set<bigint>() };
  const [walked, walkedListings] = prove(unadmitted);
  assert.equal(walked, corrupted, "an unadmitted device still reuses");
  assert.ok(walkedListings > 0, "an unadmitted device walks");

  const added = path.join(module, "internal", "mark", "added.go");
  fs.writeFileSync(added, "package mark\n");
  settle();
  const [fresh, freshListings] = prove(admitted());
  assert.equal(fresh, pluginSourceDigest(module), "an addition reads again");
  assert.ok(freshListings > 0, "an addition walks");

  corrupt();
  const mark = path.join(module, "internal", "mark");
  const stamps = fs.statSync(mark);
  fs.unlinkSync(added);
  fs.utimesSync(mark, stamps.atime, stamps.mtime);
  settle();
  const [restored, restoredListings] = prove(admitted());
  assert.equal(
    restored,
    pluginSourceDigest(module),
    "a modification time set back does not hide a removal",
  );
  assert.ok(restoredListings > 0, "a modification time set back walks");
}

function listFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const location = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(location) : [location];
  });
}

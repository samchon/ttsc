import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { PluginContentIdentities } from "../../../../../packages/ttsc/src/plugin/internal/source/PluginContentIdentities";
import { pluginSourceDigest } from "../../../../../packages/ttsc/src/plugin/internal/source/pluginSourceDigest";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies a recorded source digest stands for the bytes only while their
 * metadata holds and every stamp is separable from a freshly minted reference.
 *
 * Every launch is a new process, so the record store is what spares a warm load
 * from reading every plugin source byte (#1722). A record that outlived an edit
 * would key a binary on stale sources, so each way content can change must
 * reread. Corrupting only the recorded digest distinguishes reuse from a fresh
 * reading: a reused record returns the corrupted value, a fresh one does not.
 *
 * 1. Record a module's digest, corrupt it, and reopen the store as a new process
 *    would; unchanged separable metadata must return the record.
 * 2. Rewrite identical bytes, edit, add, rename and remove files; each must read
 *    the content again and match an independent digest.
 * 3. Give a file a stamp the reference cannot separate; the record must be neither
 *    trusted nor rewritten.
 * 4. Refuse a store whose root lies inside a plugin source.
 * 5. Reuse one private temporary-volume reference directory across stores, so
 *    opening a store never adds or removes an entry of the temporary directory,
 *    whose metadata signs every missing path below it.
 *
 * @evidence contracts/testing.md#behavioral-verification PluginContentIdentities.open and sourceDirectory run against a real module directory and a real cache root; the observable result is the returned digest and the record file on disk.
 * @evidence contracts/testing.md#independent-expectations pluginSourceDigest called directly, with no store, is the independent oracle for every fresh reading; the corrupted literal digest is the oracle for a reused record.
 * @evidence contracts/testing.md#distinguishing-cases Unchanged separable metadata reuses; identical-byte rewrite, content edit, addition, rename and deletion reread; an unseparable stamp neither reuses nor records; a cache root inside the source refuses the store; a second store reuses the first one's private temporary-volume reference directory. Executable and GOROOT records share digest and are covered by their own units and the E2E warm-load budget.
 * @evidence contracts/testing.md#execution-ownership The named unit calls the owning source operations directly over a copied package fixture and a private cache root; no Go process, native build or product host runs.
 */
export function test_plugincontentidentities_reuses_a_digest_only_while_its_metadata_holds(): void {
  const root = TestProject.physicalPath(
    TestProject.tmpdir("ttsc-content-identities-"),
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
  const settle = (): void => {
    const past = new Date(Date.now() - 3_600_000);
    for (const file of listFiles(module)) fs.utimesSync(file, past, past);
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
  const record = (): string => {
    const directory = path.join(cache, "identities");
    const entries = fs
      .readdirSync(directory)
      .filter((name) => name.endsWith(".json"));
    assert.equal(entries.length, 1, "one directory, one record");
    return path.join(directory, entries[0]!);
  };
  // The corrupted value can already be in place: a reused record is never
  // rewritten, so the step after a reuse finds the previous corruption.
  const corrupted = "0".repeat(64);
  assert.notEqual(pluginSourceDigest(module), corrupted);
  const corrupt = (): string => {
    const file = record();
    const entry = JSON.parse(fs.readFileSync(file, "utf8")) as {
      digest: string;
    };
    entry.digest = corrupted;
    fs.writeFileSync(file, JSON.stringify(entry));
    return corrupted;
  };
  const failures: unknown[] = [];
  const verify = (name: string, run: () => void): void => {
    try {
      run();
    } catch (cause) {
      failures.push(new Error(name, { cause }));
    }
  };

  settle();
  verify("a cold reading records the content digest", () => {
    assert.equal(
      PluginContentIdentities.sourceDirectory(open(), module),
      pluginSourceDigest(module),
    );
    assert.ok(fs.existsSync(record()));
  });
  verify("unchanged separable metadata returns the record", () => {
    const corrupted = corrupt();
    assert.equal(
      PluginContentIdentities.sourceDirectory(open(), module),
      corrupted,
    );
  });

  const main = path.join(module, "main.go");
  const mark = path.join(module, "internal", "mark", "mark.go");
  const added = path.join(module, "internal", "mark", "added.go");
  const renamed = path.join(module, "internal", "mark", "renamed.go");
  for (const [name, mutate] of [
    [
      "identical bytes rewritten",
      () => fs.writeFileSync(main, fs.readFileSync(main)),
    ],
    [
      "content edited",
      () => fs.writeFileSync(mark, 'package mark\n\nconst Marker = "bravo"\n'),
    ],
    ["file added", () => fs.writeFileSync(added, "package mark\n")],
    ["file renamed", () => fs.renameSync(added, renamed)],
    ["file removed", () => fs.unlinkSync(renamed)],
  ] as const) {
    verify(name, () => {
      corrupt();
      mutate();
      settle();
      assert.equal(
        PluginContentIdentities.sourceDirectory(open(), module),
        pluginSourceDigest(module),
        `${name} must read the content again`,
      );
    });
  }

  verify("an unseparable stamp is neither trusted nor recorded", () => {
    corrupt();
    const future = new Date(Date.now() + 3_600_000);
    fs.utimesSync(mark, future, future);
    const before = fs.readFileSync(record(), "utf8");
    assert.equal(
      PluginContentIdentities.sourceDirectory(open(), module),
      pluginSourceDigest(module),
    );
    assert.equal(fs.readFileSync(record(), "utf8"), before);
  });

  verify("a cache root inside a plugin source opens no store", () => {
    assert.equal(
      PluginContentIdentities.open({
        projectRoot: root,
        cacheDir: path.join(module, "cache"),
        env: {},
        sources: [module],
      }),
      undefined,
    );
    assert.equal(fs.existsSync(path.join(module, "cache")), false);
  });

  verify("the temporary-volume reference directory is reused", () => {
    const uid =
      typeof process.getuid === "function" ? process.getuid() : undefined;
    const directory = path.join(
      os.tmpdir(),
      uid === undefined
        ? "ttsc-clock-references"
        : `ttsc-clock-references-${uid}`,
    );
    open();
    const first = fs.lstatSync(directory, { bigint: true });
    open();
    const second = fs.lstatSync(directory, { bigint: true });
    assert.equal(first.isDirectory(), true);
    assert.equal(second.ino, first.ino, "the directory is not recreated");
    if (uid !== undefined) assert.equal(first.mode & 0o077n, 0n);
  });

  if (failures.length !== 0)
    throw new AggregateError(failures, "content identity matrix failed");
}

function listFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const location = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(location) : [location];
  });
}

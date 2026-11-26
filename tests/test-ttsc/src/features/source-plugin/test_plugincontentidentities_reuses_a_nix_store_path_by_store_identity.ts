import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { runtimeExecutableIdentity } from "../../../../../packages/ttsc/src/internal/runtimeExecutableIdentity";
import { PluginContentIdentities } from "../../../../../packages/ttsc/src/plugin/internal/source/PluginContentIdentities";
import { pluginSourceDigest } from "../../../../../packages/ttsc/src/plugin/internal/source/pluginSourceDigest";
import { TestProject } from "../../../../utils/src/TestProject";

/**
 * Verifies a Nix store path proves its content identity by its store path and
 * top-directory identity rather than walking or rereading its files, while
 * rejecting look-alikes, replacements, retargeted links and unconfined kinds.
 *
 * A Nix store volume often has no clock reference, and a warm launch must not
 * reread thousands of immutable store files. Corrupting only the recorded
 * digest distinguishes reuse from a fresh reading without spies: a reused
 * record returns the corrupted value, and a fresh reading does not.
 *
 * 1. Create a read-only store path owned by the test user under a temporary
 *    `NIX_STORE_DIR` with future file mtimes so metadata separability alone
 *    would read, record its digest, corrupt the record, and verify a reopened
 *    store returns the corrupted digest.
 * 2. Retarget a symlink from one subdirectory of that store path to another and
 *    verify the reopened store reads again instead of returning the corrupted
 *    record.
 * 3. Verify that adding a write bit to the top directory, omitting the
 *    32-character Nix base32 hash, or reaching the store root only through a
 *    symlinked look-alike disqualifies the store path and never returns a
 *    corrupted record.
 * 4. Delete and recreate the same store path name with identical bytes so its
 *    inode and change time move, verify the reopened store reads again, and
 *    verify `executable` files reuse while `goroot` keeps its metadata path.
 *
 * @evidence contracts/testing.md#behavioral-verification PluginContentIdentities.open, sourceDirectory, digest and runtimeExecutableIdentity run against a real temporary Nix store directory and cache root; assertions check returned digests and on-disk records.
 * @evidence contracts/testing.md#independent-expectations pluginSourceDigest called directly without a store is the independent oracle for every fresh source reading, and the corrupted literal digest is the oracle for a reused record.
 * @evidence contracts/testing.md#distinguishing-cases Valid read-only store paths reuse despite future mtimes for source directories and executables; a retargeted link inside the same store path, a writable top directory, a malformed or non-base32 hash name, a symlinked look-alike, a recreated store path with identical bytes and the unconfined goroot kind all reread. General separable-stamp metadata reuse is covered by test_plugincontentidentities_reuses_a_digest_only_while_its_metadata_holds.
 * @evidence contracts/testing.md#execution-ownership The named unit calls maintained source operations directly over temporary files and a private cache root without running Go, a native build or a compiler host.
 */
export function test_plugincontentidentities_reuses_a_nix_store_path_by_store_identity(): void {
  if (typeof process.getuid !== "function") return;
  const root = TestProject.physicalPath(
    TestProject.tmpdir("ttsc-nix-store-identity-"),
  );
  const storeRoot = path.join(root, "nix-store");
  fs.mkdirSync(storeRoot, { recursive: true });

  const validHash = "0123456789abcdfghijklmnpqrsvwxyz";
  const replacedHash = "zyxwvsqrpnmjihgfdcba987654321000";
  const lookalikeHash = "000111222333444555666777888999aa";
  const invalidCharHash = "e".repeat(32);
  const corrupted = "0".repeat(64);
  const future = new Date(Date.now() + 3_600_000);

  let cacheOrdinal = 0;
  const newCache = (): string => path.join(root, `cache-${++cacheOrdinal}`);
  const open = (cache: string): PluginContentIdentities.Store => {
    const store = PluginContentIdentities.open({
      projectRoot: root,
      cacheDir: cache,
      env: { NIX_STORE_DIR: storeRoot },
    });
    assert.ok(store, "a cache outside the sources opens a store");
    return store;
  };
  const listRecords = (cache: string): string[] => {
    const directory = path.join(cache, "identities");
    if (!fs.existsSync(directory)) return [];
    return fs
      .readdirSync(directory)
      .filter((name) => name.endsWith(".json"))
      .map((name) => path.join(directory, name));
  };
  const singleRecord = (cache: string): string => {
    const records = listRecords(cache);
    assert.equal(records.length, 1, "one subject, one record");
    return records[0]!;
  };
  const corruptFile = (file: string): string => {
    const entry = JSON.parse(fs.readFileSync(file, "utf8")) as {
      digest: string;
    };
    entry.digest = corrupted;
    fs.writeFileSync(file, JSON.stringify(entry));
    return corrupted;
  };
  const writeSourceTree = (base: string, marker: string): void => {
    fs.mkdirSync(path.join(base, "internal", "mark"), { recursive: true });
    fs.writeFileSync(
      path.join(base, "main.go"),
      "package main\n\nfunc main() {}\n",
    );
    fs.writeFileSync(
      path.join(base, "internal", "mark", "mark.go"),
      `package mark\n\nconst Marker = ${JSON.stringify(marker)}\n`,
    );
  };
  const setMtimes = (directory: string, when: Date): void => {
    for (const file of listFiles(directory)) fs.utimesSync(file, when, when);
  };
  const freezeTree = (target: string): void => {
    const stats = fs.lstatSync(target);
    if (stats.isSymbolicLink()) return;
    if (stats.isDirectory()) {
      for (const entry of fs.readdirSync(target))
        freezeTree(path.join(target, entry));
      fs.chmodSync(target, 0o555);
      return;
    }
    fs.chmodSync(target, 0o444);
  };
  const thawTree = (target: string): void => {
    let stats: fs.Stats;
    try {
      stats = fs.lstatSync(target);
    } catch {
      return;
    }
    if (stats.isSymbolicLink()) return;
    if (stats.isDirectory()) {
      fs.chmodSync(target, 0o700);
      for (const entry of fs.readdirSync(target))
        thawTree(path.join(target, entry));
      return;
    }
    fs.chmodSync(target, 0o600);
  };

  const failures: unknown[] = [];
  const verify = (name: string, run: () => void): void => {
    try {
      run();
    } catch (cause) {
      failures.push(new Error(name, { cause }));
    }
  };

  try {
    const storePath = path.join(storeRoot, `${validHash}-source`);
    const subject = path.join(storePath, "tsc");
    const otherSubject = path.join(storePath, "other");
    const binFile = path.join(storePath, "bin", "tool");
    writeSourceTree(subject, "alpha");
    writeSourceTree(otherSubject, "bravo");
    fs.mkdirSync(path.dirname(binFile), { recursive: true });
    fs.writeFileSync(binFile, "#!/bin/sh\necho tool\n");
    setMtimes(storePath, future);
    freezeTree(storePath);
    fs.chmodSync(path.dirname(binFile), 0o700);
    fs.chmodSync(binFile, 0o555);
    fs.utimesSync(binFile, future, future);
    fs.chmodSync(path.dirname(binFile), 0o555);

    const expectedDigest = pluginSourceDigest(subject);
    assert.notEqual(expectedDigest, corrupted);

    const mainCache = newCache();
    verify(
      "a valid read-only Nix store path records and reuses despite future mtimes",
      () => {
        assert.equal(
          PluginContentIdentities.sourceDirectory(open(mainCache), subject),
          expectedDigest,
        );
        const file = singleRecord(mainCache);
        corruptFile(file);
        assert.equal(
          PluginContentIdentities.sourceDirectory(open(mainCache), subject),
          corrupted,
        );
      },
    );

    verify(
      "a link retargeted to another subdirectory of the same store path reads again",
      () => {
        const linkCache = newCache();
        const link = path.join(root, "linked-source");
        fs.symlinkSync(subject, link);
        assert.equal(
          PluginContentIdentities.sourceDirectory(open(linkCache), link),
          expectedDigest,
        );
        corruptFile(singleRecord(linkCache));
        assert.equal(
          PluginContentIdentities.sourceDirectory(open(linkCache), link),
          corrupted,
        );
        fs.unlinkSync(link);
        fs.symlinkSync(otherSubject, link);
        assert.equal(
          PluginContentIdentities.sourceDirectory(open(linkCache), link),
          pluginSourceDigest(otherSubject),
        );
      },
    );

    verify(
      "a write bit on the top directory disqualifies the store path",
      () => {
        fs.chmodSync(storePath, 0o755);
        try {
          assert.equal(
            PluginContentIdentities.sourceDirectory(open(mainCache), subject),
            expectedDigest,
          );
        } finally {
          fs.chmodSync(storePath, 0o555);
        }
      },
    );

    const verifyDisqualified = (candidate: string): void => {
      const cache = newCache();
      const digest = pluginSourceDigest(candidate);
      assert.notEqual(digest, corrupted);
      assert.equal(
        PluginContentIdentities.sourceDirectory(open(cache), candidate),
        digest,
      );
      for (const file of listRecords(cache)) corruptFile(file);
      assert.equal(
        listRecords(cache).length,
        0,
        "a disqualified tree with future mtimes must not record a Nix identity",
      );
      assert.equal(
        PluginContentIdentities.sourceDirectory(open(cache), candidate),
        digest,
      );
    };

    verify(
      "a top directory without a 32-character Nix base32 hash does not qualify",
      () => {
        const shortName = path.join(storeRoot, "not-a-nix-hash-source");
        writeSourceTree(path.join(shortName, "tsc"), "short");
        setMtimes(shortName, future);
        freezeTree(shortName);
        verifyDisqualified(path.join(shortName, "tsc"));

        const badAlphabet = path.join(storeRoot, `${invalidCharHash}-source`);
        writeSourceTree(path.join(badAlphabet, "tsc"), "bad-alphabet");
        setMtimes(badAlphabet, future);
        freezeTree(badAlphabet);
        verifyDisqualified(path.join(badAlphabet, "tsc"));
      },
    );

    verify(
      "a tree reaching the store root only through a symlinked look-alike does not qualify",
      () => {
        const outside = path.join(root, "outside-store-tree");
        writeSourceTree(path.join(outside, "tsc"), "outside");
        setMtimes(outside, future);
        freezeTree(outside);
        const lookalike = path.join(storeRoot, `${lookalikeHash}-lookalike`);
        fs.symlinkSync(outside, lookalike);
        verifyDisqualified(path.join(lookalike, "tsc"));
      },
    );

    verify(
      "deleting and recreating the same store path name with identical bytes reads again",
      () => {
        const replaceCache = newCache();
        const replacedPath = path.join(storeRoot, `${replacedHash}-source`);
        const replacedSubject = path.join(replacedPath, "tsc");
        writeSourceTree(replacedSubject, "same-bytes");
        setMtimes(replacedPath, future);
        freezeTree(replacedPath);
        const digest = pluginSourceDigest(replacedSubject);
        assert.equal(
          PluginContentIdentities.sourceDirectory(
            open(replaceCache),
            replacedSubject,
          ),
          digest,
        );
        corruptFile(singleRecord(replaceCache));
        assert.equal(
          PluginContentIdentities.sourceDirectory(
            open(replaceCache),
            replacedSubject,
          ),
          corrupted,
        );

        // Allocate the replacement directory before removing the old one so
        // the filesystem cannot immediately reuse the old inode.
        const staging = path.join(root, "replacement-staging");
        writeSourceTree(path.join(staging, "tsc"), "same-bytes");
        setMtimes(staging, future);
        thawTree(replacedPath);
        fs.rmSync(replacedPath, { recursive: true, force: true });
        fs.renameSync(staging, replacedPath);
        freezeTree(replacedPath);

        assert.equal(
          PluginContentIdentities.sourceDirectory(
            open(replaceCache),
            replacedSubject,
          ),
          digest,
        );
      },
    );

    verify(
      "an executable file inside a store path reuses while goroot keeps its metadata path",
      () => {
        const execCache = newCache();
        const first = runtimeExecutableIdentity(binFile, open(execCache));
        assert.ok(first !== undefined);
        corruptFile(singleRecord(execCache));
        const second = runtimeExecutableIdentity(binFile, open(execCache));
        assert.ok(second !== undefined);
        assert.equal(second.split("\0").at(-1), corrupted);

        const goRootCache = newCache();
        let reads = 0;
        const firstGoRoot = PluginContentIdentities.digest(
          open(goRootCache),
          "goroot",
          subject,
          () => ({ separable: false, signature: "walk" }),
          () => {
            reads += 1;
            return "goroot-digest";
          },
        );
        assert.equal(firstGoRoot, "goroot-digest");
        assert.equal(reads, 1);
        assert.equal(
          listRecords(goRootCache).length,
          0,
          "goroot must not use the Nix store shortcut",
        );
      },
    );
  } finally {
    thawTree(root);
    fs.rmSync(root, { recursive: true, force: true });
  }

  if (failures.length !== 0)
    throw new AggregateError(failures, "nix store identity matrix failed");
}

function listFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const location = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(location) : [location];
  });
}

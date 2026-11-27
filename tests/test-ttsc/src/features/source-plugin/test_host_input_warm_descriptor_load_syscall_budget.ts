import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { HostInputObservationPhase } from "../../../../../packages/ttsc/src/plugin/internal/load/HostInputObservationPhase";
import { PluginDescriptorEvaluationCache } from "../../../../../packages/ttsc/src/plugin/internal/load/PluginDescriptorEvaluationCache";
import { hashHostInputPaths } from "../../../../../packages/ttsc/src/plugin/internal/load/hashHostInputPaths";
import { realpathHostInputPaths } from "../../../../../packages/ttsc/src/plugin/internal/load/realpathHostInputPaths";

const PROBE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".mjs",
  ".cjs",
  ".json",
  ".node",
] as const;

const DIRECTORY_HASH = crypto
  .createHash("sha256")
  .update("ttsc:host-input:directory\0")
  .digest("hex");

interface SyscallCounts {
  lstatPaths: string[];
  realpathNativePaths: string[];
  realpathPaths: string[];
  statPaths: string[];
}

function withCountedFs<T>(run: (counts: SyscallCounts) => T): T {
  const counts: SyscallCounts = {
    lstatPaths: [],
    realpathNativePaths: [],
    realpathPaths: [],
    statPaths: [],
  };
  const originalLstat = fs.lstatSync;
  const originalStat = fs.statSync;
  const originalRealpath = fs.realpathSync;
  const originalRealpathNative = fs.realpathSync.native;

  const wrappedRealpath = ((file: fs.PathLike, options?: fs.EncodingOption) => {
    counts.realpathPaths.push(String(file));
    return originalRealpath(file, options);
  }) as typeof fs.realpathSync;
  wrappedRealpath.native = ((
    file: fs.PathLike,
    options?: fs.EncodingOption,
  ) => {
    counts.realpathNativePaths.push(String(file));
    return originalRealpathNative(file, options);
  }) as typeof fs.realpathSync.native;

  fs.lstatSync = ((file: fs.PathLike, options?: fs.StatSyncOptions) => {
    counts.lstatPaths.push(String(file));
    return originalLstat(file, options);
  }) as typeof fs.lstatSync;
  fs.statSync = ((file: fs.PathLike, options?: fs.StatSyncOptions) => {
    counts.statPaths.push(String(file));
    return originalStat(file, options);
  }) as typeof fs.statSync;
  fs.realpathSync = wrappedRealpath;

  try {
    return run(counts);
  } finally {
    fs.lstatSync = originalLstat;
    fs.statSync = originalStat;
    fs.realpathSync = originalRealpath;
    fs.realpathSync.native = originalRealpathNative;
  }
}

/**
 * Verifies a warm descriptor cache load proves absent candidates with one
 * lstat, skips descendants of missing or non-directory parents, and resolves
 * each ancestor directory once per phase with exact on-disk casing.
 *
 * A warm descriptor load checks hundreds of absent module-resolution candidates
 * plus present files in shared directories. Probing every candidate with both
 * statSync and lstatSync, re-statting children under regular files or missing
 * directories, and walking ancestor paths on every file multiplied launch
 * syscalls.
 *
 * 1. Persist a descriptor evaluation containing present files, directories,
 *    symlinks, absent extension siblings, absent children under regular files,
 *    and absent children under missing directories, then read it while counting
 *    fs syscalls.
 * 2. Verify absent candidates pay one lstatSync and zero statSync, descendants of
 *    missing or non-directory parents pay zero syscalls, symlink parents never
 *    short-circuit, and a dense batch shares the directory's native realpath.
 * 3. Compare native spellings for case and Unicode variants. Verify sparse inputs
 *    skip listing, wide directories fall back and fresh phases see newly
 *    created paths.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the descriptor cache and host input helpers with native files, directories, links, absent candidates and Unicode names. Observes direct native probes and whether phases keep a complete listing, skip the listing or discard it as too wide.
 * @evidence contracts/testing.md#independent-expectations Computes SHA-256 from authored bytes and physical paths with direct native realpath; call counters and phase observations distinguish absent, dense, sparse and wide work.
 * @evidence contracts/testing.md#distinguishing-cases Contrasts file, directory, symlink and absent ancestry cases with case variants, normalized names, a Kelvin-sign alias, sparse versus wide batches, opposite listing and search permissions on unprivileged POSIX, and post-phase creation.
 * @evidence contracts/testing.md#execution-ownership Calls maintained cache and host-input helpers directly over an owned temporary directory removed in finally, restoring every wrapped fs property in finally without starting a compiler, Go tool or subprocess.
 */
export function test_host_input_warm_descriptor_load_syscall_budget(): void {
  const root = fs.realpathSync.native(
    fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-warm-descriptor-syscalls-")),
  );
  const failures: Error[] = [];
  const links: string[] = [];
  const check = (name: string, operation: () => void): void => {
    try {
      operation();
    } catch (cause) {
      failures.push(new Error(name, { cause }));
    }
  };
  const digest = (bytes: string): string =>
    crypto.createHash("sha256").update(bytes).digest("hex");

  try {
    const dist = path.join(root, "dist");
    const sub = path.join(dist, "sub");
    fs.mkdirSync(sub, { recursive: true });

    const presentFiles: string[] = [];
    const expectedHashes: Record<string, string | null> = {};
    const expectedRealpaths: Record<string, string | null> = {};

    for (let i = 0; i < 6; i++) {
      const file = path.join(dist, `mod${i}.js`);
      const content = `module.exports = ${i};\n`;
      fs.writeFileSync(file, content, "utf8");
      presentFiles.push(file);
      expectedHashes[file] = digest(content);
      expectedRealpaths[file] = fs.realpathSync.native(file);
    }

    const mixedCase = path.join(dist, "MixedCase.js");
    const mixedContent = "module.exports = 'mixed';\n";
    fs.writeFileSync(mixedCase, mixedContent, "utf8");
    expectedHashes[mixedCase] = digest(mixedContent);
    expectedRealpaths[mixedCase] = fs.realpathSync.native(mixedCase);

    const nested = path.join(sub, "nested.js");
    const nestedContent = "module.exports = 'nested';\n";
    fs.writeFileSync(nested, nestedContent, "utf8");
    expectedHashes[sub] = DIRECTORY_HASH;
    expectedRealpaths[sub] = fs.realpathSync.native(sub);
    expectedHashes[nested] = digest(nestedContent);
    expectedRealpaths[nested] = fs.realpathSync.native(nested);

    let fileLink: string | undefined;
    const dirLink = path.join(dist, "dir-link");
    const brokenLink = path.join(dist, "broken-link.js");
    const windows = process.platform === "win32";
    const fileLinkPath = path.join(dist, "file-link.js");
    try {
      fs.symlinkSync(presentFiles[0]!, fileLinkPath, "file");
      links.push(fileLinkPath);
      fileLink = fileLinkPath;
    } catch (cause) {
      if (!windows || (cause as NodeJS.ErrnoException).code !== "EPERM")
        throw cause;
    }
    fs.symlinkSync(sub, dirLink, windows ? "junction" : "dir");
    links.push(dirLink);
    fs.symlinkSync(
      path.join(dist, "no-such-target"),
      brokenLink,
      windows ? "junction" : "file",
    );
    links.push(brokenLink);

    expectedHashes[dirLink] = DIRECTORY_HASH;
    expectedRealpaths[dirLink] = expectedRealpaths[sub]!;
    expectedHashes[brokenLink] = null;
    expectedRealpaths[brokenLink] = null;

    // Children under symlink parents must NOT be short-circuited by the parent.
    const underDirLinkPresent = path.join(dirLink, "nested.js");
    const underDirLinkAbsent = path.join(dirLink, "missing.js");
    expectedHashes[underDirLinkPresent] = digest(nestedContent);
    expectedRealpaths[underDirLinkPresent] =
      fs.realpathSync.native(underDirLinkPresent);
    expectedHashes[underDirLinkAbsent] = null;
    expectedRealpaths[underDirLinkAbsent] = null;
    const underFileLinkAbsent =
      fileLink === undefined ? undefined : path.join(fileLink, "index.js");
    if (fileLink !== undefined && underFileLinkAbsent !== undefined) {
      expectedHashes[fileLink] = expectedHashes[presentFiles[0]!]!;
      expectedRealpaths[fileLink] = expectedRealpaths[presentFiles[0]!]!;
      expectedHashes[underFileLinkAbsent] = null;
      expectedRealpaths[underFileLinkAbsent] = null;
    }

    const independentAbsent: string[] = [];
    const underRegularFileAbsent: string[] = [];
    const underMissingDirAbsent: string[] = [];

    for (const file of presentFiles) {
      for (const ext of PROBE_EXTENSIONS) {
        const sibling = file + ext;
        independentAbsent.push(sibling);
        expectedHashes[sibling] = null;
        expectedRealpaths[sibling] = null;
      }
      for (const child of [
        path.join(file, "package.json"),
        ...PROBE_EXTENSIONS.map((ext) => path.join(file, `index${ext}`)),
      ]) {
        underRegularFileAbsent.push(child);
        expectedHashes[child] = null;
        expectedRealpaths[child] = null;
      }
    }

    for (let i = 0; i < 3; i++) {
      const missingBase = path.join(dist, `absent${i}`);
      independentAbsent.push(missingBase);
      expectedHashes[missingBase] = null;
      expectedRealpaths[missingBase] = null;
      for (const child of [
        path.join(missingBase, "package.json"),
        ...PROBE_EXTENSIONS.map((ext) => path.join(missingBase, `index${ext}`)),
      ]) {
        underMissingDirAbsent.push(child);
        expectedHashes[child] = null;
        expectedRealpaths[child] = null;
      }
    }

    const inputs = Object.keys(expectedHashes).sort();
    const evaluation: PluginDescriptorEvaluationCache.IEvaluation = {
      descriptor: { name: "warm-syscalls", hostInputHashes: {} },
      hostInputHashes: expectedHashes,
      hostInputRealpaths: expectedRealpaths,
      inputs,
      observationsComplete: true,
    };
    const entry = path.join(root, "descriptor-cache.json");
    PluginDescriptorEvaluationCache.write(entry, evaluation);

    check("warm descriptor cache read meets syscall budget", () => {
      const { counts, loaded } = withCountedFs((counts) => ({
        counts,
        loaded: PluginDescriptorEvaluationCache.read(entry),
      }));
      assert.deepEqual(loaded, evaluation);

      // (a) Among host inputs only the link targets require statSync.
      const nonSymlinkStats = counts.statPaths.filter(
        (file) => !links.includes(file) && file !== entry,
      );
      assert.deepEqual(
        nonSymlinkStats,
        [],
        `expected zero statSync calls on absent and non-symlink paths, got ${nonSymlinkStats.length}: ${JSON.stringify(nonSymlinkStats.slice(0, 10))}`,
      );

      // (a) Every independent absent candidate is observed with exactly one lstatSync.
      const lstatByPath = new Map<string, number>();
      for (const file of counts.lstatPaths) {
        lstatByPath.set(file, (lstatByPath.get(file) ?? 0) + 1);
      }
      for (const candidate of independentAbsent) {
        assert.equal(
          lstatByPath.get(candidate) ?? 0,
          1,
          `expected 1 lstatSync for independent absent candidate ${candidate}, got ${lstatByPath.get(candidate) ?? 0}`,
        );
      }

      // (b) Descendants of non-directory regular files and missing bases pay 0 syscalls.
      const skippedDescendants = [
        ...underRegularFileAbsent,
        ...underMissingDirAbsent,
      ];
      const unexpectedDescendantLstats = skippedDescendants.filter(
        (candidate) => (lstatByPath.get(candidate) ?? 0) > 0,
      );
      assert.deepEqual(
        unexpectedDescendantLstats,
        [],
        `expected 0 lstatSync calls for descendants of missing/non-directory parents, got ${unexpectedDescendantLstats.length}: ${JSON.stringify(unexpectedDescendantLstats.slice(0, 10))}`,
      );

      // (b) Symlink parents must never short-circuit their descendants.
      assert.equal(
        lstatByPath.get(underDirLinkPresent),
        1,
        "child under directory symlink must be observed",
      );
      assert.equal(
        lstatByPath.get(underDirLinkAbsent),
        1,
        "absent child under directory symlink must be observed",
      );
      if (underFileLinkAbsent !== undefined)
        assert.equal(
          lstatByPath.get(underFileLinkAbsent),
          1,
          "child under file symlink must not be short-circuited by symlink parent",
        );

      // (c) Non-symlink files in dist/ share the physical parent and listing.
      assert.deepEqual(
        presentFiles.filter((file) => lstatByPath.has(file)),
        [],
        "regular directory entries replace per-file lstat calls",
      );
      const distRealpathCalls = counts.realpathNativePaths.filter(
        (file) => file === dist,
      );
      const leafFileRealpathCalls = counts.realpathNativePaths.filter(
        (file) => presentFiles.includes(file) || file === mixedCase,
      );
      assert.equal(
        distRealpathCalls.length,
        1,
        `expected 1 realpathSync.native for shared ancestor dist/, got ${distRealpathCalls.length}`,
      );
      assert.deepEqual(
        leafFileRealpathCalls,
        [],
        `expected 0 realpathSync.native calls on non-symlink leaf files in dist/, got ${JSON.stringify(leafFileRealpathCalls)}`,
      );
    });

    check(
      "small batches preserve native casing and Unicode normalization",
      () => {
        const unicode = path.join(dist, "\u00c9.js");
        const kelvin = path.join(dist, "\u212a.js");
        const unicodeDir = path.join(dist, "\u00c9-dir");
        fs.writeFileSync(unicode, "");
        fs.writeFileSync(kelvin, "");
        fs.mkdirSync(unicodeDir);
        const paths = [
          ...presentFiles,
          mixedCase,
          path.join(dist, "mixedcase.js"),
          path.join(dist, "MIXEDCASE.JS"),
          unicode,
          path.join(dist, "e\u0301.js"),
          path.join(dist, "\u00e9.js"),
          kelvin,
          path.join(dist, "k.js"),
          unicodeDir,
          path.join(dist, "e\u0301-dir"),
        ];
        const expected = Object.fromEntries(
          paths.map((file) => {
            try {
              return [file, fs.realpathSync.native(file)];
            } catch (error) {
              assert.equal((error as NodeJS.ErrnoException).code, "ENOENT");
              return [file, null];
            }
          }),
        );
        const phase = HostInputObservationPhase.create();
        hashHostInputPaths(paths, phase);
        assert.deepEqual(realpathHostInputPaths(paths, phase), expected);
        assert.ok(phase.directoryEntries.get(dist), "qualified small listing");
      },
    );

    check(
      "sparse selections and wide directories use native leaf paths",
      () => {
        const wide = path.join(root, "wide");
        fs.mkdirSync(wide);
        for (let i = 0; i < 256; i++)
          fs.writeFileSync(path.join(wide, `other-${i}`), "");
        const nativeOrder: string[] = [];
        const directory = fs.opendirSync(wide);
        try {
          for (
            let entry = directory.readSync();
            entry !== null;
            entry = directory.readSync()
          )
            nativeOrder.push(path.join(wide, entry.name));
        } finally {
          directory.closeSync();
        }
        const files = nativeOrder.slice(-3);
        const single = HostInputObservationPhase.create();
        hashHostInputPaths(files.slice(0, 1), single);
        assert.deepEqual(realpathHostInputPaths(files.slice(0, 1), single), {
          [files[0]!]: fs.realpathSync.native(files[0]!),
        });
        assert.equal(single.directoryEntries.size, 0);
        assert.equal(single.directoryRealpaths.size, 0);

        const batch = HostInputObservationPhase.create();
        hashHostInputPaths(files, batch);
        assert.deepEqual(
          realpathHostInputPaths(files, batch),
          Object.fromEntries(
            files.map((file) => [file, fs.realpathSync.native(file)]),
          ),
        );
        assert.deepEqual([...batch.directoryEntries], [[wide, null]]);
      },
    );

    if (process.platform !== "win32" && process.getuid?.() !== 0)
      check(
        "native fallback can traverse a directory without listing it",
        () => {
          const privateDirectory = path.join(root, "search-only");
          fs.mkdirSync(privateDirectory);
          const files = ["first", "second", "third"].map((name) =>
            path.join(privateDirectory, name),
          );
          for (const file of files) fs.writeFileSync(file, "");
          const expected = Object.fromEntries(
            files.map((file) => [file, fs.realpathSync.native(file)]),
          );
          fs.chmodSync(privateDirectory, 0o111);
          try {
            assert.throws(() => fs.opendirSync(privateDirectory).closeSync(), {
              code: "EACCES",
            });
            const phase = HostInputObservationPhase.create();
            hashHostInputPaths(files, phase);
            assert.deepEqual(realpathHostInputPaths(files, phase), expected);
            assert.deepEqual(
              [...phase.directoryEntries],
              [[privateDirectory, null]],
            );
          } finally {
            fs.chmodSync(privateDirectory, 0o700);
          }
        },
      );

    if (process.platform !== "win32" && process.getuid?.() !== 0)
      check("enumeration does not prove search permission", () => {
        const parent = path.join(root, "list-only");
        fs.mkdirSync(parent);
        const files = ["first", "second", "third"].map((name) =>
          path.join(parent, name),
        );
        for (const file of files) {
          fs.writeFileSync(file, "unreadable");
          fs.chmodSync(file, 0);
        }
        const record = path.join(root, "permission-record.json");
        PluginDescriptorEvaluationCache.write(record, {
          descriptor: { hostInputHashes: {} },
          hostInputHashes: Object.fromEntries(
            files.map((file) => [file, null]),
          ),
          hostInputRealpaths: Object.fromEntries(
            files.map((file) => [file, fs.realpathSync.native(file)]),
          ),
          inputs: files,
          observationsComplete: true,
        });
        assert.notEqual(PluginDescriptorEvaluationCache.read(record), null);
        fs.chmodSync(parent, 0o400);
        try {
          assert.equal(fs.readdirSync(parent).length, files.length);
          assert.throws(() => fs.realpathSync.native(files[0]!), {
            code: "EACCES",
          });
          assert.equal(PluginDescriptorEvaluationCache.read(record), null);
        } finally {
          fs.chmodSync(parent, 0o700);
        }
      });

    check("fresh phase observes newly created parent and child", () => {
      const appearedDir = path.join(dist, "absent0");
      const appearedChild = path.join(appearedDir, "index.ts");
      fs.mkdirSync(appearedDir);
      fs.writeFileSync(appearedChild, "export const x = 1;\n", "utf8");
      try {
        assert.equal(
          PluginDescriptorEvaluationCache.read(entry),
          null,
          "creating a previously absent parent and child must invalidate cache in a fresh phase",
        );
        const freshHashes = hashHostInputPaths([appearedDir, appearedChild]);
        assert.equal(freshHashes[appearedDir], DIRECTORY_HASH);
        assert.equal(
          freshHashes[appearedChild],
          digest("export const x = 1;\n"),
        );
      } finally {
        fs.rmSync(appearedDir, { recursive: true, force: true });
      }
    });
  } catch (cause) {
    failures.push(new Error("fixture setup", { cause }));
  } finally {
    for (const link of links) fs.unlinkSync(link);
    fs.rmSync(root, { recursive: true, force: true });
  }

  if (failures.length !== 0) {
    throw new AggregateError(
      failures,
      "warm descriptor load syscall budget checks failed",
    );
  }
}

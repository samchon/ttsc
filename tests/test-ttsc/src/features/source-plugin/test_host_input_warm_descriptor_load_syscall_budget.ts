import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

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
  readdirPaths: string[];
  realpathNativePaths: string[];
  realpathPaths: string[];
  statPaths: string[];
}

function withCountedFs<T>(run: (counts: SyscallCounts) => T): T {
  const counts: SyscallCounts = {
    lstatPaths: [],
    readdirPaths: [],
    realpathNativePaths: [],
    realpathPaths: [],
    statPaths: [],
  };
  const originalLstat = fs.lstatSync;
  const originalStat = fs.statSync;
  const originalReaddir = fs.readdirSync;
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
  fs.readdirSync = ((
    file: fs.PathLike,
    options?: Parameters<typeof fs.readdirSync>[1],
  ) => {
    counts.readdirPaths.push(String(file));
    return originalReaddir(file, options as never);
  }) as typeof fs.readdirSync;
  fs.realpathSync = wrappedRealpath;

  try {
    return run(counts);
  } finally {
    fs.lstatSync = originalLstat;
    fs.statSync = originalStat;
    fs.readdirSync = originalReaddir;
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
 *    short-circuit, and shared directories pay one realpathSync.native and one
 *    readdirSync per phase.
 * 3. Verify exact on-disk casing on case-insensitive volumes for ASCII names,
 *    fallback to realpathSync.native for non-ASCII lexical names, non-ASCII
 *    fold targets (such as Kelvin sign) and unreadable listings, and fresh
 *    invalidation when a previously absent path is created in a later phase.
 *
 * @evidence contracts/testing.md#behavioral-verification Exercises PluginDescriptorEvaluationCache.write/read, hashHostInputPaths and realpathHostInputPaths against real files, directories, symlinks and absent candidates while counting in-process fs syscalls, plus wrapped fs mocks for Unicode normalization and Kelvin-sign fallback cases.
 * @evidence contracts/testing.md#independent-expectations Expected hashes come from independent SHA-256 over authored bytes and expected physical paths come from direct fs.realpathSync.native calls; exact syscall budgets verify one lstat per independent absent candidate, zero syscalls for absent-parent descendants, one directory realpath/readdir per phase, and native fallback on non-ASCII folds.
 * @evidence contracts/testing.md#distinguishing-cases Contrasts present files, directories, file/directory/broken symlinks, independent absent candidates, children under regular files, children under missing directories, children under symlinks, differing-case ASCII spellings on case-insensitive volumes, NFC/NFD non-ASCII normalization fallback, Kelvin-sign fold fallback, unreadable directory listings, and post-phase file creation.
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

      // (c) Present non-symlink files in dist/ share one realpathSync.native
      // and one readdirSync for dist/ instead of calling realpathSync.native per file.
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
      const distReaddirCalls = counts.readdirPaths.filter(
        (file) => file === dist,
      );
      assert.equal(
        distReaddirCalls.length,
        1,
        `expected 1 readdirSync for dist/, got ${distReaddirCalls.length}`,
      );
    });

    check(
      "case-insensitive volume returns exact on-disk leaf spelling from listing",
      () => {
        const lowerAlias = path.join(dist, "mixedcase.js");
        const caseInsensitive = fs.existsSync(lowerAlias);
        if (!caseInsensitive) {
          // Skipped on case-sensitive filesystem: lowercase spelling does not
          // resolve to MixedCase.js on this volume.
          return;
        }
        const upperAlias = path.join(dist, "MIXEDCASE.JS");
        const expectedPhysical = fs.realpathSync.native(lowerAlias);
        assert.equal(expectedPhysical, mixedCase);

        const { counts, resolved } = withCountedFs((counts) => ({
          counts,
          resolved: realpathHostInputPaths([lowerAlias, upperAlias]),
        }));
        assert.equal(
          resolved[lowerAlias],
          expectedPhysical,
          "lowercase alias must canonicalize to exact on-disk casing",
        );
        assert.equal(
          resolved[upperAlias],
          expectedPhysical,
          "uppercase alias must canonicalize to exact on-disk casing",
        );
        assert.deepEqual(
          counts.realpathNativePaths.filter(
            (file) => file === lowerAlias || file === upperAlias,
          ),
          [],
          "non-symlink leaf aliases must resolve via parent directory realpath + listing",
        );
        assert.equal(
          counts.readdirPaths.filter((file) => file === dist).length,
          1,
          "parent directory listing must be read once per phase",
        );
      },
    );

    check(
      "non-ASCII NFC/NFD lexical lookup falls back to realpathSync.native",
      () => {
        const mockDir = path.join(root, "unicode-norm-dir");
        const nfcUpper = "\u00c9.js"; // 'É.js' (NFC uppercase)
        const nfdLower = "e\u0301.js"; // 'e\u0301.js' (NFD lowercase)
        const nfcLower = "\u00e9.js"; // 'é.js' (NFC lowercase)
        const dirNfcUpper = "\u00c9-dir";
        const dirNfdLower = "e\u0301-dir";
        const dirNfcLower = "\u00e9-dir";
        const seedFile = path.join(mockDir, "seed.js");
        const lexicalFile = path.join(mockDir, nfcLower);
        const expectedFile = path.join(mockDir, nfdLower);
        const lexicalSubdir = path.join(mockDir, dirNfcLower);
        const expectedSubdir = path.join(mockDir, dirNfdLower);

        const originalLstat = fs.lstatSync;
        const originalReaddir = fs.readdirSync;
        const originalRealpathNative = fs.realpathSync.native;
        const sampleFileStat = originalLstat(presentFiles[0]!);
        const sampleDirStat = originalLstat(dist);
        const nativeCalls: string[] = [];

        fs.readdirSync = ((
          file: fs.PathLike,
          options?: Parameters<typeof fs.readdirSync>[1],
        ) => {
          if (path.resolve(String(file)) === mockDir) {
            return [
              "seed.js",
              nfcUpper,
              nfdLower,
              dirNfcUpper,
              dirNfdLower,
            ] as unknown as ReturnType<typeof fs.readdirSync>;
          }
          return originalReaddir(file, options as never);
        }) as typeof fs.readdirSync;
        fs.lstatSync = ((file: fs.PathLike, options?: fs.StatSyncOptions) => {
          const resolved = path.resolve(String(file));
          if (resolved === seedFile || resolved === lexicalFile) {
            return sampleFileStat as ReturnType<typeof fs.lstatSync>;
          }
          if (resolved === mockDir || resolved === lexicalSubdir) {
            return sampleDirStat as ReturnType<typeof fs.lstatSync>;
          }
          return originalLstat(file, options);
        }) as typeof fs.lstatSync;
        fs.realpathSync.native = ((
          file: fs.PathLike,
          options?: fs.EncodingOption,
        ) => {
          const resolved = path.resolve(String(file));
          nativeCalls.push(resolved);
          if (resolved === mockDir) return mockDir;
          if (resolved === lexicalFile) return expectedFile;
          if (resolved === lexicalSubdir) return expectedSubdir;
          return originalRealpathNative(file, options);
        }) as typeof fs.realpathSync.native;

        try {
          const result = realpathHostInputPaths([
            seedFile,
            lexicalFile,
            lexicalSubdir,
          ]);
          assert.equal(
            result[lexicalFile],
            expectedFile,
            "NFC lowercase lookup must match native NFD answer instead of folding to NFC uppercase",
          );
          assert.ok(
            nativeCalls.includes(lexicalFile),
            "non-ASCII lexical name must fall back to realpathSync.native",
          );
          assert.equal(
            result[lexicalSubdir],
            expectedSubdir,
            "non-ASCII directory lookup must match native NFD answer",
          );
          assert.ok(
            nativeCalls.includes(lexicalSubdir),
            "non-ASCII directory name must fall back to realpathSync.native",
          );
        } finally {
          fs.lstatSync = originalLstat;
          fs.readdirSync = originalReaddir;
          fs.realpathSync.native = originalRealpathNative;
        }
      },
    );

    check(
      "ASCII lexical name folding to non-ASCII Kelvin-sign entry falls back to realpathSync.native",
      () => {
        const mockDir = path.join(root, "kelvin-dir");
        const kelvinEntry = "\u212a.js"; // Kelvin sign 'K' whose .toLowerCase() is 'k'
        const lexicalK = path.join(mockDir, "k.js");
        const expectedPhysical = path.join(mockDir, kelvinEntry);

        const originalLstat = fs.lstatSync;
        const originalReaddir = fs.readdirSync;
        const originalRealpathNative = fs.realpathSync.native;
        const sampleFileStat = originalLstat(presentFiles[0]!);
        const nativeCalls: string[] = [];

        fs.readdirSync = ((
          file: fs.PathLike,
          options?: Parameters<typeof fs.readdirSync>[1],
        ) => {
          if (path.resolve(String(file)) === mockDir) {
            return [kelvinEntry] as unknown as ReturnType<
              typeof fs.readdirSync
            >;
          }
          return originalReaddir(file, options as never);
        }) as typeof fs.readdirSync;
        fs.lstatSync = ((file: fs.PathLike, options?: fs.StatSyncOptions) => {
          if (path.resolve(String(file)) === lexicalK) {
            return sampleFileStat as ReturnType<typeof fs.lstatSync>;
          }
          return originalLstat(file, options);
        }) as typeof fs.lstatSync;
        fs.realpathSync.native = ((
          file: fs.PathLike,
          options?: fs.EncodingOption,
        ) => {
          const resolved = path.resolve(String(file));
          nativeCalls.push(resolved);
          if (resolved === mockDir) return mockDir;
          if (resolved === lexicalK) return expectedPhysical;
          return originalRealpathNative(file, options);
        }) as typeof fs.realpathSync.native;

        try {
          const result = realpathHostInputPaths([lexicalK]);
          assert.equal(
            result[lexicalK],
            expectedPhysical,
            "Kelvin-sign lookup must match realpathSync.native",
          );
          assert.ok(
            nativeCalls.includes(lexicalK),
            "fold landing on non-ASCII Kelvin-sign entry must fall back to realpathSync.native",
          );
        } finally {
          fs.lstatSync = originalLstat;
          fs.readdirSync = originalReaddir;
          fs.realpathSync.native = originalRealpathNative;
        }
      },
    );

    check(
      "unreadable directory listing falls back to realpathSync.native",
      () => {
        const originalReaddir = fs.readdirSync;
        const realpathCalls: string[] = [];
        const originalRealpathNative = fs.realpathSync.native;
        fs.readdirSync = ((
          file: fs.PathLike,
          options?: Parameters<typeof fs.readdirSync>[1],
        ) => {
          if (path.resolve(String(file)) === dist) {
            const error = new Error("EACCES: permission denied");
            (error as NodeJS.ErrnoException).code = "EACCES";
            throw error;
          }
          return originalReaddir(file, options as never);
        }) as typeof fs.readdirSync;
        fs.realpathSync.native = ((
          file: fs.PathLike,
          options?: fs.EncodingOption,
        ) => {
          realpathCalls.push(String(file));
          return originalRealpathNative(file, options);
        }) as typeof fs.realpathSync.native;
        try {
          const result = realpathHostInputPaths([presentFiles[0]!, mixedCase]);
          assert.equal(
            result[presentFiles[0]!],
            expectedRealpaths[presentFiles[0]!]!,
          );
          assert.equal(result[mixedCase], expectedRealpaths[mixedCase]!);
          assert.ok(
            realpathCalls.includes(presentFiles[0]!),
            "unreadable listing must fall back to realpathSync.native for leaf",
          );
          assert.ok(
            realpathCalls.includes(mixedCase),
            "unreadable listing must fall back to realpathSync.native for each leaf",
          );
        } finally {
          fs.readdirSync = originalReaddir;
          fs.realpathSync.native = originalRealpathNative;
        }
      },
    );

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

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { PluginDescriptorInputObserver } from "../../../../../packages/ttsc/src/launcher/internal/runtime/PluginDescriptorInputObserver";

/**
 * Verifies `PluginDescriptorInputObserver` avoids repeated ancestor `lstatSync`
 * walks, skips redundant `statSync` and `realpathSync.native` on missing
 * candidates, deduplicates symlink-ancestor observations within one resolution
 * window, and observes every candidate and symlink ancestor afresh in a later
 * resolution window.
 *
 * In the descriptor evaluator child (`descriptor.json.cjs`), every missing
 * candidate walked every lexical ancestor from root with `lstatSync`, ran
 * `beforeSignature` + `statSync` + `realpathSync.native` + `afterSignature`,
 * and re-observed every symlink ancestor on every sibling candidate.
 *
 * 1. Observe 20 missing sibling candidates under a path with a symlink ancestor in
 *    one window; assert `lstatSync` runs once per candidate plus once per
 *    distinct ancestor, `statSync` and `realpathSync.native` do not run for
 *    missing candidates, the symlink ancestor is observed once, and emitted
 *    records match unbatched `observe()` signatures exactly.
 * 2. Observe an existing regular file; assert `statSync` is not repeated for a
 *    non-symlink file, `realpathSync.native` runs once, and mutating the file
 *    during the read marks the record `unstable: true`.
 * 3. Start a second resolution window after creating a previously missing file and
 *    retargeting the symlink; assert the second window re-observes both
 *    candidates and symlink ancestors afresh rather than reusing the prior
 *    window.
 *
 * @evidence contracts/testing.md#behavioral-verification Exercises PluginDescriptorInputObserver with a counting filesystem operations adapter over a real temporary tree with a directory symlink, verifying exact syscall counts, emitted NDJSON records, instability detection and cross-window re-observation.
 * @evidence contracts/testing.md#independent-expectations Authored candidate counts, tree depth and literal file contents fix exact upper bounds on lstatSync, statSync and realpathSync.native calls and expected record fields independently of implementation internals.
 * @evidence contracts/testing.md#distinguishing-cases Missing siblings below a symlink ancestor, existing regular file, mid-read mutation, and a subsequent resolution window after file creation and symlink retargeting cover each validity boundary.
 * @evidence contracts/testing.md#execution-ownership Discovered unit calls PluginDescriptorInputObserver directly with injected counting filesystem operations over an owned temporary directory removed in finally; no fs global is replaced and no child process or host runs.
 */
export function test_plugin_descriptor_input_observer_deduplicates_ancestors_and_committed_inputs(): void {
  const root = fs.realpathSync.native(
    fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-descriptor-observer-")),
  );
  try {
    const realTarget = path.join(root, "store", "pkg");
    const altTarget = path.join(root, "store", "pkg-v2");
    const subDir = path.join(realTarget, "a", "b");
    fs.mkdirSync(subDir, { recursive: true });
    fs.mkdirSync(path.join(altTarget, "a", "b"), { recursive: true });
    const linkDir = path.join(root, "linked-pkg");
    fs.symlinkSync(
      realTarget,
      linkDir,
      process.platform === "win32" ? "junction" : "dir",
    );
    const existingFile = path.join(linkDir, "a", "b", "present.js");
    fs.writeFileSync(existingFile, "module.exports = 1;\n");

    const counts = {
      lstat: 0,
      stat: 0,
      realpath: 0,
      readFile: 0,
    };
    const resetCounts = (): void => {
      counts.lstat = 0;
      counts.stat = 0;
      counts.realpath = 0;
      counts.readFile = 0;
    };
    let mutateOnNextRead: (() => void) | undefined;

    const operations: PluginDescriptorInputObserver.FilesystemOperations = {
      lstatSync: ((target: fs.PathLike, options?: unknown) => {
        counts.lstat += 1;
        return fs.lstatSync(
          target,
          options as Parameters<typeof fs.lstatSync>[1],
        );
      }) as typeof fs.lstatSync,
      statSync: ((target: fs.PathLike, options?: unknown) => {
        counts.stat += 1;
        return fs.statSync(
          target,
          options as Parameters<typeof fs.statSync>[1],
        );
      }) as typeof fs.statSync,
      realpathSyncNative: (file: string) => {
        counts.realpath += 1;
        return fs.realpathSync.native(file);
      },
      readFileSync: (file: string) => {
        counts.readFile += 1;
        const bytes = fs.readFileSync(file);
        if (mutateOnNextRead !== undefined) {
          const run = mutateOnNextRead;
          mutateOnNextRead = undefined;
          run();
        }
        return bytes;
      },
    };

    const failures: unknown[] = [];
    const verify = (name: string, run: () => void): void => {
      try {
        run();
      } catch (cause) {
        failures.push(new Error(name, { cause }));
      }
    };

    const missingDir = path.join(linkDir, "a", "b", "missing-mod");
    const missingCandidates = Array.from({ length: 20 }, (_, i) =>
      path.join(missingDir, `cand-${i}.js`),
    );

    verify(
      "missing siblings share ancestor lstat and skip stat/realpath and duplicate symlink observations within one window",
      () => {
        const reference = PluginDescriptorInputObserver.observe({
          resolved: missingCandidates[0]!,
        });
        resetCounts();
        const window = PluginDescriptorInputObserver.createWindow(operations);
        const lines: string[] = [];
        for (const candidate of missingCandidates) {
          const result = window.observe({ resolved: candidate });
          assert.equal(result.missing, true);
          lines.push(...result.lines);
        }
        const parsed = lines.map(
          (line) =>
            JSON.parse(line) as {
              resolved: string;
              hash: string | null;
              realpath: string | null;
              signature?: string;
              unstable?: boolean;
            },
        );
        const linkRecords = parsed.filter(
          (entry) => entry.resolved === linkDir,
        );
        assert.equal(
          linkRecords.length,
          1,
          `symlink ancestor must be observed once in a window, got ${linkRecords.length}`,
        );
        assert.equal(
          parsed.filter((entry) => entry.resolved.startsWith(missingDir))
            .length,
          20,
        );
        assert.equal(
          lines[0],
          reference.lines[0],
          "window-observed missing candidate record must match unbatched observe() exactly",
        );
        assert.equal(
          lines[1],
          reference.lines[1],
          "window-observed symlink ancestor record must match unbatched observe() exactly",
        );
        assert.ok(
          parsed.every((entry) => entry.unstable !== true && entry.signature),
          "all stable missing candidates and the symlink ancestor must carry valid signatures",
        );
        // Only the single symlink ancestor observation needs realpathSync.native (1)
        // and statSync (2 for before/after symlink target); the 20 missing candidates need 0.
        assert.equal(
          counts.realpath,
          1,
          `missing candidates must not call realpathSync.native (only the 1 symlink ancestor), got ${counts.realpath}`,
        );
        assert.ok(
          counts.stat <= 3,
          `missing candidates must not call statSync (only symlink ancestor target), got ${counts.stat}`,
        );
        const ancestorDepth = path
          .relative(path.parse(missingCandidates[0]!).root, missingDir)
          .split(path.sep)
          .filter(Boolean).length;
        // At most: 20 candidate lstats + 1 per ancestor segment + 2 for the symlink before/after.
        const maxLstats = 20 + ancestorDepth + 4;
        assert.ok(
          counts.lstat <= maxLstats,
          `expected <= ${maxLstats} lstatSync calls (20 candidates + ${ancestorDepth} ancestors + symlink bracket), got ${counts.lstat}`,
        );
      },
    );

    verify(
      "existing file brackets read without redundant statSync and detects mid-read change",
      () => {
        resetCounts();
        const window = PluginDescriptorInputObserver.createWindow(operations);
        const stable = window.observe({ resolved: existingFile }, true);
        assert.equal(stable.missing, false);
        const stableRecord = JSON.parse(stable.lines[0]!) as {
          hash: string | null;
          realpath: string | null;
          unstable?: boolean;
        };
        assert.equal(stableRecord.unstable, undefined);
        assert.equal(
          stableRecord.realpath,
          fs.realpathSync.native(existingFile),
        );
        assert.equal(counts.readFile, 1);
        // Non-symlink existing file should not call statSync for hashOf; only symlink ancestor uses statSync.
        assert.ok(
          counts.stat <= 2,
          `existing regular file should not add redundant statSync, got ${counts.stat}`,
        );

        // Mutate the file during readFileSync and ensure unstable: true is emitted.
        mutateOnNextRead = () => {
          fs.writeFileSync(existingFile, "module.exports = 222;\n");
        };
        const racing = PluginDescriptorInputObserver.observe(
          { resolved: existingFile },
          true,
          undefined,
          operations,
        );
        const racingRecord = JSON.parse(racing.lines[0]!) as {
          unstable?: boolean;
        };
        assert.equal(
          racingRecord.unstable,
          true,
          "a file modified between beforeSignature and afterSignature must be marked unstable",
        );
      },
    );

    verify(
      "a subsequent resolution window observes candidates and symlink ancestors afresh",
      () => {
        // Create a previously missing candidate and retarget the symlink before
        // opening a second resolution window.
        fs.rmSync(linkDir, { force: true });
        fs.symlinkSync(
          altTarget,
          linkDir,
          process.platform === "win32" ? "junction" : "dir",
        );
        fs.mkdirSync(missingDir, { recursive: true });
        fs.writeFileSync(missingCandidates[0]!, "module.exports = 99;\n");

        const secondWindow =
          PluginDescriptorInputObserver.createWindow(operations);
        const observed = secondWindow.observe({
          resolved: missingCandidates[0]!,
        });
        assert.equal(observed.missing, false);
        const parsed = observed.lines.map(
          (line) =>
            JSON.parse(line) as {
              resolved: string;
              hash: string | null;
              realpath: string | null;
            },
        );
        const candidateRecord = parsed.find(
          (entry) => entry.resolved === missingCandidates[0],
        );
        const linkRecord = parsed.find((entry) => entry.resolved === linkDir);
        assert.ok(
          candidateRecord !== undefined &&
            candidateRecord.hash !== null &&
            candidateRecord.realpath ===
              fs.realpathSync.native(missingCandidates[0]!),
          "a new resolution window must observe the newly created candidate",
        );
        assert.ok(
          linkRecord !== undefined && linkRecord.realpath === altTarget,
          "a new resolution window must re-observe the retargeted symlink ancestor",
        );
      },
    );

    if (failures.length !== 0)
      throw new AggregateError(
        failures,
        "PluginDescriptorInputObserver deduplication matrix failed",
      );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

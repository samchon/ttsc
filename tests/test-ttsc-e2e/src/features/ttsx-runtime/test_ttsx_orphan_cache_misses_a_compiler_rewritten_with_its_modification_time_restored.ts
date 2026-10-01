import { TestProject } from "@ttsc/testing";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * Verifies the persistent orphan lowering cache is missed after the compiler is
 * rewritten in place with its size kept and its modification time restored.
 *
 * An earlier identity used path, size, modification time and file id, which a
 * same-size rewrite restoring modification time leaves unchanged (#1521).
 * The current owner observes lexical/physical metadata, including change time,
 * and streams actual contents into its fingerprint. This same-byte rewrite
 * specifically tests observed filesystem identity; changed-content hashing has
 * a separate direct source-unit owner.
 *
 * 1. Copy the compiler to a fixed path, pin its modification time to a whole
 *    second, and run an entry that requires a raw TypeScript package with no
 *    tsconfig, with a private `TTSC_CACHE_DIR`.
 * 2. Plant a marker in the one cached lowering and run again.
 * 3. Rewrite the compiler with the same bytes and restore its modification time,
 *    then run a third time.
 * 4. Assert the second run printed the marker and the third did not.
 * @evidence contracts/testing.md#behavioral-verification Three ttsx runs first lower rawpkg, then execute a planted cached marker, then omit the marker after rewriting compiler bytes in-place while preserving size and mtimeNs.
 * @evidence contracts/testing.md#independent-expectations The authored lowering text versus planted marker independently witnesses real cache reuse/miss. Explicit stat comparisons establish unchanged size/mtime rather than assuming filesystem precision.
 * @evidence contracts/testing.md#distinguishing-cases Unchanged compiler reuse contrasts with same-path/same-size/same-mtime rewrite. Compiler contents are the same bytes, so this tests filesystem-identity invalidation, not a different compiler implementation.
 * @evidence contracts/testing.md#execution-ownership The named test_ttsx_orphan_cache_misses_a_compiler_rewritten_with_its_modification_time_restored E2E entry owns the actual bootstrap and observations specified here. TestProject/internal helpers supply fixtures and completed process results; this acknowledgment does not infer portable unit coverage from similarly named tests.
 * @evidence contracts/e2e.md#necessary-boundary Real compiler identity observation must control persistent orphan bytes served by the next host. Direct fingerprint units cannot prove that cached lowering actually changes runtime execution.
 * @evidence contracts/e2e.md#shared-execution One copied compiler directory, raw package/project and private persistent cache serve three host lifetimes. Warm marker and invalidated state are the behavior, so clearing that cache would destroy the distinction.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Only fixture compiler/cache files mutate; the suite compiler is copied with its declarations. TestProject owns all copies, and synchronous runs prevent live compiler mutation during a build.
 * @evidence contracts/e2e.md#preserved-coverage Original first value, exactly one lowering, second marker, unchanged size/mtime and third exact value remain. The separate future-mtime variant's identical cold/warm/runtime observations share this stronger boundary, and test_runtime_executable_identity_tracks_bytes_and_metadata_without_running_a_binary owns its actual same-path future-mtime identity decision plus byte/chunk and invalid-candidate controls. This case does not explicitly assert ctime changed, though rewriting provides the intended filesystem event.
 */
export function test_ttsx_orphan_cache_misses_a_compiler_rewritten_with_its_modification_time_restored() {
    const root = TestProject.createProject({
      "package.json": JSON.stringify({ name: "orphan-cache", private: true }),
      "tsconfig.json": JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          outDir: "lib",
          types: [],
        },
        include: ["src"],
      }),
      "src/main.ts": [
        `declare const require: (id: string) => { value: string };`,
        `console.log(require("rawpkg").value);`,
        `export {};`,
        ``,
      ].join("\n"),
      "node_modules/rawpkg/package.json": JSON.stringify({
        name: "rawpkg",
        version: "1.0.0",
        main: "index.ts",
      }),
      "node_modules/rawpkg/index.ts": `export const value: string = "lowered";\n`,
    });
    // The compiler finds its `lib.*.d.ts` beside itself, so its directory
    // moves with it.
    const compilerDir = path.join(root, "compiler");
    fs.cpSync(path.dirname(TestProject.TSGO_BINARY), compilerDir, {
      recursive: true,
    });
    const compiler = path.join(
      compilerDir,
      path.basename(TestProject.TSGO_BINARY),
    );
    fs.chmodSync(compiler, 0o755);
    // A whole second every filesystem stores exactly, so the restore below
    // reproduces the modification time to the nanosecond.
    const stamp = 1_700_000_000;
    fs.utimesSync(compiler, stamp, stamp);
    const cacheDir = path.join(root, "orphan-cache");
    const run = () =>
      TestProject.spawn(TestProject.TTSX_BIN, ["--cwd", root, "src/main.ts"], {
        cwd: root,
        env: { TTSC_CACHE_DIR: cacheDir, TTSC_TSGO_BINARY: compiler },
      });

    const first = run();
    assert.equal(first.status, 0, first.stderr);
    assert.equal(first.stdout.trim(), "lowered");
    const orphanDir = path.join(cacheDir, "ttsx-orphan");
    const cached = fs
      .readdirSync(orphanDir)
      .filter((name) => name.endsWith(".js"));
    assert.equal(cached.length, 1, cached.join(", "));
    fs.appendFileSync(
      path.join(orphanDir, cached[0]!),
      `\nconsole.log("served from cache");\n`,
    );

    const second = run();
    assert.equal(second.status, 0, second.stderr);
    assert.match(second.stdout, /served from cache/);

    const before = fs.statSync(compiler, { bigint: true });
    fs.writeFileSync(compiler, fs.readFileSync(compiler));
    fs.utimesSync(compiler, stamp, stamp);
    const after = fs.statSync(compiler, { bigint: true });
    assert.equal(after.mtimeNs, before.mtimeNs);
    assert.equal(after.size, before.size);
    const third = run();
    assert.equal(third.status, 0, third.stderr);
    assert.equal(third.stdout.trim(), "lowered");
  }

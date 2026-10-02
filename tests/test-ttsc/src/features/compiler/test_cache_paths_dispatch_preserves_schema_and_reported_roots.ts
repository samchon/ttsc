import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { runTtsc } from "../../../../../packages/ttsc/src/launcher/internal/runTtsc";

/**
 * Verifies cache command parsing and reporting through its source dispatcher.
 *
 * The dispatcher interprets a real authored project manifest in process and
 * reports its paths without invoking a compiler. Exact status and stream text
 * distinguish schema refusals from a command that silently accepts everything.
 *
 * 1. Query canonical, mixed-case and project-alias arguments with explicit roots.
 * 2. Require independently authored path fields for each successful query.
 * 3. Reject attached/spaced JSON values and unsupported/unknown options with
 *    their literal errors, restoring captured streams and environment afterward.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls actual runTtsc and its private parseCachePathsArgs, project resolver and cache report operation. Three accepted argv lists require status zero and literal cwd/project/cache/plugin/Go roots plus required, cacheable and accelerator arrays. Four invalid lists require status two, empty stdout and exact stderr.
 * @evidence contracts/testing.md#independent-expectations Expected path components, source provenance and complete error messages are authored literals from the cache command contract; one command's report is never used as another's oracle.
 * @evidence contracts/testing.md#distinguishing-cases Canonical and uppercase JSON/cwd/cache names contrast with JSON attached true, spaced false, unsupported binary and unknown options. Project alias -P selects the authored tsconfig while both explicit and default cache roots are checked.
 * @evidence contracts/testing.md#execution-ownership This direct source unit uses a temporary resolver input and synchronous stream capture, spawns no command and builds no artifact. The E2E compiler corpus retains the real public cache command boundary; lexical refusals and report values belong here.
 */
export function test_cache_paths_dispatch_preserves_schema_and_reported_roots(): void {
  const allocated = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-cache-source-"));
  const envKeys = ["TTSC_CACHE_DIR", "TTSC_GO_CACHE_DIR", "GOCACHE"] as const;
  const previous = new Map(envKeys.map((key) => [key, process.env[key]]));
  const writeOut = process.stdout.write;
  const writeError = process.stderr.write;
  let stdout = "";
  let stderr = "";
  const failures: Error[] = [];
  const check = (argv: readonly string[], action: () => void): void => {
    try {
      action();
    } catch (cause) {
      failures.push(new Error(argv.join(" "), { cause }));
    }
  };
  process.stdout.write = ((chunk: string | Uint8Array): boolean => {
    stdout += chunk.toString();
    return true;
  }) as typeof process.stdout.write;
  process.stderr.write = ((chunk: string | Uint8Array): boolean => {
    stderr += chunk.toString();
    return true;
  }) as typeof process.stderr.write;
  try {
    const root = fs.realpathSync(allocated);
    fs.writeFileSync(path.join(root, "tsconfig.json"), '{"include":["src"]}');
    fs.writeFileSync(path.join(root, "pnpm-workspace.yaml"), "packages: []\n");
    fs.mkdirSync(path.join(root, "src"));
    fs.writeFileSync(path.join(root, "src", "main.ts"), "export const value = 1;\n");
    process.env.TTSC_CACHE_DIR = "";
    process.env.GOCACHE = "";
    const goRoot = path.join(root, "go-cache");
    process.env.TTSC_GO_CACHE_DIR = goRoot;
    for (const [argv, cacheRoot] of [
      [["--json", "--cwd", root, "--cache-dir", ".cache"], path.join(root, ".cache")],
      [["--JSON", "--Cwd", root, "--CACHE-DIR", ".cache"], path.join(root, ".cache")],
      [["--JSON", "--CWD", root, "-P", "tsconfig.json"], path.join(root, "node_modules", ".cache", "ttsc")],
    ] as const) {
      stdout = stderr = "";
      check(argv, () => {
        assert.equal(runTtsc(["cache", "paths", ...argv]), 0);
        assert.equal(stderr, "");
        assert.deepEqual(JSON.parse(stdout), {
          cacheRoot,
          acceleratorRoots: [goRoot],
          cacheableRoots: [cacheRoot, goRoot],
          cwd: root,
          goBuildCacheRoot: goRoot,
          goBuildCacheSource: "TTSC_GO_CACHE_DIR",
          pluginCacheRoot: path.join(cacheRoot, "plugins"),
          projectRoot: root,
          requiredRoots: [path.join(cacheRoot, "plugins")],
        });
      });
    }
    for (const [argv, expected] of [
      [["--json=true"], "ttsc: --json does not take a value\n"],
      [["--json", "false"], 'ttsc: cache paths does not support "false"\n'],
      [["--binary", "tsgo"], 'ttsc: cache paths does not support "--binary"\n'],
      [["--not-a-real-cache-option"], 'ttsc: cache paths does not support "--not-a-real-cache-option"\n'],
    ] as const) {
      stdout = stderr = "";
      check(argv, () => {
        assert.equal(runTtsc(["cache", "paths", ...argv]), 2);
        assert.equal(stdout, "");
        assert.equal(stderr, expected);
      });
    }
  } finally {
    process.stdout.write = writeOut;
    process.stderr.write = writeError;
    for (const [key, value] of previous)
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    fs.rmSync(allocated, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
  if (failures.length) throw new AggregateError(failures, "cache dispatcher source cases failed");
}

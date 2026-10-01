import assert from "node:assert/strict";
import path from "node:path";

import { parseTtsxCLI } from "../../../../../packages/ttsc/src/launcher/internal/parseTtsxCLI";
import { TtsxEntryOptions } from "../../../../../packages/ttsc/src/launcher/internal/TtsxEntryOptions";

/**
 * Verifies entry option applicability and preload identity without a launcher.
 *
 * JavaScript has no up-front TypeScript program; build-only fields must be
 * reported, while program arguments and package preload names stay untouched.
 *
 * 1. Project actual parsed requests into exact unsupported-option lists.
 * 2. Check all field boundaries and mixed forwarded option/value shapes.
 * 3. Resolve file preloads using native paths and preserve bare/scoped/subpath requests.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual parseTtsxCLI and TtsxEntryOptions return exact JavaScript build-option diagnostics and native preload file paths while preserving package requests; no CLI or compiler executes to reach these decisions.
 * @evidence contracts/testing.md#independent-expectations JavaScript entries cannot apply up-front TypeScript build policy, and Node owns package resolution; explicit fields/token literals define diagnostic order while native path.resolve independently defines requested file anchors.
 * @evidence contracts/testing.md#distinguishing-cases Original strict/project/no-plugins/response requests, all five launcher fields, zero/false/empty versus absent values, mixed option/value forwarding and post-entry options cover applicability; relative/absolute paths versus bare/scoped/subpath/empty requests cover preload ownership.
 * @evidence contracts/testing.md#execution-ownership This filename-matching named source unit calls authored pure functions in one test process without fixtures requiring installation, native build or product host. One actual JavaScript rejection transports diagnostics, and the shared mixed-preload host retains positive TypeScript and real package/file preload connections.
 */
export function test_ttsx_entry_options_preserve_preload_identity_and_reject_only_build_policy(): void {
  const parsed = (args: string[]) => {
    const result = parseTtsxCLI(args);
    assert.ok(result !== "help" && result !== "version");
    return result;
  };
  const failures: Error[] = [];
  const check = (name: string, operation: () => void) => {
    try { operation(); } catch (error) { failures.push(new Error(name, { cause: error })); }
  };
  for (const [args, expected] of [
    [["--strict", "script.js"], ["--strict"]],
    [["-P", "tsconfig.json", "script.js"], ["--project"]],
    [["--no-plugins", "script.js"], ["--no-plugins"]],
    [["@args.txt", "script.js"], ["@args.txt"]],
    [["script.js", "--strict", "--project", "ignored.json"], []],
    [["-r", "@scope/preload", "--require", "plain-preload/register", "script.js"], []],
  ] as [string[], string[]][]) check(args.join(" "), () => assert.deepEqual(TtsxEntryOptions.unsupportedJavaScriptBuildOptions(parsed(args)), expected));
  const base = parsed(["script.js"]);
  check("all-fields-and-option-values", () => assert.deepEqual(TtsxEntryOptions.unsupportedJavaScriptBuildOptions({ ...base, project: "", cacheDir: "", checkers: 0, noPlugins: true, singleThreaded: true, tsgoFlags: ["--strict", "false", "@args.txt", "--target", "es2022", "value"] }), ["--project", "--cache-dir", "--checkers", "--no-plugins", "--singleThreaded", "--strict", "@args.txt", "--target"]));
  check("absent-and-false", () => assert.deepEqual(TtsxEntryOptions.unsupportedJavaScriptBuildOptions({ ...base, noPlugins: false, singleThreaded: false, tsgoFlags: ["value", "false"] }), []));
  const cwd = path.resolve("ttsx-native-entry-options");
  for (const input of [".", "..", "./preload.cjs", "../preload.cjs", ".\\preload.cjs", "..\\preload.cjs", path.join(cwd, "absolute.cjs")])
    check("file/" + input, () => assert.equal(TtsxEntryOptions.resolvePreload(cwd, input), path.resolve(cwd, input)));
  for (const input of ["", "plain", "@scope/preload", "plain-preload/register", "plain.with.dots"])
    check("package/" + input, () => assert.equal(TtsxEntryOptions.resolvePreload(cwd, input), input));
  if (failures.length)
    throw new AggregateError(failures, "entry option decisions failed");
}

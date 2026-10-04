import assert from "node:assert/strict";
import path from "node:path";

import { TtsxEntryOptions } from "../../../../../packages/ttsc/src/launcher/internal/TtsxEntryOptions";
import { parseTtsxCLI } from "../../../../../packages/ttsc/src/launcher/internal/parseTtsxCLI";
import { parseTtscBuildArgs } from "../../../../../packages/ttsc/src/launcher/internal/parseTtscBuildArgs";
import { parseFlags } from "../../../../../packages/ttsc/src/flags/parseFlags";

/**
 * Verifies entry option applicability and preload identity without a launcher.
 *
 * JavaScript has no up-front TypeScript program; build-only fields must be
 * reported, while program arguments and package preload names stay untouched.
 * Project/rootDir and response-token counterparts observe parsing only; native
 * response expansion, strict diagnostics, emitted paths and CLI startup remain
 * separate execution observations.
 *
 * 1. Project actual parsed requests into exact unsupported-option lists.
 * 2. Check all field boundaries and native scalar widths, including dash/@
 *    operands.
 * 3. Resolve file preloads using native paths and preserve bare/scoped/subpath
 *    requests.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual parseTtsxCLI and TtsxEntryOptions return exact JavaScript build-option diagnostics and native preload file paths while preserving package requests; no CLI or compiler executes to reach these decisions.
 * @evidence contracts/testing.md#independent-expectations JavaScript entries cannot apply up-front TypeScript build policy, and Node owns package resolution; explicit fields/token literals define diagnostic order while native path.resolve independently defines requested file anchors.
 * @evidence contracts/testing.md#distinguishing-cases Parsed requests with --strict, -P, --no-plugins and an @response file are reported; the same options after the entry, and -r package preloads, are not. Scalar --target, --rootDir and --jsxFactory consume dash/@ operands without reporting those operands, while a later actual response request remains reported. All five launcher fields set to empty-string, zero or true are reported while false and absent are not; a mixed forwarded list reports requests but not their values. For preloads, ".", "..", ./ ../ .\ ..\ spellings and an absolute path are anchored with path.resolve, while "", "plain", "@scope/preload", "plain-preload/register" and "plain.with.dots" are returned unchanged.
 * @evidence contracts/testing.md#execution-ownership Unit test discovered once under src/features/ttsx-runtime; it calls parseTtsxCLI, TtsxEntryOptions.unsupportedJavaScriptBuildOptions and TtsxEntryOptions.resolvePreload on in-memory values, collecting failures into one AggregateError. No file is written and no launcher, compiler or process runs.
 */
export function test_ttsx_entry_options_preserve_preload_identity_and_reject_only_build_policy(): void {
  const parsed = (args: string[]) => {
    const result = parseTtsxCLI(args);
    assert.ok(result !== "help" && result !== "version");
    return result;
  };
  const failures: Error[] = [];
  const check = (name: string, operation: () => void) => {
    try {
      operation();
    } catch (error) {
      failures.push(new Error(name, { cause: error }));
    }
  };
  for (const [args, expected] of [
    [["--strict", "script.js"], ["--strict"]],
    [["-P", "tsconfig.json", "script.js"], ["--project"]],
    [["--no-plugins", "script.js"], ["--no-plugins"]],
    [["@args.txt", "script.js"], ["@args.txt"]],
    [["script.js", "--strict", "--project", "ignored.json"], []],
    [
      [
        "-r",
        "@scope/preload",
        "--require",
        "plain-preload/register",
        "script.js",
      ],
      [],
    ],
    [["--target", "--help", "script.js"], ["--target"]],
    [["--target", "@value", "script.js"], ["--target"]],
    [["--rootDir", "--module", "script.js"], ["--rootDir"]],
    [["--rootDir", "@dir", "script.js"], ["--rootDir"]],
    [["--jsxFactory", "@factory", "script.js"], ["--jsxFactory"]],
    [["--strict", "false", "script.js"], ["--strict"]],
    [["--target", "es2022", "script.js"], ["--target"]],
    [
      ["--rootDir", "@dir", "@actual", "script.js"],
      ["--rootDir", "@actual"],
    ],
    [["script.js", "--rootDir", "@dir"], []],
  ] as [string[], string[]][])
    check(args.join(" "), () =>
      assert.deepEqual(
        TtsxEntryOptions.unsupportedJavaScriptBuildOptions(parsed(args)),
        expected,
      ),
    );
  const base = parsed(["script.js"]);
  check("all-fields-and-option-values", () =>
    assert.deepEqual(
      TtsxEntryOptions.unsupportedJavaScriptBuildOptions({
        ...base,
        project: "",
        cacheDir: "",
        checkers: 0,
        noPlugins: true,
        singleThreaded: true,
        tsgoFlags: [
          "--strict",
          "false",
          "@args.txt",
          "--target",
          "es2022",
          "value",
        ],
      }),
      [
        "--project",
        "--cache-dir",
        "--checkers",
        "--no-plugins",
        "--singleThreaded",
        "--strict",
        "@args.txt",
        "--target",
      ],
    ),
  );
  check("absent-and-false", () =>
    assert.deepEqual(
      TtsxEntryOptions.unsupportedJavaScriptBuildOptions({
        ...base,
        noPlugins: false,
        singleThreaded: false,
        tsgoFlags: ["value", "false"],
      }),
      [],
    ),
  );
  const cwd = path.resolve("ttsx-native-entry-options");
  for (const input of [
    ".",
    "..",
    "./preload.cjs",
    "../preload.cjs",
    ".\\preload.cjs",
    "..\\preload.cjs",
    path.join(cwd, "absolute.cjs"),
  ])
    check("file/" + input, () =>
      assert.equal(
        TtsxEntryOptions.resolvePreload(cwd, input),
        path.resolve(cwd, input),
      ),
    );
  for (const input of [
    "",
    "plain",
    "@scope/preload",
    "plain-preload/register",
    "plain.with.dots",
  ])
    check("package/" + input, () =>
      assert.equal(TtsxEntryOptions.resolvePreload(cwd, input), input),
    );
  check("aggregate-javascript-build-policy", () => {
    const args = ["--strict", "-P", "tsconfig.json", "--no-plugins", "@args.txt", "script.js"];
    const before = [...args];
    const options = parsed(args);
    assert.deepEqual(TtsxEntryOptions.unsupportedJavaScriptBuildOptions(options), ["--project", "--no-plugins", "--strict", "@args.txt"]);
    assert.equal(options.entry, "script.js");
    assert.deepEqual(options.passthrough, []);
    assert.deepEqual(args, before);
  });
  for (const flags of [["-P", "alt/tsconfig.json"], ["-P=alt/tsconfig.json"], ["--project", "configs/app.json"]])
    check("project-selection/" + flags.join(" "), () => {
      const options = parsed([...flags, "src/main.ts"]);
      assert.equal(options.project, flags[0] === "--project" ? "configs/app.json" : "alt/tsconfig.json");
      assert.equal(options.entry, "src/main.ts");
      assert.deepEqual(options.tsgoFlags, []);
      assert.deepEqual(options.passthrough, []);
    });
  for (const rootDir of [".", "src"])
    check("rootDir-partition/" + rootDir, () => {
      const flags = ["--rootDir", rootDir];
      const runtime = parsed([...flags, "src/main.ts"]);
      assert.equal(runtime.entry, "src/main.ts");
      assert.deepEqual(runtime.tsgoFlags, flags);
      assert.deepEqual(runtime.passthrough, []);
      const buildArgs = ["src/main.ts", ...flags];
      const before = [...buildArgs];
      const build = parseTtscBuildArgs(buildArgs);
      assert.deepEqual(build.files, ["src/main.ts"]);
      assert.deepEqual(build.passthrough, flags);
      assert.deepEqual(buildArgs, before);
    });
  for (const flags of [
    ["--strict"],
    ["--outDir", "distx"],
    ["--declaration", "--declarationDir", "typesx"],
    ["--incremental", "--tsBuildInfoFile", "state/run.tsbuildinfo"],
    ["--outFile", "bundle.js"],
    ["--noEmit"],
    ["--emitDeclarationOnly", "--declaration"],
    ["--noEmit", "--emitDeclarationOnly", "--declaration"],
    ["@args.txt"],
    ["--target", "es2019", "@args.txt"],
    ["@args.txt", "--target", "es2019"],
  ]) check("compiler-token-partition/" + flags.join(" "), () => {
    const argv = [...flags, "src/main.ts"];
    const before = [...argv];
    const raw = parseFlags({ argv, errorPrefix: "ttsx:", subcommand: "ttsx", forwardAfterFirstPositional: true, honorDoubleDashSeparator: true });
    assert.deepEqual(raw.positional, ["src/main.ts"]);
    assert.deepEqual(raw.passthrough, flags);
    assert.deepEqual(raw.tail, []);
    const runtime = parsed(argv);
    assert.deepEqual(runtime.tsgoFlags, flags);
    assert.equal(runtime.entry, "src/main.ts");
    assert.deepEqual(runtime.passthrough, []);
    assert.deepEqual(argv, before);
  });
  if (failures.length)
    throw new AggregateError(failures, "entry option decisions failed");
}

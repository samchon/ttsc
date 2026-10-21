import assert from "node:assert/strict";
import path from "node:path";

import { compilerArgsAsConfigOptions } from "../../../../../packages/ttsc/src/launcher/internal/compilerArgsAsConfigOptions";

/**
 * Verifies that compiler arguments become the tsconfig options the compiler
 * would have parsed from them, and that arguments a tsconfig cannot carry make
 * the translation unavailable.
 *
 * An in-memory single-root build writes the command-line build's arguments into
 * its extending tsconfig. A value converted differently from the native
 * command-line parser would silently build a different program.
 *
 * 1. Translate each option kind: booleans, numbers, enums, strings, paths, lists
 *    of strings, enums and paths, and `null` resets.
 * 2. Translate repeated and adjacent options for last-wins and lookahead.
 * 3. Refuse every argument class a tsconfig cannot carry.
 *
 * @evidence contracts/testing.md#behavioral-verification Calls the production compilerArgsAsConfigOptions with literal argv and compares the whole returned record.
 * @evidence contracts/testing.md#independent-expectations Expected records follow TypeScript-Go's command-line parser (parseOptionValue and ParseListTypeOption): last occurrence wins, null resets, enum values are trimmed and lowercased, list values are TrimSpace'd, split at commas and lose empty members while string members keep inner spaces, a dash-prefixed or empty list value assigns an empty list without consuming the token, and command-line paths resolve against the working directory.
 * @evidence contracts/testing.md#distinguishing-cases Path options contrast with plain string options, string lists with enum and path lists, a reset with an assignment, a config-only option's null reset with its refused value, and each refused class (response file, file operand, unknown option, command-line-only option, project selection, trace output, configDir template) with the translatable cases.
 * @evidence contracts/testing.md#execution-ownership A pure source unit: no file, process or compiler is touched; paths are resolved against an authored working directory.
 */
export function test_compiler_args_as_config_options_follow_the_command_line_grammar(): void {
  const cwd = path.resolve("/workspace/project");
  for (const [args, expected] of [
    [
      ["--strict", "--noEmit", "false", "--allowJs", "null"],
      { strict: true, noEmit: false, allowJs: null },
    ],
    [
      ["--target", "ES2019", "--target", "  ESNext ", "--module", "CommonJS"],
      { target: "esnext", module: "commonjs" },
    ],
    [
      ["--maxNodeModuleJsDepth", "2", "--jsxFactory", "h", "--outFile", "null"],
      { maxNodeModuleJsDepth: 2, jsxFactory: "h", outFile: null },
    ],
    [
      ["--outDir", "rel/out", "--tsBuildInfoFile", "../state/info"],
      {
        outDir: path.resolve(cwd, "rel/out"),
        tsBuildInfoFile: path.resolve(cwd, "../state/info"),
      },
    ],
    [
      ["--lib", " ESNext, DOM,,", "--types", "node,, foo"],
      { lib: ["esnext", "dom"], types: ["node", " foo"] },
    ],
    [
      ["--typeRoots", "a,../b"],
      { typeRoots: [path.resolve(cwd, "a"), path.resolve(cwd, "../b")] },
    ],
    [["--types", "--strict"], { types: [], strict: true }],
    [["--paths", "null"], { paths: null }],
  ] as const)
    assert.deepEqual(
      compilerArgsAsConfigOptions(args, cwd),
      expected,
      args.join(" "),
    );

  for (const args of [
    ["@args.txt"],
    ["--strict", "src/extra.ts"],
    ["--noSuchCompilerOption"],
    ["--showConfig"],
    ["--listFilesOnly"],
    ["--project", "tsconfig.json"],
    ["-p", "tsconfig.json"],
    ["--generateTrace", "trace"],
    ["--rootDirs", "a,b"],
    ["--outDir", "${configDir}/out"],
  ])
    assert.equal(
      compilerArgsAsConfigOptions(args, cwd),
      undefined,
      args.join(" "),
    );
}

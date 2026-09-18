import type { FlagSpec } from "./FlagSpec";

/**
 * Single source of truth for every flag the ttsc / ttsx CLI accepts. New flags
 * are added here and only here; the generator rebuilds the parsers and the Go
 * allow-lists from this table.
 *
 * One declaration per flag, consumed by every layer that needs to know about
 * it:
 *
 * - `packages/ttsc/src/flags/parseFlags.ts`: the runtime parsing engine behind
 *   `runTtsc` and `runTtsx`.
 * - `packages/ttsc/scripts/gen-flags.mts`: the generator that emits the Go
 *   allow-lists and the docs table below.
 * - `packages/ttsc/cmd/ttsc/flags_gen.go` and
 *   `packages/ttsc/utility/flags_gen.go`: the generated host allow-list.
 * - `packages/lint/linthost/flags_gen.go`: the generated lint allow-list.
 * - `website/src/content/docs/ttsc/flags.mdx`: the generated reference table.
 *
 * The generator runs from `pnpm format`, and its committed output is the spec
 * the Go side reads. Editing a generated file by hand is rejected by the
 * `check:flags` drift check.
 *
 * Constraints enforced by the parser and the generator:
 *
 * 1. Every flag is uniquely identified by `name`; aliases must not collide with
 *    other flags' `name` or `aliases`.
 * 2. A flag listed in `consumedBy: ["launcher"]` without a `forwardTo`
 *    consumes-not-forwards. The generator flags this in the docs and the Go
 *    allow-list so the boundary is explicit.
 * 3. A flag with `subcommands` covering `clean` or `prepare` is parsed by the
 *    project-args lane; the parsing engine accepts the same flag in build /
 *    check / fix / format without a separate parser.
 */
export const FLAG_SCHEMA: readonly FlagSpec[] = [
  // -------------------------------------------------------------------------
  // ttsc — terminal flags (print and exit; never wrapped in pre-emit pass)
  // -------------------------------------------------------------------------
  {
    name: "--help",
    aliases: ["-h"],
    kind: "boolean",
    subcommands: ["ttsc", "ttsx", "build", "check", "fix", "format"],
    consumedBy: ["launcher"],
    terminal: true,
    description: "Show command help and exit.",
  },
  {
    name: "--version",
    aliases: ["-v"],
    kind: "boolean",
    subcommands: ["ttsc", "ttsx"],
    consumedBy: ["launcher"],
    terminal: true,
    description: "Print the launcher version and exit.",
  },

  // -------------------------------------------------------------------------
  // Solution build mode — declared so the launcher can refuse it in its own
  // voice instead of forwarding it.
  //
  // `createTsgoBuildArgs` opens the forwarded argv with `-p <tsconfig>` because
  // ttsc resolves the project itself (extends chains, plugin config discovery,
  // cache keys, resident session identity) and pins the result. A forwarded
  // `--build` therefore always lands after `-p`, and tsgo answers with TS6369
  // "Option '--build' must be the first command line argument" — a diagnostic
  // that contradicts the command line the user actually typed. ttsc's plugin,
  // cache, and emit architecture is built around one resolved project, so
  // solution mode is unsupported rather than merely misordered.
  // -------------------------------------------------------------------------
  {
    name: "--build",
    aliases: ["-b"],
    kind: "boolean",
    subcommands: ["ttsc", "ttsx", "build", "check", "fix", "format"],
    consumedBy: ["launcher"],
    description:
      "Refused by the launcher: ttsc pins one resolved project, so tsgo's solution-build mode is unsupported.",
  },

  // -------------------------------------------------------------------------
  // Project location: shared by every subcommand.
  // -------------------------------------------------------------------------
  {
    name: "--tsconfig",
    aliases: ["-p", "--project"],
    kind: "value",
    subcommands: [
      "ttsc",
      "ttsx",
      "build",
      "cache",
      "check",
      "fix",
      "format",
      "prepare",
      "clean",
    ],
    consumedBy: ["launcher", "host", "lint"],
    description: "Resolve project settings from this tsconfig.",
  },
  {
    name: "--cwd",
    kind: "value",
    subcommands: [
      "ttsc",
      "ttsx",
      "build",
      "cache",
      "check",
      "fix",
      "format",
      "prepare",
      "clean",
    ],
    consumedBy: ["launcher", "host", "lint"],
    description: "Resolve project-relative paths from this directory.",
  },

  // -------------------------------------------------------------------------
  // Emit / build mode.
  // -------------------------------------------------------------------------
  {
    name: "--emit",
    kind: "boolean",
    subcommands: ["ttsc", "build", "check"],
    consumedBy: ["launcher", "runBuild", "host", "lint"],
    description: "Force emitted files during build.",
  },
  {
    name: "--noEmit",
    kind: "boolean",
    subcommands: ["ttsc", "build", "check"],
    consumedBy: ["launcher", "runBuild", "host", "lint"],
    internalShadow: true,
    description: "Force analysis-only build with no file writes.",
  },
  {
    name: "--outDir",
    kind: "value",
    subcommands: ["ttsc", "build", "check"],
    consumedBy: ["launcher", "host", "lint"],
    description: "Override compilerOptions.outDir for this invocation.",
  },
  {
    name: "--composite",
    kind: "boolean",
    subcommands: ["ttsc", "ttsx", "build", "check", "fix", "format"],
    consumedBy: ["tsgo"],
    forwardTo: "tsgo",
    tsconfigOnly: true,
    description:
      "Configure project-reference constraints in tsconfig; CLI accepts only false or null.",
  },
  {
    name: "--incremental",
    aliases: ["-i"],
    kind: "boolean",
    subcommands: ["ttsc", "ttsx", "build", "check", "fix", "format"],
    consumedBy: ["tsgo"],
    forwardTo: "tsgo",
    description: "Write build information for incremental compilation.",
  },
  {
    name: "--tsBuildInfoFile",
    kind: "value",
    subcommands: ["ttsc", "ttsx", "build", "check", "fix", "format"],
    consumedBy: ["tsgo"],
    forwardTo: "tsgo",
    description: "Choose the incremental build-information file.",
  },
  {
    name: "--declaration",
    aliases: ["-d"],
    kind: "boolean",
    subcommands: ["ttsc", "ttsx", "build", "check", "fix", "format"],
    consumedBy: ["tsgo"],
    forwardTo: "tsgo",
    description: "Emit declaration files.",
  },
  {
    name: "--declarationDir",
    kind: "value",
    subcommands: ["ttsc", "ttsx", "build", "check", "fix", "format"],
    consumedBy: ["tsgo"],
    forwardTo: "tsgo",
    description: "Choose the declaration output directory.",
  },
  {
    name: "--declarationMap",
    kind: "boolean",
    subcommands: ["ttsc", "ttsx", "build", "check", "fix", "format"],
    consumedBy: ["tsgo"],
    forwardTo: "tsgo",
    description: "Emit source maps for declaration files.",
  },
  {
    name: "--emitDeclarationOnly",
    kind: "boolean",
    subcommands: ["ttsc", "ttsx", "build", "check", "fix", "format"],
    consumedBy: ["tsgo"],
    forwardTo: "tsgo",
    description: "Emit declarations without JavaScript.",
  },
  {
    name: "--inlineSourceMap",
    kind: "boolean",
    subcommands: ["ttsc", "ttsx", "build", "check", "fix", "format"],
    consumedBy: ["tsgo"],
    forwardTo: "tsgo",
    description: "Inline source maps into emitted JavaScript.",
  },
  {
    name: "--sourceMap",
    kind: "boolean",
    subcommands: ["ttsc", "ttsx", "build", "check", "fix", "format"],
    consumedBy: ["tsgo"],
    forwardTo: "tsgo",
    description: "Emit external JavaScript source maps.",
  },
  {
    name: "--outFile",
    kind: "value",
    subcommands: ["ttsc", "ttsx", "build", "check", "fix", "format"],
    consumedBy: ["tsgo"],
    forwardTo: "tsgo",
    description:
      "Forward the removed legacy option for TypeScript-Go's diagnostic.",
  },
  {
    name: "--rootDir",
    kind: "value",
    subcommands: ["ttsc", "ttsx", "build", "check", "fix", "format"],
    consumedBy: ["tsgo"],
    forwardTo: "tsgo",
    description: "Choose the compiler input root.",
  },
  {
    name: "--jsx",
    kind: "value",
    subcommands: ["ttsc", "ttsx", "build", "check", "fix", "format"],
    consumedBy: ["tsgo"],
    forwardTo: "tsgo",
    description: "Choose the JSX emit transform.",
  },

  // -------------------------------------------------------------------------
  // Watch mode (launcher only).
  // -------------------------------------------------------------------------
  {
    name: "--watch",
    aliases: ["-w"],
    kind: "boolean",
    subcommands: ["ttsc", "build", "check"],
    consumedBy: ["launcher"],
    description: "Rebuild when project files change.",
  },
  {
    name: "--preserveWatchOutput",
    kind: "boolean",
    subcommands: ["ttsc", "build", "check"],
    consumedBy: ["launcher"],
    description: "Do not clear the screen between watch rebuilds.",
  },

  // -------------------------------------------------------------------------
  // Output verbosity.
  // -------------------------------------------------------------------------
  {
    name: "--quiet",
    kind: "boolean",
    subcommands: ["ttsc", "build", "check", "fix", "format"],
    consumedBy: ["launcher", "host", "lint"],
    description: "Keep build output quiet (default).",
  },
  {
    name: "--verbose",
    kind: "boolean",
    subcommands: ["ttsc", "build", "check", "fix", "format"],
    consumedBy: ["launcher", "host", "lint"],
    description: "Print the build summary and emitted files.",
  },

  // -------------------------------------------------------------------------
  // tsgo-binary / cache plumbing (consumed by launcher, not forwarded).
  // -------------------------------------------------------------------------
  {
    name: "--binary",
    kind: "value",
    subcommands: [
      "ttsc",
      "ttsx",
      "build",
      "check",
      "fix",
      "format",
      "prepare",
      "clean",
    ],
    consumedBy: ["launcher"],
    description: "Use an explicit tsgo binary.",
  },
  {
    name: "--cache-dir",
    kind: "value",
    subcommands: [
      "ttsc",
      "ttsx",
      "build",
      "cache",
      "check",
      "fix",
      "format",
      "prepare",
      "clean",
    ],
    consumedBy: ["launcher"],
    description: "Override the runner and source-plugin cache root.",
  },
  {
    name: "--json",
    kind: "boolean",
    subcommands: ["cache"],
    consumedBy: ["launcher"],
    description: "Print cache paths as JSON.",
  },

  // -------------------------------------------------------------------------
  // Threading (tsgo-native; lint host opts in via capability).
  // -------------------------------------------------------------------------
  {
    name: "--singleThreaded",
    kind: "boolean",
    subcommands: ["ttsc", "ttsx", "build", "check", "fix", "format"],
    consumedBy: ["launcher", "runBuild", "tsgo", "host", "lint"],
    nativeCapability: "threadingArgs",
    description: "Run TypeScript-Go single-threaded (one checker).",
  },
  {
    name: "--checkers",
    kind: "value",
    validator: "positiveInt",
    subcommands: ["ttsc", "ttsx", "build", "check", "fix", "format"],
    consumedBy: ["launcher", "runBuild", "tsgo", "host", "lint"],
    nativeCapability: "threadingArgs",
    description: "Type-checker pool size (default: TypeScript-Go's).",
  },

  // -------------------------------------------------------------------------
  // ttsx-specific options.
  // -------------------------------------------------------------------------
  {
    name: "--require",
    aliases: ["-r"],
    kind: "value",
    repeatable: true,
    subcommands: ["ttsx"],
    consumedBy: ["launcher"],
    description: "Preload a module before the entrypoint (ttsx; repeatable).",
  },
  {
    name: "--no-plugins",
    kind: "boolean",
    subcommands: ["ttsx"],
    consumedBy: ["launcher"],
    description: "Build the project without ttsc plugins (ttsx).",
  },

  // -------------------------------------------------------------------------
  // tsgo-internal flags ttsc adds itself; users may also forward them.
  // Declaring them keeps the launcher's parser from treating them as
  // unknown forwarded flags whose value token gets misclassified.
  // -------------------------------------------------------------------------
  {
    name: "--listEmittedFiles",
    kind: "boolean",
    subcommands: ["ttsc", "build", "check"],
    consumedBy: ["runBuild", "tsgo"],
    forwardTo: "tsgo",
    internalShadow: true,
    description:
      "Print the list of emitted files (forwarded to tsgo; ttsc keeps the lines when forwarded).",
  },
  {
    // tsgo declares `--pretty` as `type: boolean`, so it occupies one argv
    // token and consumes a following one only when that token is the literal
    // `true` or `false` — the shape the engine's boolean branch implements.
    // Declaring it `value` made the forwarding path swallow whatever followed,
    // so `ttsc --pretty a.ts` lost its input file and silently switched to
    // project mode.
    name: "--pretty",
    kind: "boolean",
    subcommands: ["ttsc", "ttsx", "build", "check", "fix", "format"],
    consumedBy: ["tsgo"],
    forwardTo: "tsgo",
    internalShadow: true,
    description: "Toggle tsgo pretty-printed diagnostics (forwarded to tsgo).",
  },
  {
    name: "--diagnostics",
    kind: "boolean",
    subcommands: ["ttsc", "ttsx", "build", "check", "fix", "format"],
    consumedBy: ["runBuild", "tsgo", "lint"],
    forwardTo: "tsgo",
    nativeCapability: "diagnosticsTiming",
    description:
      "Print compiler performance information; plugin-backed ttsc runs add plugin wall-clock timings.",
  },
  {
    name: "--extendedDiagnostics",
    kind: "boolean",
    subcommands: ["ttsc", "ttsx", "build", "check", "fix", "format"],
    consumedBy: ["runBuild", "tsgo", "lint"],
    forwardTo: "tsgo",
    nativeCapability: "diagnosticsTiming",
    description:
      "Print detailed compiler performance information; plugin-backed ttsc runs add plugin wall-clock timings.",
  },
  {
    name: "--showConfig",
    kind: "boolean",
    subcommands: ["ttsc", "build", "check"],
    consumedBy: ["tsgo"],
    forwardTo: "tsgo",
    terminal: true,
    description: "Print the resolved tsconfig and exit (forwarded to tsgo).",
  },
  {
    name: "--listFilesOnly",
    kind: "boolean",
    subcommands: ["ttsc", "build", "check"],
    consumedBy: ["tsgo"],
    forwardTo: "tsgo",
    terminal: true,
    description: "Print the project file list and exit (forwarded to tsgo).",
  },
  {
    name: "--all",
    kind: "boolean",
    subcommands: ["ttsc", "build", "check"],
    consumedBy: ["tsgo"],
    forwardTo: "tsgo",
    terminal: true,
    projectFree: true,
    description: "Print the full tsgo CLI help and exit.",
  },
  {
    name: "--init",
    kind: "boolean",
    subcommands: ["ttsc", "build", "check"],
    consumedBy: ["tsgo"],
    forwardTo: "tsgo",
    terminal: true,
    projectFree: true,
    description: "Write a starter tsconfig.json and exit (forwarded to tsgo).",
  },
  {
    // tsgo's short synonym for `--help`. ttsc owns `--help` / `-h` itself (the
    // launcher prints its own help), so `-?` is declared as its own tsgo-only
    // row rather than as an alias — that keeps `ttsc -?` printing tsgo's help
    // while putting the token inside the schema, where the terminal and
    // project-free classifications are derived from.
    name: "-?",
    kind: "boolean",
    subcommands: ["ttsc", "build", "check"],
    consumedBy: ["tsgo"],
    forwardTo: "tsgo",
    terminal: true,
    projectFree: true,
    description: "Print the tsgo CLI help and exit (forwarded to tsgo).",
  },

  // -------------------------------------------------------------------------
  // `--tsgo-args` — JSON-encoded passthrough envelope a native sidecar decodes
  // back into the tsgo argv. Listed here so the schema describes every flag
  // the Go layers accept, not just the user-facing ones.
  //
  // The launcher no longer emits it. A CLI flag is fatal to any host whose
  // `flag.FlagSet` does not declare it, and this one was added to a plugin
  // protocol third-party hosts had already frozen, so every forwarded compiler
  // flag exited 2 on a typia/nestia-shaped sidecar (issue #1188). The payload
  // now rides the `TTSC_TSGO_ARGS` environment variable, which an unaware host
  // simply ignores. ttsc's own hosts still accept the flag so an older
  // launcher, or an embedder that composes sidecar argv itself, keeps working.
  // -------------------------------------------------------------------------
  {
    name: "--tsgo-args",
    kind: "value",
    subcommands: [
      "ttsc",
      "build",
      "check",
      "fix",
      "format",
      "prepare",
      "clean",
    ],
    consumedBy: ["host", "lint"],
    description:
      "JSON-encoded tsgo passthrough argv (internal: accepted by ttsc's own hosts; the launcher forwards it in TTSC_TSGO_ARGS).",
  },
  {
    name: "--plugins-json",
    kind: "value",
    subcommands: ["build", "check", "fix", "format"],
    consumedBy: ["host", "lint"],
    description:
      "JSON-encoded ttsc plugin manifest (internal: emitted by runBuild).",
  },
  {
    name: "--project-context-json",
    kind: "value",
    subcommands: ["build", "check", "fix", "format"],
    consumedBy: ["lint"],
    description:
      "JSON-encoded lexical and physical project identity (internal: emitted by runBuild).",
  },
  {
    name: "--manifest",
    kind: "value",
    subcommands: ["build"],
    consumedBy: ["host"],
    description:
      "Write emitted file list as JSON to this path (host build only).",
  },
  {
    name: "--file",
    kind: "value",
    subcommands: ["build", "check"],
    consumedBy: ["lint"],
    description:
      "Absolute or cwd-relative path of the .ts file to transform (lint transform only).",
  },
  {
    name: "--out",
    kind: "value",
    subcommands: ["build", "check"],
    consumedBy: ["lint"],
    description:
      "Write transform output to PATH (lint transform only; default: stdout).",
  },
];

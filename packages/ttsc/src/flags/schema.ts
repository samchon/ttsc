// SOURCE-OF-TRUTH FLAG SCHEMA for the ttsc / ttsx command-line surface.
//
// One declaration per flag, consumed by every layer that needs to know about
// the flag:
//
//   * `packages/ttsc/src/flags/parser.ts`    — runtime TS parsing engine used
//                                              by `runTtsc.ts` and `runTtsx.ts`.
//   * `packages/ttsc/scripts/gen-flags.cjs`  — codegen that emits Go
//                                              allow-lists and the docs table.
//   * `packages/ttsc/cmd/ttsc/flags_gen.go`  — generated Go allow-list shared
//                                              by `cmd/ttsc/*.go` and
//                                              `utility/host.go`.
//   * `packages/lint/linthost/flags_gen.go`  — generated Go allow-list shared
//                                              by lint subcommand parsers.
//   * `website/src/content/docs/ttsc/flags.mdx` — generated reference table.
//
// The generator runs from `pnpm format`; its committed output is the spec the
// Go side reads, just like the `gen_shims:hand-maintained` pattern from
// AGENTS.md §2.1. Editing the generated files by hand is rejected by the
// `format` check.

/**
 * Subcommands the ttsc CLI dispatches to. The bare `"ttsc"` entry covers the
 * default lane (no explicit subcommand, e.g. `ttsc -p tsconfig.json`).
 */
export type TtscSubcommand =
  | "ttsc"
  | "build"
  | "check"
  | "fix"
  | "format"
  | "prepare"
  | "clean";

/**
 * Subcommands the ttsx CLI dispatches to. ttsx exposes a single lane today but
 * the schema mirrors ttsc's shape so future subcommands plug in without a
 * second engine.
 */
export type TtsxSubcommand = "ttsx";

export type AnySubcommand = TtscSubcommand | TtsxSubcommand;

/**
 * Layers a flag can be consumed by. The order reflects the runtime pipeline:
 *
 * Launcher → runBuild → tsgo / native sidecars (host, lint).
 *
 * A flag must declare at least one consumer. `forwardTo` declares where the
 * flag travels when the consuming layer does not absorb it (e.g. ttsc-owned
 * flags that the JS launcher consumes and re-emits as different tsgo flags).
 */
export type FlagLayer =
  | "launcher" // JS layer (`runTtsc.ts` / `runTtsx.ts`)
  | "runBuild" // JS layer (`runBuild.ts`) — internally adds the flag to tsgo
  | "tsgo" // tsgo binary (TypeScript-Go option parser)
  | "host" // native shared host (`utility/host.go`, `cmd/ttsc/build.go`)
  | "lint"; // native lint subcommand (`packages/lint/linthost/*.go`)

/**
 * Argument shape of a flag.
 *
 * - `boolean` — `--flag` / `--flag=true` / `--flag=false`. No value token is
 *   consumed.
 * - `value` — `--flag value` or `--flag=value`. Required value.
 * - `valueOptional` — `--flag` standalone is allowed; if followed by a non-flag
 *   token that token is consumed as the value. (Currently unused — declared for
 *   future flags like `--watch [path]`.)
 */
export type FlagKind = "boolean" | "value" | "valueOptional";

/**
 * Validation predicate for `value`-kind flags. `none` is the default (accept
 * any string).
 */
export type ValueValidator = "none" | "positiveInt";

/**
 * One CLI flag's complete contract. Every layer's behaviour is structural —
 * which subcommands accept the flag, where it is consumed, where it is
 * forwarded, whether it is terminal (prints and exits) — so the next layer
 * never silently drops the flag.
 */
export interface FlagSpec {
  /**
   * Canonical flag name including leading dashes (`"--singleThreaded"`). The
   * generator uses this as the map key in the Go allow-list and as the first
   * column of the docs table.
   */
  readonly name: string;

  /**
   * Alternative spellings (`"-p"`, `"--project"` for `--tsconfig`). The parsing
   * engine treats every alias as an equivalent of `name`.
   */
  readonly aliases?: readonly string[];

  /** Argument shape: boolean / required value / optional value. */
  readonly kind: FlagKind;

  /**
   * For `value` flags: optional validator. `positiveInt` mirrors the
   * `--checkers minValue:1` constraint tsgo enforces.
   */
  readonly validator?: ValueValidator;

  /** Subcommands that accept this flag. */
  readonly subcommands: readonly AnySubcommand[];

  /**
   * Layers that read the flag into a typed option. Order matters only for
   * documentation; the parsing engine merges across layers.
   */
  readonly consumedBy: readonly FlagLayer[];

  /**
   * Where the flag travels when the consuming layer does not absorb it. Default
   * for any flag a layer does not consume is `"tsgo"` — i.e. the launcher
   * forwards an unknown flag to tsgo via passthrough. Setting this to
   * `undefined` while `consumedBy: ["launcher"]` is set means the flag is
   * intentionally consumed-not-forwarded (e.g. ttsc-internal `--binary`).
   */
  readonly forwardTo?: FlagLayer;

  /**
   * Terminal flags ask the underlying tool to print something and exit
   * (`--help`, `--version`, `--showConfig`, `--listFilesOnly`, `--all`,
   * `--init`). ttsc must not wrap them in a pre-emit pass — that is how the
   * `--showConfig prints twice` bug appeared (RC-2).
   */
  readonly terminal?: boolean;

  /**
   * `true` when a `terminal` flag's meaning does not presuppose a resolved
   * project, so ttsc must answer it before project resolution runs (`--init`
   * writes the starter tsconfig, `--all` and `-?` print tsgo's help). Without
   * this split `ttsc --init` failed with "could not find tsconfig.json …" in
   * the only directory where it is useful.
   *
   * `--showConfig` and `--listFilesOnly` are terminal but deliberately NOT
   * project-free: both describe a project, so failing without one is correct.
   */
  readonly projectFree?: boolean;

  /**
   * `true` when every occurrence of a repeated `value` flag counts rather than
   * the last one winning (`ttsx -r a -r b` preloads both). The engine keeps the
   * last value in `ParseResult.values` for callers that want a single answer
   * and records the complete ordered list in `ParseResult.repeated`.
   */
  readonly repeatable?: boolean;

  /**
   * `true` when ttsc may add this flag to tsgo internally and post-process the
   * output. If the user also forwards the same flag, ttsc keeps the
   * user-visible behaviour (no double-print, no swallowed output). The shadow
   * check is structural rather than `passthrough.includes("…")`.
   *
   * Currently true for `--listEmittedFiles`, `--noEmit`, `--pretty`.
   */
  readonly internalShadow?: boolean;

  /**
   * Native sidecar capability that must be declared before ttsc sends this flag
   * as a bare CLI argument. Everything else routes through `--tsgo-args` or
   * stays in the JS launcher.
   */
  readonly nativeCapability?: "diagnosticsTiming" | "threadingArgs";

  /** Human description for `--help` and the docs table. */
  readonly description: string;
}

/**
 * Single source of truth for every flag the ttsc / ttsx CLI accepts. New flags
 * are added here and only here; the generator rebuilds the parsers and the Go
 * allow-lists from this table.
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
      "check",
      "fix",
      "format",
      "prepare",
      "clean",
    ],
    consumedBy: ["launcher"],
    description: "Override the runner and source-plugin cache root.",
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
  // `--tsgo-args` — JSON-encoded passthrough envelope the launcher emits on
  // the way down to native sidecars. The sidecars decode it back into the
  // tsgo argv. Listed here so the schema describes every flag the Go layers
  // accept, not just the user-facing ones.
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
      "JSON-encoded tsgo passthrough argv (internal: emitted by runBuild).",
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

/**
 * Normalize a CLI token to the identity the compiler ttsc wraps resolves it by:
 * one or two leading dashes removed, the remainder lower-cased.
 *
 * TypeScript's option parser — legacy `tsc` and native tsgo alike — strips a
 * `--` or `-` prefix and matches the rest case-insensitively, so `--noEmit`,
 * `--noemit`, `--NOEMIT`, and `-noEmit` all name the same option to the tool
 * ttsc forwards to. The launcher used to key its index on the exact spelling,
 * so a case variant of a ttsc-owned flag fell through the unknown-flag escape
 * hatch: tsgo honoured it and every ttsc-side consumer of the same flag never
 * fired, with no diagnostic.
 *
 * This is the single normalization. Everything that resolves a token against
 * `FLAG_SCHEMA` — the parsing engine, the terminal / shadow / project-free
 * classifications, and the generated Go allow-lists — keys off this function,
 * so no two layers can disagree about which flag a spelling names.
 */
export function normalizeFlagToken(token: string): string {
  return token.replace(/^--?/, "").toLowerCase();
}

/**
 * Resolve a raw argv token to the flag it names, or `undefined` when the schema
 * claims no such flag.
 *
 * Accepts every spelling the compiler accepts — any casing, one or two leading
 * dashes — plus the inline `--flag=value` form, whose value is not part of the
 * identity. A token without a leading dash is never a flag: bare tokens are
 * input files and flag values, and resolving them here would let a value like
 * the `all` of `--target all` masquerade as `--all`.
 */
export function resolveFlagSpec(token: string): FlagSpec | undefined {
  if (!token.startsWith("-")) return undefined;
  const equalsIndex = token.indexOf("=");
  const name = equalsIndex === -1 ? token : token.slice(0, equalsIndex);
  return FLAG_BY_TOKEN.get(normalizeFlagToken(name));
}

/**
 * Lookup of every declared spelling → its canonical FlagSpec, keyed by
 * {@link normalizeFlagToken}. Built once at module load so the parsing engine
 * has O(1) flag resolution. Prefer {@link resolveFlagSpec}, which applies the
 * normalization for the caller.
 */
export const FLAG_BY_TOKEN: ReadonlyMap<string, FlagSpec> = buildFlagIndex();

function buildFlagIndex(): ReadonlyMap<string, FlagSpec> {
  const index = new Map<string, FlagSpec>();
  for (const flag of FLAG_SCHEMA) {
    register(index, flag.name, flag);
    for (const alias of flag.aliases ?? []) {
      register(index, alias, flag);
    }
  }
  return index;
}

function register(
  index: Map<string, FlagSpec>,
  spelling: string,
  flag: FlagSpec,
): void {
  // Two spellings that normalize to one identity would make the schema
  // ambiguous, so the collision fails loudly at module load rather than
  // resolving to whichever row was declared last.
  const key = normalizeFlagToken(spelling);
  const existing = index.get(key);
  if (existing && existing !== flag) {
    throw new Error(
      `ttsc flag schema: duplicate token ${JSON.stringify(spelling)} claimed by ${existing.name} and ${flag.name}`,
    );
  }
  index.set(key, flag);
}

/** Tokens (canonical name + aliases) accepted in `subcommand`. */
export function flagsForSubcommand(subcommand: AnySubcommand): FlagSpec[] {
  return FLAG_SCHEMA.filter((flag) => flag.subcommands.includes(subcommand));
}

/**
 * Allow-list map for the Go layer named `layer` (`"host"` or `"lint"`):
 * flag-name (no leading dashes) → whether the flag takes a value token. The
 * generator emits a literal Go map with the same shape, but this function is
 * the runtime equivalent — used in tests to verify the generated Go matches the
 * schema.
 */
export function buildGoAllowList(layer: "host" | "lint"): Map<string, boolean> {
  const out = new Map<string, boolean>();
  for (const flag of FLAG_SCHEMA) {
    if (!flag.consumedBy.includes(layer)) continue;
    const takesValue = flag.kind === "value" || flag.kind === "valueOptional";
    for (const name of [flag.name, ...(flag.aliases ?? [])]) {
      // Keyed by the one normalization the runtime token lookup uses, so the
      // generated allow-lists and `resolveFlagSpec` cannot recognise different
      // spellings. The Go consumers apply the same normalization before the
      // lookup (`strings.ToLower` on the dash-stripped name).
      const key = normalizeFlagToken(name);
      // If two flags collide on the normalized key (e.g. `-p` vs `--project`),
      // use the value-taking shape.
      const existing = out.get(key);
      if (existing !== undefined && existing !== takesValue) {
        throw new Error(
          `ttsc flag schema: conflicting Go allow-list entry for ${JSON.stringify(key)} on layer ${layer}`,
        );
      }
      out.set(key, takesValue);
    }
  }
  return out;
}

import type { AnySubcommand } from "./AnySubcommand";
import type { FlagKind } from "./FlagKind";
import type { FlagLayer } from "./FlagLayer";
import type { ValueValidator } from "./ValueValidator";

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
   * `true` when pinned tsgo only permits the option in tsconfig, except for
   * command-line `false` or `null`. The launcher forwards the original argv so
   * tsgo remains the diagnostic authority.
   */
  readonly tsconfigOnly?: boolean;

  /**
   * Native sidecar capability that must be declared before ttsc sends this flag
   * as a bare CLI argument. Everything else routes through `--tsgo-args` or
   * stays in the JS launcher.
   */
  readonly nativeCapability?: "diagnosticsTiming" | "threadingArgs";

  /** Human description for `--help` and the docs table. */
  readonly description: string;
}

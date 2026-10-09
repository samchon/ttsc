/**
 * Optional host behaviors declared by a native ttsc plugin descriptor.
 *
 * Ttsc owns a small set of cross-cutting command-line flags
 * (`--singleThreaded`, `--checkers`, …) that the lint sidecar accepts but a
 * typical third-party transform host (built with bare `flag.FlagSet`) would
 * reject with exit 2. Capabilities also cover opt-in host protocols such as LSP
 * sidecar probing. They let the plugin author tell ttsc up front which behavior
 * the sidecar understands, instead of ttsc hard-checking the plugin name and
 * silently dropping or probing behavior for anything else.
 *
 * Every field is optional and defaults to `false`. Plugin authors opt in by
 * setting only the capabilities their sidecar actually implements; ttsc keeps
 * the conservative default for everything else.
 *
 * @evidence contracts/common.md#principled-implementation Optional booleans represent independent descriptor opt-ins; an omitted capability means the host must not send a protocol the sidecar has not declared.
 * @evidence contracts/common.md#clear-and-simple-design Each supported protocol has its own named field so callers can negotiate one behavior without inferring unrelated support.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Capability declarations replace plugin-name special cases; false defaults are the conservative protocol contract rather than test accommodations.
 * @evidence contracts/common.md#meaningful-documentation Native JSDoc explains each protocol, its false default and relevant independence from other capabilities; documented members and descriptive prose are separated according to the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type declaration acquires and holds no runtime resource.
 * @evidenceExclude contracts/performance.md#efficient-algorithms A type declaration chooses no processing strategy.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work A type declaration computes nothing, so there is no work to share.
 * @evidence contracts/portability.md#os-neutral-implementation These opt-ins describe a native sidecar's accepted argv and process protocols, including private absolute artifact paths and separate lexical/physical project identities; omission leaves the optional protocol unsupported on every platform rather than inferring it from an OS or plugin name.
 */
export interface ITtscPluginCapabilities {
  /**
   * Whether a check-stage host accepts `--check-observations-json=<absolute
   * private path>` and writes the host input observations from that same check
   * Program to the private channel. This opt-in applies to the actual check
   * verb, not effectful fix/format verbs exposed by a check-stage descriptor.
   *
   * The channel preserves input paths, content and physical-identity witnesses,
   * and explicit observation incompleteness independently of text diagnostics
   * and process status. Hosts report it for unsuccessful checks as well. A
   * missing capability keeps the option out of strict hosts' argv; it does not
   * imply that their input population was completely observed.
   *
   * @default false
   */
  checkObservations?: true;

  /**
   * Whether the host consumes `TTSC_TSGO_ARGS_CWD` with its forwarded compiler
   * payload. Upstream response and CLI option parsing use that directory;
   * Program, plugin and rule-input roots retain the selected `--cwd`.
   *
   * Only invocations requiring a distinct compiler argument base need this
   * protocol. An omitted capability retains same-directory legacy behavior.
   *
   * @default false
   */
  compilerArgsCwd?: true;

  /**
   * Whether the sidecar accepts `--diagnostics` and `--extendedDiagnostics` on
   * its command line and may print plugin-owned timing detail to stdout.
   *
   * When `false` (the default), ttsc keeps diagnostics flags out of native
   * sidecar argv so older strict hosts do not reject them. The ttsc launcher
   * still records the coarse sidecar wall-clock timing itself.
   *
   * @default false
   */
  diagnosticsTiming?: boolean;

  /**
   * Whether the sidecar implements ttsc's LSP plugin protocol.
   *
   * LSP-capable sidecars may contribute diagnostics, code actions, and
   * workspace/executeCommand handlers to `ttscserver`. The protocol is opt-in
   * so older sidecars are never probed with unknown `lsp-*` subcommands.
   *
   * @default false
   */
  lsp?: boolean;

  /**
   * Whether the sidecar supports the compiler-owned emit provenance protocol.
   *
   * An opted-in host accepts `--emit-provenance-json=<absolute private path>`
   * and reports the physical source identities of outputs it actually wrote.
   * Runtime consumers use that ledger instead of inferring source ownership
   * from an output filename or configuration prediction.
   *
   * When omitted, ttsc does not pass the option to a strict third-party host. A
   * runtime operation requiring verified emit provenance must then report that
   * the selected host does not support it.
   *
   * @default false
   */
  emitProvenance?: true;

  /**
   * Whether the sidecar accepts ttsc's `--project-context-json` identity
   * protocol. The payload keeps lexical selection paths, physical Program
   * paths, and explicit overrides as separate fields.
   *
   * @default false
   */
  projectContextArgs?: boolean;

  /**
   * Whether the LSP sidecar implements the standalone `lsp-project-diagnostics`
   * command.
   *
   * The command evaluates project rules without an open document. It is
   * independent of `projectInputs`, which publishes only filesystem topology.
   *
   * @default false
   */
  projectDiagnostics?: boolean;

  /**
   * Whether the sidecar implements the `project-inputs` command. The command
   * publishes normalized exact paths and glob populations declared by enabled
   * project rules without loading a TypeScript Program.
   *
   * @default false
   */
  projectInputs?: boolean;

  /**
   * Whether the check-stage sidecar implements the newline-delimited
   * `check-serve` protocol used by `ttsc check --watch`.
   *
   * A resident check host keeps one no-emit TypeScript Program across
   * compatible source and declared external-input changes while constructing a
   * fresh rule engine and reporter for every request. The launcher retains the
   * spawn-per-cycle path when this capability is absent and never uses it for
   * transform or emit work.
   *
   * @default false
   */
  residentCheck?: boolean;

  /**
   * Whether the sidecar accepts `--singleThreaded` and `--checkers` on its
   * command line. The lint sidecar parses both flags in its shared subcommand
   * flag parser and threads them into program loading (parse phase) and
   * `engine.SetSerial` (rule walk); other check-stage hosts may not.
   *
   * When `false` (the default), ttsc strips both flags from the sidecar's arg
   * list, because a host that does not declare the capability has an unknown
   * flag set and would reject an undeclared flag.
   *
   * @default false
   */
  threadingArgs?: boolean;
}

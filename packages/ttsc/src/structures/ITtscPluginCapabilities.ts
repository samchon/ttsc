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
 */
export interface ITtscPluginCapabilities {
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
   * command line. The lint sidecar parses both flags via `parseSubcommandFlags`
   * and threads them into `loadProgram` (parse phase) and `engine.SetSerial`
   * (rule walk); other check-stage hosts may not.
   *
   * When `false` (the default), ttsc strips both flags from the sidecar's arg
   * list — the conservative behavior that ad3443a restored after `#113`
   * over-forwarded them to typia/nestia hosts.
   *
   * @default false
   */
  threadingArgs?: boolean;
}

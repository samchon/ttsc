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

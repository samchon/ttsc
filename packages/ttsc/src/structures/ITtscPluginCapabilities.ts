/**
 * Optional capability flags declared by a native ttsc plugin descriptor.
 *
 * ttsc owns a small set of cross-cutting flags (`--singleThreaded`,
 * `--checkers`, …) that the lint sidecar accepts but a typical third-party
 * transform host (built with bare `flag.FlagSet`) would reject with exit 2.
 * Capabilities let the plugin author tell ttsc up front which of those flags
 * the sidecar understands, instead of ttsc hard-checking the plugin name and
 * silently dropping the flag for anything else.
 *
 * Every field is optional and defaults to `false`. Plugin authors opt in by
 * setting only the capabilities their sidecar actually implements; ttsc
 * keeps the conservative default for everything else.
 */
export interface ITtscPluginCapabilities {
  /**
   * Whether the sidecar accepts `--singleThreaded` and `--checkers` on its
   * command line. The lint sidecar parses both flags via
   * `parseSubcommandFlags` and threads them into `loadProgram` (parse phase)
   * and `engine.SetSerial` (rule walk); other check-stage hosts may not.
   *
   * When `false` (the default), ttsc strips both flags from the sidecar's
   * arg list — the conservative behavior that ad3443a restored after
   * `#113` over-forwarded them to typia/nestia hosts.
   *
   * @default false
   */
  threadingArgs?: boolean;
}

/**
 * `--stdio` is the only transport the native host accepts today. The launcher
 * injects it for any nonempty invocation other than a top-level meta-command;
 * meta-commands (`-v`, `--help`, `version`, etc.) pass through untouched so the
 * Go binary owns the canonical banner. This mirrors
 * `cmd/ttscserver/main.go::run`, which dispatches on `args[0]` only.
 *
 * @evidence contracts/common.md#principled-implementation Explicit stdio already satisfies the native transport, while an empty invocation and first-token help/version requests retain native dispatch; every other nonempty invocation requests the only supported transport.
 * @evidence contracts/common.md#clear-and-simple-design A single predicate owns transport injection and examines top-level meta dispatch without duplicating native option parsing.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Help/version tokens are native command discriminants, not fixture exceptions; caller argv remains untouched and no foreign dispatch behavior is patched.
 * @evidence contracts/common.md#meaningful-documentation Native prose states the supported transport and first-token distinction with a blank line before tags according to the documentation skill.
 */
export function needsStdio(argv: readonly string[]): boolean {
  if (argv.length === 0) return false;
  if (argv.includes("--stdio")) return false;
  const head = argv[0];
  if (
    head === "-v" ||
    head === "--version" ||
    head === "version" ||
    head === "-h" ||
    head === "--help" ||
    head === "help"
  ) {
    return false;
  }
  return true;
}

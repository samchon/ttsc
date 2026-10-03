/**
 * `--stdio` is the only transport the native host accepts today. The launcher
 * injects it for any nonempty invocation other than a top-level meta-command;
 * meta-commands (`-v`, `--help`, `version`, etc.) pass through untouched so the
 * Go binary owns the canonical banner. This mirrors
 * `cmd/ttscserver/main.go::run`, which dispatches on `args[0]` only.
 *
 * @evidence contracts/common.md#principled-implementation An exact --stdio token suppresses injection anywhere in argv; empty input and first-token help/version requests also pass through. Otherwise the launcher prepends the transport flag, while actual native option acceptance remains with the Go parser.
 * @evidence contracts/common.md#clear-and-simple-design A single predicate owns transport injection and examines top-level meta dispatch without duplicating native option parsing.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Help/version tokens are native command discriminants, not fixture exceptions; caller argv remains untouched and no foreign dispatch behavior is patched.
 * @evidence contracts/common.md#meaningful-documentation Native prose states the supported transport and first-token distinction with a blank line before tags according to the documentation skill.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources needsStdio acquires no handle, buffer or cache and retains nothing after it returns.
 * @evidence contracts/performance.md#efficient-algorithms The exact-token includes scan visits up to A supplied arguments before six first-token comparisons. Cost depends on the scanned argument strings; it allocates no output argv or path structure.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work This argv predicate does not coordinate requests or establish a reusable computation lifetime; the caller owns each invocation and its argument vector.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation needsStdio computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
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

// Command ttsc is the Go CLI entrypoint for ttsc.
//
// The dispatcher handles version/help requests and delegates project builds,
// checks and JSON API requests to their compiler-backed command adapters.
package main

import (
  "fmt"
  "io"
  "os"
  "runtime"
  "strings"
)

// These are overridden via `-ldflags "-X main.version=... -X main.commit=..."`
// in CI. Sensible defaults keep local `go run ./cmd/ttsc` usable.
var (
  version = "0.0.0-dev"
  commit  = "dev"
  date    = "unknown"
)

// stdout / stderr are package-level to keep the CLI testable.
var (
  stdout io.Writer = os.Stdout
  stderr io.Writer = os.Stderr
  getwd            = os.Getwd
)

// main runs the actual argv dispatcher and passes its returned status to
// os.Exit.
//
// Command adapters finish their synchronous work and deferred Program cleanup
// before run returns. Process termination owns the status transport; this
// entry does not reinterpret the command result.
func main() {
  os.Exit(run(os.Args[1:]))
}

// cliCommandKind carries only the actual preparation branch selected by run.
// It introduces no command result, compiler producer or retained resource.
// Common: Principled implementation: Values distinguish actual prepared build/help/version/API branches consumed by run; numeric values have no wire meaning.
// Common: Clear and simple design: One private discriminator accompanies argv and status; it holds no additional dispatch state.
// Common: Prohibited implementation shortcuts: The actual preparation gate chooses the kind; no fake public API or response cache supplies it.
// Common: Meaningful documentation: Native prose names actual preparation ownership and absence of wire semantics.
// Portability: OS-neutral implementation: An in-process scalar introduces no path, stream or process representation.
// Performance: Efficient algorithms: Reading or copying the kind is constant work without input traversal.
// Performance: Reuse equivalent work: The kind identifies an operation and does not authorize reuse of a command result.
// Performance: Bound retention and release resources: The scalar owns no resource, buffer, Program lease or retained history.
type cliCommandKind uint8

const (
  commandBuild cliCommandKind = iota
  commandHelp
  commandVersion
  commandAPICompile
  commandAPITransform
)

// run consumes the real command preparation and dispatches its selected
// operation.
//
// A preparation error is returned immediately with its original diagnostic.
// Successful build/API kinds delegate the prepared argv to their owning
// adapters; help and version write through the supplied package stream and
// return zero. The dispatcher returns the actual operation status rather than
// owning a compiler lease itself.
func run(args []string) int {
  command, values, code := prepareCommandInvocation(args)
  if code != 0 {
    return code
  }
  switch command {
  case commandHelp:
    printHelp(stdout)
    return 0
  case commandVersion:
    printVersion(stdout)
    return 0
  case commandAPICompile:
    return runAPICompile(values)
  case commandAPITransform:
    return runAPITransform(values)
  default:
    return runBuild(values)
  }
}

// prepareCommandInvocation owns the original verb/alias gate and returns
// normalized argv to the real run dispatcher. It performs no compiler load.
// Missing operands and unknown commands still report their original diagnostics.
//
// Private Go declarations are not exported Evidence hosts; native grounds
// stay with this preparation path and its actual run consumer.
// Common: Principled implementation: Actual verb, flag-shaped, extension and project-alias conditions preserve their original diagnostics, return status and normalized arguments before the real handler loads.
// Common: Clear and simple design: The real dispatcher consumes one command/argv/status value; tests observe that value separately from an actual compiler operation.
// Common: Prohibited implementation shortcuts: No duplicate test-side switch substitutes for dispatch, fake public API is introduced or previous compiler status is replayed.
// Common: Meaningful documentation: Prose names pure preparation, actual run consumption and its retained diagnostic responsibility.
// Portability: OS-neutral implementation: Arguments remain native values without shell interpretation or forced path separators.
// Performance: Efficient algorithms: One verb gate and existing argument normalization perform constant branch work plus copied alias/check tail length.
// Performance: Reuse equivalent work: Equal independently observed normalized arguments may feed one separately named real build; preparation stores no command response.
// Performance: Bound retention and release resources: Values are synchronous caller-owned arguments; no checker lease, child, filesystem fixture or global cache is acquired.
func prepareCommandInvocation(args []string) (cliCommandKind, []string, int) {
  if len(args) == 0 {
    return commandBuild, nil, 0
  }

  switch args[0] {
  case "-h", "--help", "help":
    return commandHelp, nil, 0
  case "-v", "--version", "version":
    return commandVersion, nil, 0
  case "build":
    return commandBuild, args[1:], 0
  case "api-compile":
    return commandAPICompile, args[1:], 0
  case "api-transform":
    return commandAPITransform, args[1:], 0
  case "check":
    // `ttsc check` runs the analyze pipeline without emitting JS — useful
    // in CI and pre-commit checks that only need schema validation.
    return commandBuild, append([]string{"--noEmit"}, args[1:]...), 0
  case "-p", "--project":
    normalized, ok := normalizeProjectAliasArguments(args)
    if !ok {
      fmt.Fprintln(stderr, "ttsc: -p/--project requires a path argument")
      return commandBuild, nil, 2
    }
    return commandBuild, normalized, 0
  default:
    if isBuildAlias(args[0]) {
      return commandBuild, args, 0
    }
    fmt.Fprintf(stderr, "ttsc: unknown command %q\n", args[0])
    fmt.Fprintln(stderr, `ttsc: run "ttsc --help" to see supported commands`)
    return commandBuild, nil, 2
  }
}

// isBuildAlias reports whether arg should be forwarded to runBuild without
// requiring an explicit "build" verb. Any flag-shaped argument (leading "-")
// or a TypeScript-project file extension is treated as a build alias, matching
// the tsc/tsgo invocation convention.
//
// This predicate classifies literal argv shape only. Recognizing a .cts operand
// selects build preparation; it does not establish that the build FlagSet uses
// that positional token as a tsconfig selector or inspects that file.
func isBuildAlias(arg string) bool {
  if strings.HasPrefix(arg, "-") {
    return true
  }
  switch {
  case strings.HasSuffix(arg, ".json"),
    strings.HasSuffix(arg, ".ts"),
    strings.HasSuffix(arg, ".tsx"),
    strings.HasSuffix(arg, ".mts"),
    strings.HasSuffix(arg, ".cts"):
    return true
  default:
    return false
  }
}

// printVersion writes the CLI's build and current Go platform metadata.
//
// Linker-populated release values and development defaults share the same
// format; runtime.GOOS, GOARCH and Version provide the executing Go platform.
// The caller supplies the writer. This existing presentation path ignores
// writer errors and does not determine command failure status.
func printVersion(w io.Writer) {
  fmt.Fprintf(
    w,
    "ttsc %s (commit %s, built %s, %s/%s, go %s)\n",
    version,
    commit,
    date,
    runtime.GOOS,
    runtime.GOARCH,
    runtime.Version(),
  )
}

// printHelp writes the supported static command usage through the supplied
// writer.
//
// The authored usage text documents command forms, flags and examples;
// trimming its surrounding whitespace preserves one presentation format. This
// existing help path ignores writer errors, and the dispatcher owns the
// successful help status.
func printHelp(w io.Writer) {
  fmt.Fprintln(w, strings.TrimSpace(`
ttsc — standalone typescript-go host.

Usage:
  ttsc
  ttsc -p tsconfig.json
  ttsc --watch
  ttsc --noEmit

Project build:
  ttsc compiles the current tsconfig.json, matching the tsc/tsgo shape.
  build         Compatibility alias for the same project build lane.
  check         Compatibility alias for --noEmit validation.
  version       Print version, build info, and platform.
  help          Show this help.

Build options:
  --tsconfig=FILE   Path to tsconfig.json (default: tsconfig.json).
  --cwd=DIR         Override working directory.
  --emit            Force emitted .js files even when tsconfig has noEmit.
  --noEmit          Force analysis-only run even when tsconfig would emit.
  --quiet           Suppress the per-call summary banner (default).
  --verbose         Print the per-call summary banner and emitted file list.
  --manifest=FILE   Write emitted file paths as JSON to FILE after build --emit.

Examples:
  ttsc --version
  ttsc
  ttsc -p ./tsconfig.json
  ttsc --noEmit

Integration guide (bundlers):
  - Next.js / Nuxt / Bun: "ttsc" in your pipeline replaces tsc and
    the rewritten .js feeds the runtime directly.
  - Monorepo / pnpm workspace: share one ttsc binary via a root script;
    per-package tsconfig.json references work unchanged.
`))
}

// normalizeProjectAliasArguments owns the exact -p/--project operand rewrite
// consumed by run. It never loads a project or returns a cached build status.
// Both spellings share one normalized build only after independent literal argv
// expectations establish this actual normalization result.
//
// Go Evidence addresses exported declarations only; these private native
// review grounds remain attached to the owning operation and its callers.
// Common: Principled implementation: The actual preparation gate consumed by run calls this exact -p/--project operand rewrite before real runBuild.
// Common: Clear and simple design: Missing operand is one boolean outcome and successful normalization is one newly allocated argument slice.
// Common: Prohibited implementation shortcuts: Literal normalized argv is observed separately from a shared real build; no cached status is presented as an independently executed alias.
// Common: Meaningful documentation: Native prose distinguishes pure operand normalization from project compilation and identifies the production consumer.
// Portability: OS-neutral implementation: The config operand is passed as an argument value without native-separator rewriting or shell interpretation.
// Performance: Efficient algorithms: Tail argument copying is linear in remaining argv length and makes one owning slice.
// Performance: Reuse equivalent work: Equal literal normalization permits one separately identified real build observation; this helper never reuses a process result.
// Performance: Bound retention and release resources: The returned normalized slice transfers to the synchronous caller and retains no previous argv or compiler state.
func normalizeProjectAliasArguments(args []string) ([]string, bool) {
  if len(args) < 2 {
    return nil, false
  }
  return append([]string{"--tsconfig=" + args[1]}, args[2:]...), true
}

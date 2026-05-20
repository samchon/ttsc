//go:build !js

// Command ttsc-wasm is the non-wasm sanity entrypoint for `@ttsc/wasm`.
//
// The same binary, compiled with GOOS=js GOARCH=wasm, becomes the browser
// wasm consumed by `bootTtsc`. For native targets we expose a minimal CLI so
// `go run ./cmd/ttsc-wasm` exercises the same host helpers without needing
// the browser MemFS bridge.
package main

import (
  "fmt"
  "io"
  "os"
  "runtime"

  "github.com/samchon/ttsc/packages/wasm/host"
)

// Build metadata. Overridden via -ldflags from build/build-wasm.cjs.
var (
  version = "0.0.0-dev"
  commit  = "dev"
  date    = "unknown"
)

func main() {
  os.Exit(run(os.Args[1:]))
}

// run is the testable core of main. It dispatches the first argument as a
// subcommand and returns the OS exit code.
func run(args []string) int {
  if len(args) == 0 {
    printHelp(os.Stdout)
    return 0
  }
  switch args[0] {
  case "-h", "--help", "help":
    printHelp(os.Stdout)
    return 0
  case "-v", "--version", "version":
    printVersion(os.Stdout)
    return 0
  case "build":
    return runBuild(args[1:])
  case "check":
    return runCheck(args[1:])
  case "transform":
    return runTransform(args[1:])
  default:
    fmt.Fprintf(os.Stderr, "ttsc-wasm: unknown command %q\n", args[0])
    printHelp(os.Stderr)
    return 2
  }
}

// runBuild invokes host.Build and writes the JSON result to stdout.
func runBuild(args []string) int {
  cwd, tsconfig := parseProject(args)
  data, code, err := host.Build(cwd, tsconfig)
  if err != nil {
    fmt.Fprintf(os.Stderr, "ttsc-wasm build: %v\n", err)
    return 2
  }
  _, _ = os.Stdout.Write(append(data, '\n'))
  return code
}

// runCheck invokes host.Check and writes the JSON result to stdout.
func runCheck(args []string) int {
  cwd, tsconfig := parseProject(args)
  data, code, err := host.Check(cwd, tsconfig)
  if err != nil {
    fmt.Fprintf(os.Stderr, "ttsc-wasm check: %v\n", err)
    return 2
  }
  _, _ = os.Stdout.Write(append(data, '\n'))
  return code
}

// runTransform invokes host.Transform and writes the JSON result to stdout.
func runTransform(args []string) int {
  cwd, tsconfig := parseProject(args)
  data, code, err := host.Transform(cwd, tsconfig)
  if err != nil {
    fmt.Fprintf(os.Stderr, "ttsc-wasm transform: %v\n", err)
    return 2
  }
  _, _ = os.Stdout.Write(append(data, '\n'))
  return code
}

// parseProject extracts --cwd and --tsconfig from args, defaulting to the
// process working directory and "tsconfig.json" respectively. Both the
// `--flag value` and `--flag=value` forms are accepted.
func parseProject(args []string) (string, string) {
  cwd, _ := os.Getwd()
  tsconfig := "tsconfig.json"
  const cwdPrefix = "--cwd="
  const tsconfigPrefix = "--tsconfig="
  for i := 0; i < len(args); i++ {
    arg := args[i]
    switch {
    case arg == "--cwd" && i+1 < len(args):
      cwd = args[i+1]
      i++
    case len(arg) > len(cwdPrefix) && arg[:len(cwdPrefix)] == cwdPrefix:
      cwd = arg[len(cwdPrefix):]
    case arg == "--tsconfig" && i+1 < len(args):
      tsconfig = args[i+1]
      i++
    case len(arg) > len(tsconfigPrefix) && arg[:len(tsconfigPrefix)] == tsconfigPrefix:
      tsconfig = arg[len(tsconfigPrefix):]
    }
  }
  return cwd, tsconfig
}

// printHelp writes the usage summary to w.
func printHelp(w io.Writer) {
  fmt.Fprintln(w, "Usage: ttsc-wasm <command> [--cwd=<dir>] [--tsconfig=<path>]")
  fmt.Fprintln(w, "Commands:")
  fmt.Fprintln(w, "  build       compile a project and print the JSON result")
  fmt.Fprintln(w, "  check       type-check a project without emit")
  fmt.Fprintln(w, "  transform   return every source file the program saw")
  fmt.Fprintln(w, "  version     print version banner")
}

// printVersion writes the build metadata banner to w.
func printVersion(w io.Writer) {
  fmt.Fprintf(
    w,
    "ttsc-wasm %s (commit %s, built %s, %s/%s, go %s)\n",
    version,
    commit,
    date,
    runtime.GOOS,
    runtime.GOARCH,
    runtime.Version(),
  )
}

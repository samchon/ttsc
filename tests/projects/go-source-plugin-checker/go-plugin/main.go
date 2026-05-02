// go-source-plugin-checker is a reference fixture for native plugins that need
// access to the tsgo Program and Checker.
//
// The plugin recognizes call sites shaped like `__typeText<T>()` in the
// consumer's TypeScript source and rewrites the emitted JavaScript so the
// call is replaced with a string literal of T's source text.
//
// The interesting part of this fixture is the bootstrap (see runBuild):
// the plugin parses the user's tsconfig with shim/tsoptions, builds a real
// shim/compiler.Program, acquires a shim/checker.Checker, and looks up the
// target source file in the program's SourceFiles(). The resulting handles are
// the semantic surface used by validators, schema generators, and other
// checker-backed transforms.
//
// The actual rewrite is deliberately kept regex-based to keep the file
// readable. The fixture's contract is the bootstrap plus checker-backed source
// lookup; the replacement itself is deliberately small.
package main

import (
  "context"
  "flag"
  "fmt"
  "os"
  "path/filepath"
  "regexp"
  "strings"

  "github.com/microsoft/typescript-go/shim/bundled"
  shimchecker "github.com/microsoft/typescript-go/shim/checker"
  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  "github.com/microsoft/typescript-go/shim/core"
  "github.com/microsoft/typescript-go/shim/tsoptions"
  "github.com/microsoft/typescript-go/shim/vfs/cachedvfs"
  "github.com/microsoft/typescript-go/shim/vfs/osvfs"
)

var typeTextCall = regexp.MustCompile(
  `(?m)export\s+const\s+([A-Za-z_$][A-Za-z0-9_$]*)(?:\s*:\s*[^=]+)?=\s*__typeText<([^>]+)>\(\)\s*;`,
)

func main() {
  os.Exit(run(os.Args[1:]))
}

func run(args []string) int {
  if len(args) == 0 {
    fmt.Fprintln(os.Stderr, "go-source-plugin-checker: command required")
    return 2
  }
  switch args[0] {
  case "version", "-v", "--version":
    fmt.Fprintln(os.Stdout, "go-source-plugin-checker 0.0.0")
    return 0
  case "check":
    return 0
  case "build":
    return runBuild(args[1:])
  default:
    fmt.Fprintf(os.Stderr, "go-source-plugin-checker: unknown command %q\n", args[0])
    return 2
  }
}

// runBuild handles project-build invocations. The bootstrap is the same;
// only the target file selection changes (we look for src/main.ts under
// --cwd to match the fixture's layout).
func runBuild(args []string) int {
  fs := flag.NewFlagSet("build", flag.ContinueOnError)
  fs.SetOutput(os.Stderr)
  cwd := fs.String("cwd", "", "")
  tsconfig := fs.String("tsconfig", "", "")
  _ = fs.String("plugins-json", "", "")
  _ = fs.Bool("emit", false, "")
  _ = fs.Bool("noEmit", false, "")
  _ = fs.Bool("quiet", false, "")
  _ = fs.Bool("verbose", false, "")
  outDir := fs.String("outDir", "dist", "")
  if err := fs.Parse(args); err != nil {
    return 2
  }
  root := *cwd
  if root == "" {
    var err error
    root, err = os.Getwd()
    if err != nil {
      fmt.Fprintln(os.Stderr, err)
      return 2
    }
  }
  tsconfigPath := *tsconfig
  if tsconfigPath == "" {
    tsconfigPath = filepath.Join(root, "tsconfig.json")
  }

  program, releaseChecker, err := bootstrap(root, tsconfigPath)
  if err != nil {
    fmt.Fprintf(os.Stderr, "go-source-plugin-checker: bootstrap: %v\n", err)
    return 2
  }
  defer releaseChecker()

  target := filepath.ToSlash(filepath.Join(root, "src", "main.ts"))
  source := findSourceFile(program, target)
  if source == "" {
    fmt.Fprintf(os.Stderr, "go-source-plugin-checker: source file not in program: %s\n", target)
    return 2
  }
  code, err := transform(source)
  if err != nil {
    fmt.Fprintln(os.Stderr, err)
    return 2
  }
  out := filepath.Join(root, *outDir, "main.js")
  if filepath.IsAbs(*outDir) {
    // Absolute outDir values are already final host-provided output roots.
    out = filepath.Join(*outDir, "main.js")
  }
  if err := os.MkdirAll(filepath.Dir(out), 0o755); err != nil {
    fmt.Fprintln(os.Stderr, err)
    return 2
  }
  if err := os.WriteFile(out, []byte(code), 0o644); err != nil {
    fmt.Fprintln(os.Stderr, err)
    return 2
  }
  return 0
}

// bootstrap constructs the FS, CompilerHost, ParsedCommandLine, Program,
// and Checker the same way ttsc does internally. It returns the Program
// and a release function the caller must defer to free the checker pool
// lease.
//
// The bootstrap contract is using bundled.WrapFS for the FS and
// bundled.LibPath() for the compiler host so tsgo's lib.d.ts files resolve
// without a network fetch.
func bootstrap(cwd, tsconfigPath string) (*shimcompiler.Program, func(), error) {
  fs := bundled.WrapFS(cachedvfs.From(osvfs.FS()))
  host := shimcompiler.NewCompilerHost(cwd, fs, bundled.LibPath(), nil, nil)

  parsed, _ := tsoptions.GetParsedCommandLineOfConfigFile(
    tsconfigPath,
    &core.CompilerOptions{},
    nil,
    host,
    nil,
  )
  if parsed == nil {
    return nil, nil, fmt.Errorf("tsoptions: parsed command line was nil for %s", tsconfigPath)
  }
  if len(parsed.Errors) > 0 {
    return nil, nil, fmt.Errorf("tsoptions: %d diagnostics parsing %s", len(parsed.Errors), tsconfigPath)
  }

  program := shimcompiler.NewProgram(shimcompiler.ProgramOptions{
    Config:                      parsed,
    SingleThreaded:              core.TSTrue,
    Host:                        host,
    UseSourceOfProjectReference: true,
  })
  if program == nil {
    return nil, nil, fmt.Errorf("compiler: NewProgram returned nil")
  }

  checker, releaseChecker := program.GetTypeChecker(context.Background())
  // Demonstrate the checker is live without coupling the test to a specific
  // shim/checker method. The type assertion exercises the linked checker path
  // while keeping the fixture's observable output stable.
  _ = (*shimchecker.Checker)(checker)

  return program, releaseChecker, nil
}

// findSourceFile returns the source text of the program file matching
// `target`. tsgo normalizes paths to forward slashes; we do the same on
// our side.
func findSourceFile(program *shimcompiler.Program, target string) string {
  want := filepath.ToSlash(target)
  for _, file := range program.SourceFiles() {
    if filepath.ToSlash(file.FileName()) == want {
      return file.Text()
    }
  }
  return ""
}

// transform replaces every `__typeText<T>()` call with the string literal
// version of the type argument's source text. A real semantic plugin
// would query the Checker for T's resolved Type and walk its members
// (e.g. typia's schema generation); this fixture stays at the source-text
// level on purpose so the bootstrap pattern is the takeaway.
func transform(source string) (string, error) {
  matches := typeTextCall.FindAllStringSubmatch(source, -1)
  if len(matches) == 0 {
    return "", fmt.Errorf(`go-source-plugin-checker: no __typeText<T>() calls found`)
  }
  var b strings.Builder
  b.WriteString(`"use strict";` + "\n")
  b.WriteString(`Object.defineProperty(exports, "__esModule", { value: true });` + "\n")
  for _, match := range matches {
    name := match[1]
    typeText := strings.TrimSpace(match[2])
    b.WriteString(fmt.Sprintf("exports.%s = void 0;\n", name))
    b.WriteString(fmt.Sprintf("const %s = %q;\n", name, typeText))
    b.WriteString(fmt.Sprintf("exports.%s = %s;\n", name, name))
  }
  logCall := regexp.MustCompile(`(?m)^console\.log\(([^)]*)\);?$`)
  if logMatch := logCall.FindStringSubmatch(source); logMatch != nil {
    b.WriteString(fmt.Sprintf("console.log(%s);\n", strings.TrimSpace(logMatch[1])))
  }
  return b.String(), nil
}

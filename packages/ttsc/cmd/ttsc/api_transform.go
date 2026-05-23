// JSON API adapter for source-level transformation results.
//
// `api-transform` returns the TypeScript source files that TypeScript-Go
// parsed for the owning project. It is the no-emit companion to api-compile:
// diagnostics are still collected, but the result surface is TypeScript text
// rather than emitted JavaScript.
package main

import (
  "encoding/json"
  "flag"
  "fmt"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  cwdutil "github.com/samchon/ttsc/packages/ttsc/internal/cwd"
)

type apiTransformResult struct {
  // TypeScript contains every non-library source file visible through the
  // Program facade, keyed the same way api-compile keys emitted files.
  Diagnostics []apiCompileDiagnostic `json:"diagnostics,omitempty"`
  TypeScript  map[string]string      `json:"typescript"`
}

// runAPITransform implements the `api-transform` sub-command. It loads the
// TypeScript program in no-emit mode and returns the source text of every
// non-library file as a JSON object, keyed by the same relative-path
// convention as api-compile. Diagnostics are included; partial results are
// returned even when diagnostics are present.
func runAPITransform(args []string) int {
  fs := flag.NewFlagSet("api-transform", flag.ContinueOnError)
  fs.SetOutput(stderr)
  tsconfigPath := fs.String("tsconfig", "tsconfig.json", "path to tsconfig.json")
  cwdOverride := fs.String("cwd", "", "override the working directory")
  singleThreaded := fs.Bool("singleThreaded", false, "run TypeScript-Go single-threaded")
  checkers := fs.Int("checkers", 0, "type-checker pool size (0 = TypeScript-Go default)")
  tsgoArgsRaw := fs.String("tsgo-args", "", "JSON array of forwarded tsgo CLI flags")
  // See cmd/ttsc/build.go's filterHostArgs call for the rationale.
  if err := fs.Parse(filterHostArgs(args)); err != nil {
    return 2
  }

  cwd, err := cwdutil.Resolve(*cwdOverride, getwd)
  if err != nil {
    fmt.Fprintf(stderr, "ttsc: %v\n", err)
    return 2
  }

  tsgoArgs, err := decodeTsgoArgs(*tsgoArgsRaw)
  if err != nil {
    fmt.Fprintf(stderr, "ttsc: %v\n", err)
    return 2
  }

  prog, diags, err := driver.LoadProgram(cwd, *tsconfigPath, driver.LoadProgramOptions{
    ForceNoEmit:    true,
    SingleThreaded: *singleThreaded,
    Checkers:       *checkers,
    TsgoArgs:       tsgoArgs,
  })
  if err != nil {
    fmt.Fprintf(stderr, "ttsc api-transform: %v\n", err)
    return 2
  }
  typescript := map[string]string{}
  if prog != nil {
    defer prog.Close()
    for _, file := range prog.SourceFiles() {
      typescript[apiOutputKey(cwd, file.FileName())] = file.Text()
    }
    diags = append(diags, prog.Diagnostics()...)
  }

  result := apiTransformResult{
    Diagnostics: make([]apiCompileDiagnostic, 0, len(diags)),
    TypeScript:  typescript,
  }
  for _, diag := range diags {
    result.Diagnostics = append(result.Diagnostics, toAPICompileDiagnostic(diag))
  }

  data, _ := json.Marshal(result)
  fmt.Fprintln(stdout, string(data))
  if driver.CountErrors(diags) > 0 {
    return 2
  }
  return 0
}

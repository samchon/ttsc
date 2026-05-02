// JSON API adapter for in-process-style project compilation.
//
// `api-compile` is consumed by the TypeScript wrapper when it needs a stable,
// machine-readable result from the native compiler host. The command always
// emits into memory and serializes diagnostics plus output text; it never
// writes generated files into the caller's project tree.
package main

import (
  "encoding/json"
  "flag"
  "fmt"
  "os"
  "path/filepath"
  "strings"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

type apiCompileResult struct {
  // Diagnostics is omitted only when the compiler produced no diagnostics.
  // Output is still returned in diagnostic cases because TypeScript-Go may
  // produce partial emit text before a build-failing error is reported.
  Diagnostics []apiCompileDiagnostic `json:"diagnostics,omitempty"`
  Output      map[string]string      `json:"output"`
}

// apiCompileDiagnostic mirrors the public TypeScript-side diagnostic DTO.
// The JSON keys intentionally use TypeScript naming (`messageText`,
// `character`) instead of Go naming so callers can pass the data through
// without remapping.
type apiCompileDiagnostic struct {
  File        *string `json:"file"`
  Category    string  `json:"category"`
  Code        int32   `json:"code"`
  Start       *int    `json:"start,omitempty"`
  Length      *int    `json:"length,omitempty"`
  Line        int     `json:"line,omitempty"`
  Character   int     `json:"character,omitempty"`
  MessageText string  `json:"messageText"`
}

func runAPICompile(args []string) int {
  fs := flag.NewFlagSet("api-compile", flag.ContinueOnError)
  fs.SetOutput(stderr)
  tsconfigPath := fs.String("tsconfig", "tsconfig.json", "path to tsconfig.json")
  cwdOverride := fs.String("cwd", "", "override the working directory")
  if err := fs.Parse(args); err != nil {
    return 2
  }

  cwd, ok := resolveBuildCwd(*cwdOverride)
  if !ok {
    return 2
  }

  prog, diags, err := driver.LoadProgram(cwd, *tsconfigPath, driver.LoadProgramOptions{
    ForceEmit: true,
  })
  if err != nil {
    fmt.Fprintf(stderr, "ttsc api-compile: %v\n", err)
    return 2
  }
  if prog != nil {
    defer prog.Close()
    diags = append(diags, prog.Diagnostics()...)
  }

  output := map[string]string{}
  if prog != nil {
    rewrites := driver.NewRewriteSet()
    // Capture WriteFile output in a map keyed by project-relative paths. This
    // gives the JS API a deterministic object and avoids touching outDir.
    writeFile := shimcompiler.WriteFile(
      func(fileName, text string, _ *shimcompiler.WriteFileData) error {
        output[apiOutputKey(cwd, fileName)] = text
        return nil
      },
    )
    _, emitDiags, err := prog.EmitAll(rewrites, writeFile)
    if err != nil {
      fmt.Fprintf(stderr, "ttsc api-compile: emit failed: %v\n", err)
      return 3
    }
    diags = append(diags, emitDiags...)
  }

  result := apiCompileResult{
    Diagnostics: make([]apiCompileDiagnostic, 0, len(diags)),
    Output:      output,
  }
  for _, diag := range diags {
    result.Diagnostics = append(result.Diagnostics, toAPICompileDiagnostic(diag))
  }

  data, err := json.Marshal(result)
  if err != nil {
    fmt.Fprintf(stderr, "ttsc api-compile: result marshal failed: %v\n", err)
    return 3
  }
  fmt.Fprintln(stdout, string(data))
  if driver.CountErrors(diags) > 0 {
    return 2
  }
  return 0
}

func resolveBuildCwd(cwdOverride string) (string, bool) {
  if cwdOverride != "" {
    return cwdOverride, true
  }
  cwd, err := os.Getwd()
  if err != nil {
    fmt.Fprintf(stderr, "ttsc: could not get working directory: %v\n", err)
    return "", false
  }
  return cwd, true
}

func toAPICompileDiagnostic(diag driver.Diagnostic) apiCompileDiagnostic {
  var file *string
  if diag.File != "" {
    value := diag.File
    file = &value
  }
  category := "error"
  if diag.Severity == driver.SeverityWarning {
    category = "warning"
  }
  return apiCompileDiagnostic{
    File:        file,
    Category:    category,
    Code:        diag.Code,
    Start:       diag.Start,
    Length:      diag.Length,
    Line:        diag.Line,
    Character:   diag.Column,
    MessageText: diag.Message,
  }
}

func apiOutputKey(cwd, fileName string) string {
  // Relative keys are the API contract for files inside the project. Absolute
  // keys are preserved for uncommon compiler outputs outside cwd.
  if rel, err := filepath.Rel(cwd, fileName); err == nil && !strings.HasPrefix(rel, "..") {
    return filepath.ToSlash(rel)
  }
  return filepath.ToSlash(fileName)
}

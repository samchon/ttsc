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
  "path/filepath"
  "strings"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  cwdutil "github.com/samchon/ttsc/packages/ttsc/internal/cwd"
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
    ForceEmit:      true,
    SingleThreaded: *singleThreaded,
    Checkers:       *checkers,
    TsgoArgs:       tsgoArgs,
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

  data, _ := json.Marshal(result)
  fmt.Fprintln(stdout, string(data))
  if driver.CountErrors(diags) > 0 {
    return 2
  }
  return 0
}

// toAPICompileDiagnostic converts an internal driver.Diagnostic into the
// JSON-serialisable form returned by the api-compile command. Category is
// lowercased to match the TypeScript Language Service convention.
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

// apiOutputKey returns the map key used in the api-compile result for a
// generated file. Files inside cwd use a slash-separated relative path (the
// API contract). Files outside cwd — rare, e.g. a monorepo output rooted
// above the project — are returned as an absolute slash path instead.
func apiOutputKey(cwd, fileName string) string {
  if rel, err := filepath.Rel(cwd, fileName); err == nil && !isOutsideRelativePath(rel) {
    return filepath.ToSlash(rel)
  }
  return filepath.ToSlash(fileName)
}

// isOutsideRelativePath reports whether the result of filepath.Rel points
// above the base directory (starts with ".."), meaning the file lives outside
// the project root and cannot safely be expressed as a project-relative path.
func isOutsideRelativePath(rel string) bool {
  return rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator))
}

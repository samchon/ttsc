// Shared API helpers behind the wasm and non-wasm entrypoints.
//
// `host.Expose` (under //go:build js) and the cmd's native `main.go` both
// call into these helpers so build/check/transform behavior stays
// bit-identical across the two surfaces.
package host

import (
  "encoding/json"
  "fmt"
  "path/filepath"
  "strings"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// APIResult is the stdout/stderr capture returned by runWithCapturedIO. The
// js/wasm binding wraps it in the same JS result envelope that build/check/
// transform use, adding `result` when an endpoint has a JSON payload. `code`
// follows the native CLI exit-code contract (0 success, 2 compiler/config/
// usage error, 3 runtime error).
type APIResult struct {
  Code   int    `json:"code"`
  Stdout string `json:"stdout"`
  Stderr string `json:"stderr"`
}

// CompileResult mirrors `ttsc api-compile`. Field names are TypeScript-style
// so JS callers can use it directly without remapping.
type CompileResult struct {
  Diagnostics []CompileDiagnostic `json:"diagnostics,omitempty"`
  // Output maps cwd-relative paths to emitted JS / d.ts text. Empty when
  // the program produced no files (e.g. `noEmit` projects).
  Output map[string]string `json:"output"`
}

// TransformResult is the no-emit companion. The `typescript` map keys files
// the same way `output` does in compile mode.
type TransformResult struct {
  Diagnostics []CompileDiagnostic `json:"diagnostics,omitempty"`
  TypeScript  map[string]string   `json:"typescript"`
}

// CompileDiagnostic is the public TypeScript-side diagnostic DTO. Mirrors the
// shape `ttsc api-compile` writes so the JS host can render it without
// remapping fields.
type CompileDiagnostic struct {
  File        *string `json:"file"`
  Category    string  `json:"category"`
  Code        int32   `json:"code"`
  Start       *int    `json:"start,omitempty"`
  Length      *int    `json:"length,omitempty"`
  Line        int     `json:"line,omitempty"`
  Character   int     `json:"character,omitempty"`
  MessageText string  `json:"messageText"`
}

// Build runs `ttsc build`-shaped emit: load the project, emit JS, return the
// emitted text map + diagnostics as JSON. `cwd` must be an absolute path
// inside the host filesystem; `tsconfigPath` may be relative to cwd.
func Build(cwd, tsconfigPath string) ([]byte, int, error) {
  prog, diags, err := driver.LoadProgram(cwd, tsconfigPath, driver.LoadProgramOptions{
    ForceEmit: true,
  })
  if err != nil {
    return nil, 2, err
  }
  if prog != nil {
    defer prog.Close()
    diags = append(diags, prog.Diagnostics()...)
  }
  output := map[string]string{}
  if prog != nil {
    rewrites := driver.NewRewriteSet()
    writeFile := shimcompiler.WriteFile(
      func(fileName, text string, _ *shimcompiler.WriteFileData) error {
        output[apiOutputKey(cwd, fileName)] = text
        return nil
      },
    )
    _, emitDiags, eerr := prog.EmitAll(rewrites, writeFile)
    if eerr != nil {
      return nil, 3, fmt.Errorf("emit failed: %w", eerr)
    }
    diags = append(diags, emitDiags...)
  }
  result := CompileResult{
    Diagnostics: make([]CompileDiagnostic, 0, len(diags)),
    Output:      output,
  }
  for _, d := range diags {
    result.Diagnostics = append(result.Diagnostics, toAPIDiagnostic(d))
  }
  data, err := json.Marshal(result)
  if err != nil {
    return nil, 3, fmt.Errorf("result marshal failed: %w", err)
  }
  code := 0
  if driver.CountErrors(diags) > 0 {
    code = 2
  }
  return data, code, nil
}

// Check runs the typecheck pipeline without emitting JS. The returned JSON
// has the same shape as Build but with an empty `output` map.
func Check(cwd, tsconfigPath string) ([]byte, int, error) {
  prog, diags, err := driver.LoadProgram(cwd, tsconfigPath, driver.LoadProgramOptions{
    ForceNoEmit: true,
  })
  if err != nil {
    return nil, 2, err
  }
  if prog != nil {
    defer prog.Close()
    diags = append(diags, prog.Diagnostics()...)
  }
  result := CompileResult{
    Diagnostics: make([]CompileDiagnostic, 0, len(diags)),
    Output:      map[string]string{},
  }
  for _, d := range diags {
    result.Diagnostics = append(result.Diagnostics, toAPIDiagnostic(d))
  }
  data, err := json.Marshal(result)
  if err != nil {
    return nil, 3, fmt.Errorf("result marshal failed: %w", err)
  }
  code := 0
  if driver.CountErrors(diags) > 0 {
    code = 2
  }
  return data, code, nil
}

// Transform returns every source file the program saw, keyed by
// project-relative path. The playground uses this to render the TS view
// after source rewrites (e.g. paths rewriting) have been applied.
func Transform(cwd, tsconfigPath string) ([]byte, int, error) {
  prog, diags, err := driver.LoadProgram(cwd, tsconfigPath, driver.LoadProgramOptions{
    ForceNoEmit: true,
  })
  if err != nil {
    return nil, 2, err
  }
  typescript := map[string]string{}
  if prog != nil {
    defer prog.Close()
    for _, file := range prog.SourceFiles() {
      typescript[apiOutputKey(cwd, file.FileName())] = file.Text()
    }
    diags = append(diags, prog.Diagnostics()...)
  }
  result := TransformResult{
    Diagnostics: make([]CompileDiagnostic, 0, len(diags)),
    TypeScript:  typescript,
  }
  for _, d := range diags {
    result.Diagnostics = append(result.Diagnostics, toAPIDiagnostic(d))
  }
  data, err := json.Marshal(result)
  if err != nil {
    return nil, 3, fmt.Errorf("result marshal failed: %w", err)
  }
  code := 0
  if driver.CountErrors(diags) > 0 {
    code = 2
  }
  return data, code, nil
}

// toAPIDiagnostic converts a driver.Diagnostic into the JSON-serialisable
// CompileDiagnostic. File paths are normalised to forward slashes so the JS
// host can compare them against its own MemFS paths.
func toAPIDiagnostic(diag driver.Diagnostic) CompileDiagnostic {
  var file *string
  if diag.File != "" {
    value := filepath.ToSlash(diag.File)
    file = &value
  }
  category := "error"
  if diag.Severity == driver.SeverityWarning {
    category = "warning"
  }
  return CompileDiagnostic{
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

// apiOutputKey returns the map key used in CompileResult.Output and
// TransformResult.TypeScript. Paths inside cwd are made project-relative;
// paths outside cwd (e.g. lib files) are returned as absolute slash paths.
func apiOutputKey(cwd, fileName string) string {
  rel, err := filepath.Rel(cwd, fileName)
  if err != nil || isOutsideRelativePath(rel) {
    return filepath.ToSlash(fileName)
  }
  return filepath.ToSlash(rel)
}

// isOutsideRelativePath reports whether rel escapes the base directory (i.e.
// starts with ".."). Such paths should not be presented as project-relative
// keys to the JS caller.
func isOutsideRelativePath(rel string) bool {
  return rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator))
}

package graph

import (
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestResolvePrefersImplementationDeclarationSpan verifies overloaded callables
// resolve to the executable implementation span, not the first signature.
//
// Without this, MCP answers can show only an overload header and omit the body
// that explains downstream calls, pushing agents back to raw file reads.
//
//  1. Compile an overloaded function whose implementation contains a unique
//     expression.
//  2. Resolve the function symbol.
//  3. Assert the selected target span includes the implementation body.
func TestResolvePrefersImplementationDeclarationSpan(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), fixtureTSConfig)
  writeFile(t, filepath.Join(root, "src", "main.ts"), `export function api(value: string): string
export function api(value: string): string {
  return value.toUpperCase()
}

api("x")
`)

  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected diagnostics: %v", diags)
  }
  defer func() { _ = prog.Close() }()

  file := sourceFile(t, prog, "main.ts")
  target := Resolve(prog.Checker, identifier(t, file, "api"))
  if target == nil {
    t.Fatal("Resolve returned nil for api")
  }
  source := file.Text()[target.Pos:target.End]
  if !strings.Contains(source, "toUpperCase") {
    t.Fatalf("expected Resolve to report the implementation span, got:\n%s", source)
  }
}

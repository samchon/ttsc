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
// The unique toUpperCase substring distinguishes the implementation from its
// authored signature. Exact declaration bounds, target file classification,
// call-site-specific overload selection, and MCP consumer behavior are not
// asserted by this one function fixture.
//
//  1. Compile an overloaded function whose implementation contains a unique
//     expression.
//  2. Resolve the function symbol.
//  3. Assert the selected target span includes the implementation body.
//
// @evidence contracts/testing.md#behavioral-verification Requires a nonnil target for the helper-selected api identifier and a span containing the implementation-only toUpperCase substring. This is one overloaded function, not all callable forms or an exact-boundary oracle.
// @evidence contracts/testing.md#independent-expectations The expectation is literal: resolving the identifier api in an overloaded function (one signature then an implementation containing toUpperCase) must return a target whose source span contains toUpperCase, which only the implementation body has.
// @evidence contracts/testing.md#distinguishing-cases Compile an overloaded function whose implementation contains a unique expression; Resolve the function symbol; Assert the selected target span includes the implementation body.
// @evidence contracts/testing.md#execution-ownership Owns temporary native config/source files and a directly loaded library Program, closes it, and restores an empty linked-plugin manifest. Resolve executes in this process using its checker and the first matching api identifier; the observed span slices that Program's authored source. No product CLI, installation, emitted function evaluation, or MCP query runs.
func TestResolvePrefersImplementationDeclarationSpan(t *testing.T) {
  t.Setenv(driver.LinkedPluginsEnv, "")
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

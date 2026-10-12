package main

import (
  "bytes"
  "go/ast"
  "go/parser"
  "go/token"
  "go/types"
  "os"
  "path/filepath"
  "strings"
  "testing"

  "golang.org/x/tools/go/packages"
)

// Verifies a removed public member blocks generation before existing output changes.
//
// Another missing sibling must not turn an upstream removal into a successful
// rewrite that silently deletes the old API. Migration requires an explicit
// decision about the removed member's meaning.
//
//  1. Publish Alpha and an earlier generated Delta in an owned shim.
//  2. Type-check current upstream Alpha and new Beta, with Delta absent.
//  3. Run the actual analyzer and generator and require unchanged old output.
//
// @evidence contracts/testing.md#behavioral-verification Real source scanning, Go type checking, analysis and generation exercise the missing-member boundary and verify the previously published file remains byte-identical.
// @evidence contracts/testing.md#independent-expectations Literal authored old Delta and current Alpha/Beta declarations establish the removal and concurrent new sibling independently of analyzer findings.
// @evidence contracts/testing.md#distinguishing-cases An upstream removal and a new gap coexist in the same package, so ordinary sibling regeneration cannot conceal public API loss.
// @evidence contracts/testing.md#execution-ownership The owning auditor unit uses temporary source files and in-process parser/type-checker/generator operations; no native artifact, subprocess or installation executes.
func TestEnumGenerationRefusesRemovedPublicMembers(t *testing.T) {
  root := t.TempDir()
  directory := filepath.Join(root, "ast")
  if err := os.MkdirAll(directory, 0o755); err != nil {
    t.Fatal(err)
  }
  authored := `package ast
import innerast "github.com/microsoft/TypeScript/tsc/internal/ast"
type Mode = innerast.Mode
const Alpha = innerast.Alpha
`
  previous := []byte(`package ast
import innerast "github.com/microsoft/TypeScript/tsc/internal/ast"
const Delta = innerast.Delta
`)
  output := filepath.Join(directory, "enums_gen.go")
  if err := os.WriteFile(filepath.Join(directory, "shim.go"), []byte(authored), 0o644); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(output, previous, 0o644); err != nil {
    t.Fatal(err)
  }
  fset := token.NewFileSet()
  file, err := parser.ParseFile(fset, "upstream.go", "package ast\ntype Mode int\nconst ( Alpha Mode = iota; Beta )\n", 0)
  if err != nil {
    t.Fatal(err)
  }
  pkg, err := (&types.Config{}).Check(internalPrefix+"ast", fset, []*ast.File{file}, nil)
  if err != nil {
    t.Fatal(err)
  }
  reachable, err := scanShimReachable(root)
  if err != nil {
    t.Fatal(err)
  }
  exports, err := scanShimEnumExports(root, false)
  if err != nil {
    t.Fatal(err)
  }
  family, err := scanShimEnumExports(root, true)
  if err != nil {
    t.Fatal(err)
  }
  findings, _ := analyze(reachable, map[string]*packages.Package{"ast": {Types: pkg}}, exports, family)
  refusal := runFix(findings, root)
  if refusal == nil || !strings.Contains(refusal.Error(), "ast.Delta") {
    t.Fatalf("removed member was not named in the refusal: %v", refusal)
  }
  evaluation := evaluateBaseline(findings, baselineFile{Accepted: []string{"ENUM_REMOVED|ast|Delta"}}, nil)
  if len(evaluation.enumRemovals) != 1 || evaluation.enumRemovals[0].symbol != "Delta" || len(evaluation.enumGaps) != 1 || evaluation.enumGaps[0].symbol != "Beta" {
    t.Fatalf("removal and new sibling must remain separate non-grandfathered findings: %#v", evaluation)
  }
  if tierOf("ENUM_REMOVED") != 1 {
    t.Fatal("public removal was hidden in the informational summary")
  }
  current, err := os.ReadFile(output)
  if err != nil {
    t.Fatal(err)
  }
  if !bytes.Equal(previous, current) {
    t.Fatal("upstream removal was silently overwritten while adding Beta")
  }
}

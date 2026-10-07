package driver_test

import (
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverSessionAppliesIncrementalOverlayEdit verifies Session.Apply reports
// incremental data reuse for a body-only edit and SourceText shows return 2.
// The reuse flag does not mean the same native Program object is returned.
//
// Initial and edited source distinguish update from stale text; diagnostic changes are not asserted.
//
// 1. Open a Session on a two-file project (a imports b).
// 2. Apply an overlay edit to b's body.
// 3. Assert Apply reports reuse and SourceText shows the new body.
//
// @evidence contracts/testing.md#behavioral-verification Session.Apply reports reused=true for a body-only edit and SourceText shows return 2; native object identity is not asserted.
// @evidence contracts/testing.md#independent-expectations The authored edit preserves signature and imports while changing return 1 to return 2.
// @evidence contracts/testing.md#distinguishing-cases Initial and edited source distinguish update from stale text; diagnostic changes are not asserted.
// @evidence contracts/testing.md#execution-ownership Direct Go NewSession, Apply, and SourceText own a private project with deferred Close. Go discovers TestDriverSessionAppliesIncrementalOverlayEdit under ./test/driver.
func TestDriverSessionAppliesIncrementalOverlayEdit(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{"compilerOptions":{"strict":true,"noEmit":true},"files":["a.ts","b.ts"]}`)
  writeProjectFile(t, root, "a.ts", "import { b } from \"./b\";\nexport const a: number = b();\n")
  writeProjectFile(t, root, "b.ts", "export function b(): number {\n  return 1;\n}\n")

  sess, diags, err := driver.NewSession(root, "tsconfig.json", driver.LoadProgramOptions{ForceNoEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if sess == nil {
    t.Fatalf("NewSession returned nil session (diagnostics: %v)", diags)
  }
  defer sess.Close()

  bAbs := filepath.Join(root, "b.ts")
  if text, ok := sess.SourceText(bAbs); !ok || !strings.Contains(text, "return 1") {
    t.Fatalf("initial source text mismatch: ok=%v text=%q", ok, text)
  }

  if reused := sess.Apply(bAbs, "export function b(): number {\n  return 2;\n}\n"); !reused {
    t.Fatalf("expected the overlay edit to reuse the program, got reused=false")
  }

  text, ok := sess.SourceText(bAbs)
  if !ok || !strings.Contains(text, "return 2") {
    t.Fatalf("session did not reflect the overlay edit: ok=%v text=%q", ok, text)
  }
}

// TestDriverSessionRebuildsWhenImportGraphChanges verifies Session.Apply reports
// reused=false after an import is added and SourceText reflects the edit.
//
// Import-free b.ts gains an edge, complementing body-only reuse in its sibling.
//
// 1. Open a Session where b.ts imports nothing.
// 2. Apply an edit to b.ts that adds an import of c.ts.
// 3. Assert Apply reported reused=false and SourceText shows the new body.
//
// @evidence contracts/testing.md#behavioral-verification Session.Apply reports no reuse after an import is added and SourceText reflects the edit.
// @evidence contracts/testing.md#independent-expectations The authored c.ts edge changes import structure independently of the reuse decision.
// @evidence contracts/testing.md#distinguishing-cases Import-free b.ts gains an edge, complementing body-only reuse in its sibling.
// @evidence contracts/testing.md#execution-ownership The direct Go Session owns and closes its temporary three-file project. Go discovers TestDriverSessionRebuildsWhenImportGraphChanges under ./test/driver.
func TestDriverSessionRebuildsWhenImportGraphChanges(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{"compilerOptions":{"strict":true,"noEmit":true},"files":["a.ts","b.ts","c.ts"]}`)
  writeProjectFile(t, root, "a.ts", "import { b } from \"./b\";\nexport const a: number = b();\n")
  writeProjectFile(t, root, "b.ts", "export function b(): number {\n  return 1;\n}\n")
  writeProjectFile(t, root, "c.ts", "export function c(): number {\n  return 5;\n}\n")

  sess, diags, err := driver.NewSession(root, "tsconfig.json", driver.LoadProgramOptions{ForceNoEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if sess == nil {
    t.Fatalf("NewSession returned nil session (diagnostics: %v)", diags)
  }
  defer sess.Close()

  bAbs := filepath.Join(root, "b.ts")
  // Adding an import changes its import graph, so the update reports no
  // incremental data reuse. Neither branch asserts native object identity.
  edited := "import { c } from \"./c\";\nexport function b(): number {\n  return c();\n}\n"
  if reused := sess.Apply(bAbs, edited); reused {
    t.Fatalf("expected an import-graph change to rebuild the program, got reused=true")
  }

  text, ok := sess.SourceText(bAbs)
  if !ok || !strings.Contains(text, "return c()") {
    t.Fatalf("session did not reflect the import-adding edit: ok=%v text=%q", ok, text)
  }
}

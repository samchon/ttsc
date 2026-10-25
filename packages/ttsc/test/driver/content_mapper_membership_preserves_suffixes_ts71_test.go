//go:build ttsc_typescript_7_1

package driver_test

import (
  "path/filepath"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestContentMapperMembershipPreservesSuffixes verifies a native mapper root
// and its reported suffix keep the same Unicode spelling.
//
// Lowercasing dotted I changes the root universe a watcher would observe.
//
//  1. Load a real mapper project with an unimported dotted-I root.
//  2. Require that root in the native Program and its exact suffix in metadata.
//  3. Close the Program and its mapper through the ordinary owner.
//
// @evidence contracts/testing.md#behavioral-verification Real LoadProgram enumerates an unimported mapper root and NewTransformGraph must report its original suffix; a lowercase-only projection loses that root's watcher admission.
// @evidence contracts/testing.md#independent-expectations The authored extension and root filename are literal dotted I, so the expected suffix follows configuration rather than reconstructed native metadata.
// @evidence contracts/testing.md#distinguishing-cases Ordinary SQL import and an unimported Unicode root coexist; exact dotted I must remain and its unrelated lowercase i must not be invented. The installed adapter scenario owns add/remove invalidation.
// @evidence contracts/testing.md#execution-ownership The driver unit owns one temporary mapper project, real native Program and Node mapper, and closes the Program on every acquired path.
func TestContentMapperMembershipPreservesSuffixes(t *testing.T) {
  root := writeContentMapperProject(t)
  writeProjectFile(t, root, "tsconfig.json", `{
    "compilerOptions": { "module": "commonjs", "target": "es2020", "strict": true },
    "include": ["*"],
    "contentMappers": [{ "package": "sql-mapper", "extensions": [".sql", ".İ"] }]
  }`)
  writeProjectFile(t, root, "extra.İ", "extra\n")
  program, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{TsgoArgs: []string{"--runExternalCode"}})
  if err != nil || program == nil || len(diags) != 0 {
    t.Fatalf("mapper load: %v %#v", err, diags)
  }
  t.Cleanup(func() {
    if err := program.Close(); err != nil {
      t.Error(err)
    }
  })
  if program.SourceFile(filepath.Join(root, "extra.İ")) == nil {
    t.Fatal("the native Program omitted the authored mapper root")
  }
  graph := driver.NewTransformGraph(program, root)
  if graph.Membership == nil {
    t.Fatal("missing native membership report")
  }
  exact := false
  for _, suffix := range graph.Membership.InputExtensions {
    if suffix == ".İ" {
      exact = true
    }
    if suffix == ".i" {
      t.Fatal("membership invented a lowercase mapper suffix")
    }
  }
  if !exact {
    t.Fatalf("authored suffix missing: %#v", graph.Membership.InputExtensions)
  }
}

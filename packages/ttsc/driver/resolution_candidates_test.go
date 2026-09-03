package driver

import (
  "path/filepath"
  "reflect"
  "testing"

  shimcore "github.com/microsoft/typescript-go/shim/core"
)

func TestPackageTargetCandidatesPreserveDeclaredTypeScriptExtension(t *testing.T) {
  root := t.TempDir()
  context := ModuleResolutionContext{
    Options: &shimcore.CompilerOptions{ModuleSuffixes: []string{".native", ""}},
  }
  cases := []struct {
    target string
    native string
  }{
    {target: "index.ts", native: "index.native.ts"},
    {target: "index.tsx", native: "index.native.tsx"},
    {target: "index.mts", native: "index.native.mts"},
    {target: "index.cts", native: "index.native.cts"},
    {target: "index.d.ts", native: "index.d.native.ts"},
    {target: "index.d.mts", native: "index.d.native.mts"},
    {target: "index.d.cts", native: "index.d.native.cts"},
  }
  for _, test := range cases {
    target := filepath.Join("dist", test.target)
    actual := packageTargetCandidates(
      root,
      []packageTarget{{path: filepath.ToSlash(target), packageEntry: true}},
      context,
    )
    expected := []string{
      filepath.Join(root, "dist", test.native),
      filepath.Join(root, target),
    }
    if !reflect.DeepEqual(actual, expected) {
      t.Fatalf("package target %q candidates = %#v, want %#v", test.target, actual, expected)
    }
  }
}

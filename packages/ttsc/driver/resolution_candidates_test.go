package driver

import (
  "path/filepath"
  "reflect"
  "testing"

  shimcore "github.com/microsoft/typescript-go/shim/core"
)

func TestPackageTargetCandidatesMirrorCompilerPassesForTypeScriptTargets(t *testing.T) {
  root := t.TempDir()
  context := ModuleResolutionContext{
    Options: &shimcore.CompilerOptions{ModuleSuffixes: []string{".native", ""}},
  }
  cases := []struct {
    target   string
    native   string
    fallback []string
  }{
    {
      target: "index.ts",
      native: "index.native.ts",
      fallback: []string{
        "index.native.ts", "index.ts", "index.native.tsx", "index.tsx",
        "index.native.d.ts", "index.d.ts", "index.native.js", "index.js",
        "index.native.jsx", "index.jsx",
      },
    },
    {
      target: "index.tsx",
      native: "index.native.tsx",
      fallback: []string{
        "index.native.tsx", "index.tsx", "index.native.ts", "index.ts",
        "index.native.d.ts", "index.d.ts", "index.native.jsx", "index.jsx",
        "index.native.js", "index.js",
      },
    },
    {
      target:   "index.mts",
      native:   "index.native.mts",
      fallback: []string{"index.native.mts", "index.mts", "index.native.d.mts", "index.d.mts", "index.native.mjs", "index.mjs"},
    },
    {
      target:   "index.cts",
      native:   "index.native.cts",
      fallback: []string{"index.native.cts", "index.cts", "index.native.d.cts", "index.d.cts", "index.native.cjs", "index.cjs"},
    },
    {
      target: "index.d.ts",
      native: "index.native.d.ts",
      fallback: []string{
        "index.native.ts", "index.ts", "index.native.tsx", "index.tsx",
        "index.native.d.ts", "index.d.ts", "index.native.js", "index.js",
        "index.native.jsx", "index.jsx",
      },
    },
    {
      target:   "index.d.mts",
      native:   "index.native.d.mts",
      fallback: []string{"index.native.mts", "index.mts", "index.native.d.mts", "index.d.mts", "index.native.mjs", "index.mjs"},
    },
    {
      target:   "index.d.cts",
      native:   "index.native.d.cts",
      fallback: []string{"index.native.cts", "index.cts", "index.native.d.cts", "index.d.cts", "index.native.cjs", "index.cjs"},
    },
  }
  for _, test := range cases {
    target := filepath.Join("dist", test.target)
    actual := packageTargetCandidates(
      root,
      []packageTarget{{path: filepath.ToSlash(target)}},
      context,
    )
    expectedNames := append([]string{test.native, test.target}, test.fallback...)
    expected := make([]string, 0, len(expectedNames))
    for _, name := range expectedNames {
      expected = append(expected, filepath.Join(root, "dist", name))
    }
    if !reflect.DeepEqual(actual, expected) {
      t.Fatalf("package target %q candidates = %#v, want %#v", test.target, actual, expected)
    }
  }

  noDeclarations := ModuleResolutionContext{
    Options: &shimcore.CompilerOptions{
      ModuleSuffixes:  []string{".native", ""},
      NoDtsResolution: shimcore.TSTrue,
    },
  }
  withoutDeclarations := []struct {
    target   string
    expected []string
  }{
    {
      target: "index.d.ts",
      expected: []string{
        "index.native.ts", "index.ts", "index.native.tsx", "index.tsx",
        "index.native.js", "index.js", "index.native.jsx", "index.jsx",
      },
    },
    {
      target:   "index.d.mts",
      expected: []string{"index.native.mts", "index.mts", "index.native.mjs", "index.mjs"},
    },
    {
      target:   "index.d.cts",
      expected: []string{"index.native.cts", "index.cts", "index.native.cjs", "index.cjs"},
    },
  }
  for _, test := range withoutDeclarations {
    actual := packageTargetCandidates(
      root,
      []packageTarget{{path: filepath.ToSlash(filepath.Join("dist", test.target))}},
      noDeclarations,
    )
    expected := make([]string, 0, len(test.expected))
    for _, name := range test.expected {
      expected = append(expected, filepath.Join(root, "dist", name))
    }
    if !reflect.DeepEqual(actual, expected) {
      t.Fatalf("package target %q candidates without declarations = %#v, want %#v", test.target, actual, expected)
    }
  }
}

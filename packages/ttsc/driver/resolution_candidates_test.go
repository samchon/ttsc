package driver

import (
  "os"
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
  targets := []packageTarget{
    {path: "dist/first.ts"},
    {path: "dist/second.d.ts"},
  }
  pathsAt := func(base string, names ...string) []string {
    output := make([]string, 0, len(names))
    for _, name := range names {
      output = append(output, filepath.Join(base, "dist", name))
    }
    return output
  }
  paths := func(names ...string) []string {
    return pathsAt(root, names...)
  }
  extensionCases := []struct {
    target    string
    preferred []string
    fallback  []string
  }{
    {
      target:    "index.ts",
      preferred: []string{"index.native.ts", "index.ts"},
      fallback:  []string{"index.native.js", "index.js", "index.native.jsx", "index.jsx"},
    },
    {
      target:    "index.tsx",
      preferred: []string{"index.native.tsx", "index.tsx"},
      fallback:  []string{"index.native.jsx", "index.jsx", "index.native.js", "index.js"},
    },
    {
      target:    "index.mts",
      preferred: []string{"index.native.mts", "index.mts"},
      fallback:  []string{"index.native.mjs", "index.mjs"},
    },
    {
      target:    "index.cts",
      preferred: []string{"index.native.cts", "index.cts"},
      fallback:  []string{"index.native.cjs", "index.cjs"},
    },
    {
      target:    "index.d.ts",
      preferred: []string{"index.native.d.ts", "index.d.ts"},
      fallback:  []string{"index.native.js", "index.js", "index.native.jsx", "index.jsx"},
    },
    {
      target:    "index.d.mts",
      preferred: []string{"index.native.d.mts", "index.d.mts"},
      fallback:  []string{"index.native.mjs", "index.mjs"},
    },
    {
      target:    "index.d.cts",
      preferred: []string{"index.native.d.cts", "index.d.cts"},
      fallback:  []string{"index.native.cjs", "index.cjs"},
    },
  }
  for _, test := range extensionCases {
    target := []packageTarget{{path: filepath.ToSlash(filepath.Join("dist", test.target))}}
    preferred := packageTargetCandidates(root, target, context, moduleCandidatePassPreferred)
    fallback := packageTargetCandidates(root, target, context, moduleCandidatePassFallback)
    if expected := paths(test.preferred...); !reflect.DeepEqual(preferred, expected) {
      t.Fatalf("package target %q preferred candidates = %#v, want %#v", test.target, preferred, expected)
    }
    if expected := paths(test.fallback...); !reflect.DeepEqual(fallback, expected) {
      t.Fatalf("package target %q fallback candidates = %#v, want %#v", test.target, fallback, expected)
    }
  }

  preferred := packageTargetCandidates(root, targets, context, moduleCandidatePassPreferred)
  fallback := packageTargetCandidates(root, targets, context, moduleCandidatePassFallback)
  actual := append(preferred, fallback...)
  expected := paths(
    "first.native.ts", "first.ts",
    "second.native.d.ts", "second.d.ts",
    "first.native.js", "first.js", "first.native.jsx", "first.jsx",
    "second.native.js", "second.js", "second.native.jsx", "second.jsx",
  )
  if !reflect.DeepEqual(actual, expected) {
    t.Fatalf("exports target candidates = %#v, want %#v", actual, expected)
  }

  imports := packageTargetCandidates(
    root,
    []packageTarget{{path: "dist/first.ts"}, {path: "dist/fallback.js"}},
    context,
    moduleCandidatePassAll,
  )
  expectedImports := paths(
    "first.native.ts", "first.ts",
    "fallback.native.ts", "fallback.ts", "fallback.native.tsx", "fallback.tsx",
    "fallback.native.d.ts", "fallback.d.ts", "fallback.native.js", "fallback.js",
    "fallback.native.jsx", "fallback.jsx",
  )
  if !reflect.DeepEqual(imports, expectedImports) {
    t.Fatalf("imports target candidates = %#v, want %#v", imports, expectedImports)
  }

  esmContext := context
  esmContext.Mode = shimcore.ResolutionModeESM
  entry := packageTargetCandidates(
    root,
    []packageTarget{{path: "dist/index.d.ts", kind: packageTargetEntry}},
    esmContext,
    moduleCandidatePassPreferred,
  )
  expectedEntry := paths(
    "index.native.d.ts", "index.d.ts",
    "index.native.ts", "index.ts", "index.native.tsx", "index.tsx",
    "index.native.d.ts", "index.d.ts",
  )
  if !reflect.DeepEqual(entry, expectedEntry) {
    t.Fatalf("package entry candidates = %#v, want %#v", entry, expectedEntry)
  }

  versionedRoot := filepath.Join(root, "versioned")
  if err := os.MkdirAll(versionedRoot, 0o755); err != nil {
    t.Fatal(err)
  }
  versionedManifest := filepath.Join(versionedRoot, "package.json")
  if err := os.WriteFile(
    versionedManifest,
    []byte(`{"type":"module","typesVersions":{"*":{"*":["dist/*.ts"]}}}`),
    0o644,
  ); err != nil {
    t.Fatal(err)
  }
  preferred, _ = packageManifestCandidates(versionedRoot, "versioned", esmContext, moduleCandidatePassPreferred)
  fallback, _ = packageManifestCandidates(versionedRoot, "versioned", esmContext, moduleCandidatePassFallback)
  expectedPreferredVersioned := pathsAt(versionedRoot,
    "versioned.native.ts", "versioned.ts",
    "versioned.native.ts", "versioned.ts", "versioned.native.tsx", "versioned.tsx",
    "versioned.native.d.ts", "versioned.d.ts",
  )
  expectedFallbackVersioned := pathsAt(versionedRoot,
    "versioned.native.ts", "versioned.ts",
    "versioned.native.js", "versioned.js", "versioned.native.jsx", "versioned.jsx",
  )
  if !reflect.DeepEqual(preferred, expectedPreferredVersioned) {
    t.Fatalf("typesVersions preferred candidates = %#v, want %#v", preferred, expectedPreferredVersioned)
  }
  if !reflect.DeepEqual(fallback, expectedFallbackVersioned) {
    t.Fatalf("typesVersions fallback candidates = %#v, want %#v", fallback, expectedFallbackVersioned)
  }

  if err := os.WriteFile(
    versionedManifest,
    []byte(`{"type":"commonjs","typesVersions":{"*":{"*":["dist/*"]}}}`),
    0o644,
  ); err != nil {
    t.Fatal(err)
  }
  preferred, _ = packageManifestCandidates(versionedRoot, "captured.js", esmContext, moduleCandidatePassPreferred)
  fallback, _ = packageManifestCandidates(versionedRoot, "captured.js", esmContext, moduleCandidatePassFallback)
  expectedPreferredCaptured := pathsAt(versionedRoot,
    "captured.native.ts", "captured.ts", "captured.native.tsx", "captured.tsx",
    "captured.native.d.ts", "captured.d.ts",
  )
  expectedFallbackCaptured := pathsAt(versionedRoot,
    "captured.native.js", "captured.js", "captured.native.jsx", "captured.jsx",
  )
  if !reflect.DeepEqual(preferred, expectedPreferredCaptured) {
    t.Fatalf("wildcard-captured extension preferred candidates = %#v, want %#v", preferred, expectedPreferredCaptured)
  }
  if !reflect.DeepEqual(fallback, expectedFallbackCaptured) {
    t.Fatalf("wildcard-captured extension fallback candidates = %#v, want %#v", fallback, expectedFallbackCaptured)
  }
  extensionless, _ := packageManifestCandidates(versionedRoot, "captured", esmContext, moduleCandidatePassPreferred)
  if len(extensionless) != 0 {
    t.Fatalf("ESM typesVersions subpath gained CommonJS implicit candidates: %#v", extensionless)
  }

  manifestRoot := filepath.Join(root, "manifest")
  if err := os.MkdirAll(manifestRoot, 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(
    filepath.Join(manifestRoot, "package.json"),
    []byte(`{"typings":"dist/typed.d.ts","types":"dist/ignored.d.ts","main":"dist/runtime.js","type":"module"}`),
    0o644,
  ); err != nil {
    t.Fatal(err)
  }
  preferredEntry, _ := packageManifestCandidates(manifestRoot, "", esmContext, moduleCandidatePassPreferred)
  fallbackEntry, _ := packageManifestCandidates(manifestRoot, "", esmContext, moduleCandidatePassFallback)
  expectedPreferredEntry := []string{
    filepath.Join(manifestRoot, "dist", "typed.native.d.ts"),
    filepath.Join(manifestRoot, "dist", "typed.d.ts"),
    filepath.Join(manifestRoot, "dist", "typed.native.ts"),
    filepath.Join(manifestRoot, "dist", "typed.ts"),
    filepath.Join(manifestRoot, "dist", "typed.native.tsx"),
    filepath.Join(manifestRoot, "dist", "typed.tsx"),
    filepath.Join(manifestRoot, "dist", "typed.native.d.ts"),
    filepath.Join(manifestRoot, "dist", "typed.d.ts"),
  }
  expectedFallbackEntry := []string{
    filepath.Join(manifestRoot, "dist", "runtime.native.js"),
    filepath.Join(manifestRoot, "dist", "runtime.js"),
    filepath.Join(manifestRoot, "dist", "runtime.native.jsx"),
    filepath.Join(manifestRoot, "dist", "runtime.jsx"),
  }
  if !reflect.DeepEqual(preferredEntry, expectedPreferredEntry) {
    t.Fatalf("preferred package fields = %#v, want %#v", preferredEntry, expectedPreferredEntry)
  }
  if !reflect.DeepEqual(fallbackEntry, expectedFallbackEntry) {
    t.Fatalf("fallback package fields = %#v, want %#v", fallbackEntry, expectedFallbackEntry)
  }

  noDeclarations := ModuleResolutionContext{
    Options: &shimcore.CompilerOptions{
      ModuleSuffixes:  []string{".native", ""},
      NoDtsResolution: shimcore.TSTrue,
    },
  }
  noDeclarationTarget := []packageTarget{{path: "dist/index.d.ts"}}
  preferred = packageTargetCandidates(root, noDeclarationTarget, noDeclarations, moduleCandidatePassPreferred)
  fallback = packageTargetCandidates(root, noDeclarationTarget, noDeclarations, moduleCandidatePassFallback)
  actual = append(preferred, fallback...)
  expected = paths(
    "index.native.ts", "index.ts", "index.native.tsx", "index.tsx",
    "index.native.js", "index.js", "index.native.jsx", "index.jsx",
  )
  if !reflect.DeepEqual(actual, expected) {
    t.Fatalf("noDtsResolution package target candidates = %#v, want %#v", actual, expected)
  }

  noDeclarationCases := []struct {
    target    string
    preferred []string
    fallback  []string
  }{
    {
      target:    "index.d.mts",
      preferred: []string{"index.native.mts", "index.mts"},
      fallback:  []string{"index.native.mjs", "index.mjs"},
    },
    {
      target:    "index.d.cts",
      preferred: []string{"index.native.cts", "index.cts"},
      fallback:  []string{"index.native.cjs", "index.cjs"},
    },
  }
  for _, test := range noDeclarationCases {
    target := []packageTarget{{path: filepath.ToSlash(filepath.Join("dist", test.target))}}
    preferred := packageTargetCandidates(root, target, noDeclarations, moduleCandidatePassPreferred)
    fallback := packageTargetCandidates(root, target, noDeclarations, moduleCandidatePassFallback)
    if expected := paths(test.preferred...); !reflect.DeepEqual(preferred, expected) {
      t.Fatalf("package target %q preferred noDtsResolution candidates = %#v, want %#v", test.target, preferred, expected)
    }
    if expected := paths(test.fallback...); !reflect.DeepEqual(fallback, expected) {
      t.Fatalf("package target %q fallback noDtsResolution candidates = %#v, want %#v", test.target, fallback, expected)
    }
  }

  sourceDirectory := filepath.Join(root, "workspace", "packages", "app", "src")
  nearPackage := filepath.Join(sourceDirectory, "node_modules", "order-pkg")
  farPackage := filepath.Join(root, "workspace", "node_modules", "order-pkg")
  for _, fixture := range []struct {
    root   string
    source string
  }{
    {root: nearPackage, source: `{"exports":["./dist/near.ts","./dist/near-fallback.js"]}`},
    {root: farPackage, source: `{"exports":["./dist/far.ts","./dist/far-fallback.js"]}`},
  } {
    if err := os.MkdirAll(fixture.root, 0o755); err != nil {
      t.Fatal(err)
    }
    if err := os.WriteFile(filepath.Join(fixture.root, "package.json"), []byte(fixture.source), 0o644); err != nil {
      t.Fatal(err)
    }
  }
  ordered := ModuleResolutionCandidates(nil, sourceDirectory, filepath.Join(root, "workspace"), "order-pkg", context)
  indexOf := func(candidate string) int {
    for index, current := range ordered {
      if current == candidate {
        return index
      }
    }
    return -1
  }
  farPreferred := indexOf(filepath.Join(farPackage, "dist", "far-fallback.native.d.ts"))
  nearFallback := indexOf(filepath.Join(nearPackage, "dist", "near.native.js"))
  if farPreferred < 0 || nearFallback < 0 || farPreferred >= nearFallback {
    t.Fatalf("node_modules candidates must finish every ancestor's preferred pass before fallback: %#v", ordered)
  }
}

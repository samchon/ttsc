package driver_test

import (
  "path/filepath"
  "strings"
  "testing"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverRewriteMatchesMemberChainAcrossLineBreaks verifies the rewriter
// can locate a namespaced call expression even when tsgo preserves source line
// breaks between the property segments.
//
// tsgo's emitter keeps `foo.bar\n    .baz()` formatting verbatim. The rewrite
// scanner used a literal needle (e.g. `typia_1.default.misc.literals(`) that
// could not span the intermediate whitespace, surfacing as a
// `driver: could not locate <root>.<namespace>.<method>(…)` failure even
// though the call was clearly present in the output. The fix uses a regex
// that tolerates whitespace and newlines between every segment.
//
// 1. Compile a project whose source writes `plugin.namespace\n.method()`.
// 2. Register a rewrite with the matching root/namespace/method descriptor.
// 3. Assert the emit succeeds and the replacement actually lands in the JS.
func TestDriverRewriteMatchesMemberChainAcrossLineBreaks(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "outDir": "bin",
    "strict": true
  },
  "files": ["index.ts", "plugin.ts"]
}
`)
  writeProjectFile(t, root, "plugin.ts", `export const plugin = {
  namespace: {
    method(): number { return 1; }
  }
};
`)
  writeProjectFile(t, root, "index.ts", `import { plugin } from "./plugin";

export const value = plugin.namespace
  .method();
`)

  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  defer prog.Close()
  source := prog.SourceFile(filepath.Join(root, "index.ts"))
  if source == nil {
    t.Fatal("SourceFile did not find index.ts")
  }

  rewrites := driver.NewRewriteSet()
  rewrites.Add(driver.Rewrite{
    File:          source,
    RootName:      "plugin",
    Namespaces:    []string{"namespace"},
    Method:        "method",
    Replacement:   `"replaced"`,
    ConsumeParens: true,
  })
  emitted := map[string]string{}
  _, emitDiags, err := prog.EmitAll(rewrites, func(fileName, text string, _ *shimcompiler.WriteFileData) error {
    emitted[filepath.Base(fileName)] = text
    return nil
  })
  if err != nil {
    t.Fatalf("emit returned an error (regression: rewriter rejected line-broken member chain): %v", err)
  }
  if len(emitDiags) != 0 {
    t.Fatalf("unexpected emit diagnostics: %#v", emitDiags)
  }
  js := emitted["index.js"]
  if !strings.Contains(js, `"replaced"`) {
    t.Fatalf("namespace.method rewrite not applied:\n%s", js)
  }
  if strings.Contains(js, ".namespace") && strings.Contains(js, ".method(") {
    t.Fatalf("rewriter left the original namespaced call behind:\n%s", js)
  }
}

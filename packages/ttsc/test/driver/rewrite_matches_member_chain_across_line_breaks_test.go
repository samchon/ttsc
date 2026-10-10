package driver_test

import (
  "path/filepath"
  "strings"
  "testing"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimtspath "github.com/microsoft/typescript-go/shim/tspath"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverRewriteMatchesMemberChainAcrossLineBreaks Verifies the rewriter
// can locate a namespaced call expression even when tsgo preserves source line
// breaks between the property segments.
//
// tsgo's emitter keeps `foo.bar\n    .baz()` formatting verbatim. A literal
// needle (e.g. `typia_1.default.misc.literals(`) cannot span the intermediate
// whitespace and would surface as a
// `driver: could not locate <root>.<namespace>.<method>(…)` failure even
// though the call is present in the output. The scanner must therefore
// tolerate whitespace and newlines between every segment.
//
// 1. Compile a project whose source writes `plugin.namespace\n.method()`.
// 2. Register a rewrite with the matching root/namespace/method descriptor.
// 3. Assert the emit succeeds and the replacement actually lands in the JS.
//
// @evidence contracts/testing.md#behavioral-verification EmitAll succeeds and produces the complete exports.value replaced statement for plugin.namespace followed by a line-broken method segment.
// @evidence contracts/testing.md#independent-expectations The authored namespace/method descriptor identifies one whole call regardless of allowed whitespace; the literal assignment detects incomplete splicing.
// @evidence contracts/testing.md#distinguishing-cases A default-import namespaced call with an intermediate newline owns member-chain whitespace handling; malformed or absent calls have separate cases.
// @evidence contracts/testing.md#execution-ownership Go test/driver directly loads a Program and captures rewritten JavaScript through its callback without a product host or Node runtime.
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
  writeProjectFile(t, root, "plugin.ts", `export default {
  namespace: {
    method(): number { return 1; }
  }
};
`)
  writeProjectFile(t, root, "index.ts", `import plugin from "./plugin";

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
  _, emitDiags, err := prog.EmitAll(rewrites, func(fileName shimtspath.RootedFilePath, text string, _ *shimcompiler.WriteFileData) error {
    emitted[filepath.Base(fileName.AsString())] = text
    return nil
  })
  if err != nil {
    t.Fatalf("emit returned an error (rewriter rejected line-broken member chain): %v", err)
  }
  if len(emitDiags) != 0 {
    t.Fatalf("unexpected emit diagnostics: %#v", emitDiags)
  }
  js := emitted["index.js"]
  if !strings.Contains(js, `exports.value = "replaced";`) {
    t.Fatalf("namespace.method rewrite not applied to the whole call:\n%s", js)
  }
}

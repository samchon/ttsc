package driver_test

import (
  "path/filepath"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimprinter "github.com/microsoft/typescript-go/shim/printer"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestEmitWithPluginTransformerHonorsRemoveComments locks removeComments on the
// AST plugin-transform emit path (the seam typia integrates through).
//
// EmitWithPluginTransformers hand-assembles printing via PrintFileWithSourceMap.
// That helper historically forwarded SourceMap / InlineSourceMap / InlineSources
// into PrinterOptions but omitted RemoveComments, so `removeComments: true` in
// tsconfig was silently ignored whenever a plugin transform ran — comments
// survived in the emitted JS even though a plain (no-plugin) emit stripped them.
// Pairing removeComments with sourceMap is the common production shape that
// exposed the miss: both options are consulted in the same PrinterOptions
// construction.
//
//  1. Compile a project with removeComments + sourceMap whose source carries a
//     distinctive line comment.
//  2. Emit through EmitWithPluginTransformer (identity transform is enough to
//     take the plugin path).
//  3. Assert the authored comment is absent from the JS while the
//     sourceMappingURL trailer (written as a printer comment after print) remains.
func TestEmitWithPluginTransformerHonorsRemoveComments(t *testing.T) {
  const marker = "TTSC_REMOVE_COMMENTS_MARKER"
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "outDir": "bin",
    "sourceMap": true,
    "removeComments": true,
    "strict": true
  },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", "// "+marker+"\nexport const a = 0;\n")
  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  defer prog.Close()

  transform := func(ec *shimprinter.EmitContext, sf *shimast.SourceFile) *shimast.SourceFile {
    return sf
  }

  emitted := map[string]string{}
  if _, err := prog.EmitWithPluginTransformer(transform, func(fileName, text string, _ *shimcompiler.WriteFileData) error {
    emitted[filepath.Base(fileName)] = text
    return nil
  }); err != nil {
    t.Fatal(err)
  }

  js := emitted["index.js"]
  if js == "" {
    t.Fatalf("index.js was not emitted: %#v keys", keysOf(emitted))
  }
  if strings.Contains(js, marker) {
    t.Fatalf("removeComments was ignored on the plugin-transform emit path; marker still present:\n%s", js)
  }
  if !strings.Contains(js, "//# sourceMappingURL=index.js.map") {
    t.Fatalf("index.js missing sourceMappingURL trailer (source maps must still emit):\n%s", js)
  }
  if emitted["index.js.map"] == "" {
    t.Fatalf("index.js.map was not emitted; only got %v", keysOf(emitted))
  }
}

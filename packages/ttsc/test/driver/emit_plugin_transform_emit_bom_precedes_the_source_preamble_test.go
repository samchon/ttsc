package driver_test

import (
  "encoding/base64"
  "encoding/json"
  "path/filepath"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimprinter "github.com/microsoft/typescript-go/shim/printer"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// preambleHashbangSource is a hashbang file, the shape whose first bytes are
// already contested before `emitBOM` adds to them: ApplySourcePreamble inserts
// the preamble AFTER the `#!` line so the shebang stays executable, and the
// printer re-emits that shebang first.
const preambleHashbangSource = "#!/usr/bin/env node\nexport const a = 0;\nexport const b = 1;\n"

const preambleHashbangLine = "#!/usr/bin/env node"

// TestEmitPluginTransformEmitBOMPrecedesTheSourcePreamble verifies that the
// plugin-transform emit lane's `emitBOM` mark stays the emitted file's first
// bytes when a source-level preamble and a hashbang also compete for the front
// of the output.
//
// `emitBOM` is applied by `printSourceFile` to the finished text, after
// everything the printer wrote — so a lane that instead prepended the mark
// somewhere inside its own assembly, or applied it before the preamble-shift
// correction rewrote the text, could easily leave it second. The three
// producers of leading bytes are independent here (the byte order mark from the
// compiler option, the shebang from the printer, the preamble comment from a
// linked SourcePreamblePlugin). Their observed order checks the finished output;
// it does not independently prove the internal order of assembly operations.
//
//  1. Register a SourcePreamblePlugin and compile a hashbang fixture through
//     EmitWithPluginTransformer with an identity transform, once with `emitBOM`
//     and once without it.
//  2. With `emitBOM`, assert the mark is the first bytes and the shebang
//     immediately follows it, with the injected preamble still in the output.
//  3. Without it, assert the same file starts with the shebang and carries no
//     mark anywhere (the negative twin).
//  4. Repeat the positive case with `inlineSourceMap`, where the preamble-shift
//     correction rewrites the emitted text after the mark was applied.
// @evidence contracts/testing.md#behavioral-verification Runs actual linked-preamble and identity-transform emission for three option rows, requiring BOM/hashbang ordering or BOM absence, retained preamble, and valid inline base64/JSON map.
// @evidence contracts/testing.md#independent-expectations Literal UTF8 BOM, hashbang leader and preamble marker independently define byte positions; standard decoders independently inspect inline map encoding.
// @evidence contracts/testing.md#distinguishing-cases BOM enabled/disabled and inline-map correction distinguish ordering and trailer-splice interactions with the real injected preamble.
// @evidence contracts/testing.md#execution-ownership Named owning Go driver unit rows call actual registered-plugin/compiler operations, each with private Program cleanup and captured writes; no script execution or compiled host.
func TestEmitPluginTransformEmitBOMPrecedesTheSourcePreamble(t *testing.T) {
  t.Run("emit_bom_marks_the_file_ahead_of_the_shebang", func(t *testing.T) {
    js := emitHashbangWithPreamble(t, `"emitBOM": true`)
    if !strings.HasPrefix(js, utf8BOM) {
      t.Fatalf("emitted JavaScript does not begin with the byte order mark:\n%q", js)
    }
    if !strings.HasPrefix(js[len(utf8BOM):], preambleHashbangLine) {
      t.Fatalf("the byte order mark is not immediately followed by the shebang:\n%q", js)
    }
    if strings.Count(js, utf8BOM) != 1 {
      t.Fatalf("the byte order mark appears %d times; it belongs only at the front:\n%q", strings.Count(js, utf8BOM), js)
    }
    if !strings.Contains(js, "preamble 1") {
      t.Fatalf("the injected source preamble is missing, so this case does not exercise the interaction it names:\n%q", js)
    }
  })

  t.Run("no_emit_bom_leaves_the_shebang_first", func(t *testing.T) {
    js := emitHashbangWithPreamble(t, `"emitBOM": false`)
    if strings.Contains(js, utf8BOM) {
      t.Fatalf("emitted JavaScript carries a byte order mark without emitBOM:\n%q", js)
    }
    if !strings.HasPrefix(js, preambleHashbangLine) {
      t.Fatalf("emitted JavaScript does not begin with the shebang:\n%q", js)
    }
    if !strings.Contains(js, "preamble 1") {
      t.Fatalf("the injected source preamble is missing, so this case does not exercise the interaction it names:\n%q", js)
    }
  })

  t.Run("emit_bom_survives_the_inline_map_preamble_correction", func(t *testing.T) {
    // With a preamble AND an inline map, EmitWithPluginTransformers rewrites the
    // emitted text after PrintFileWithSourceMap returned it, re-encoding the
    // base64 trailer to undo the preamble's line shift. The mark is already at
    // the front by then, and splicing the trailer must leave it there.
    js := emitHashbangWithPreamble(t, `"emitBOM": true, "inlineSourceMap": true`)
    if !strings.HasPrefix(js, utf8BOM) {
      t.Fatalf("emitted JavaScript does not begin with the byte order mark after the inline map was corrected:\n%q", js)
    }
    if !strings.HasPrefix(js[len(utf8BOM):], preambleHashbangLine) {
      t.Fatalf("the byte order mark is not immediately followed by the shebang:\n%q", js)
    }
    if !strings.Contains(js, inlineSourceMapTrailer) {
      t.Fatalf("the inline source map trailer is missing, so this case does not exercise the correction it names:\n%q", js)
    }
    assertInlineSourceMapDecodes(t, js)
  })
}

// inlineSourceMapTrailer is the comment plus data-URL prefix an
// `inlineSourceMap` build writes before the base64 map.
const inlineSourceMapTrailer = "//# sourceMappingURL=data:application/json;base64,"

// assertInlineSourceMapDecodes checks that the base64 payload after the inline
// trailer is still a decodable source map. The preamble correction splices a
// re-encoded payload into text the byte order mark already prefixes, and a
// splice computed against the wrong offsets would leave a payload that decodes
// to garbage rather than one that is merely shifted.
func assertInlineSourceMapDecodes(t *testing.T, js string) {
  t.Helper()
  start := strings.LastIndex(js, inlineSourceMapTrailer) + len(inlineSourceMapTrailer)
  end := start
  for end < len(js) && js[end] != '\n' && js[end] != '\r' {
    end++
  }
  raw, err := base64.StdEncoding.DecodeString(js[start:end])
  if err != nil {
    t.Fatalf("the inline source map payload is not decodable base64: %v\n%q", err, js[start:end])
  }
  var parsed struct {
    Mappings string `json:"mappings"`
  }
  if err := json.Unmarshal(raw, &parsed); err != nil {
    t.Fatalf("the inline source map payload is not valid JSON: %v\n%s", err, raw)
  }
  if parsed.Mappings == "" {
    t.Fatalf("the inline source map carries no mappings:\n%s", raw)
  }
}

// emitHashbangWithPreamble compiles the hashbang fixture with a linked
// SourcePreamblePlugin and the given extra compiler options, emitting through
// the hand-assembled plugin-transform lane, and returns the emitted JavaScript.
func emitHashbangWithPreamble(t *testing.T, options string) string {
  t.Helper()
  resetLinkedPluginRegistry()
  driver.RegisterPlugin(preambleEmitPlugin{})
  t.Setenv(driver.LinkedPluginsEnv, `[{"name":"preamble","stage":"transform","config":{}}]`)

  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "outDir": "bin",
    "strict": true,
    `+options+`
  },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", preambleHashbangSource)
  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  defer prog.Close()
  if prog.SourcePreamble == "" {
    t.Fatal("source preamble was not applied to the program")
  }

  identity := func(_ *shimprinter.EmitContext, sf *shimast.SourceFile) *shimast.SourceFile {
    return sf
  }
  emitted := map[string]string{}
  if _, err := prog.EmitWithPluginTransformer(identity, func(fileName, text string, _ *shimcompiler.WriteFileData) error {
    emitted[filepath.Base(fileName)] = text
    return nil
  }); err != nil {
    t.Fatal(err)
  }
  js, ok := emitted["index.js"]
  if !ok {
    t.Fatalf("index.js was not emitted; got %v", sortedKeys(emitted))
  }
  return js
}

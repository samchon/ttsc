package driver_test

import (
  "encoding/json"
  "path/filepath"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimprinter "github.com/microsoft/typescript-go/shim/printer"
  shimtspath "github.com/microsoft/typescript-go/shim/tspath"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// preambleEmitPlugin injects a fixed four-line source preamble, modelling
// @ttsc/banner linked into an executable-transform (e.g. typia) host.
type preambleEmitPlugin struct{}

func (preambleEmitPlugin) SourcePreamble(driver.PluginContext) (string, error) {
  return "// preamble 1\n// preamble 2\n// preamble 3\n// preamble 4\n", nil
}

// TestEmitWithPluginTransformerCorrectsPreambleShift verifies that the
// plugin-transform emit path corrects a source map shifted by a source-level
// preamble — the typia + @ttsc/banner combination.
//
// The utility host's WriteFile (tsgo native emit) corrects the preamble shift,
// but an executable-transform host emits through EmitWithPluginTransformer (a
// wrapper over EmitWithPluginTransformers) instead, where a linked banner's
// preamble would still shift the map. That emit corrects the map for the
// preamble too; the authored-source coordinates otherwise retain that shift.
//
//  1. Register a SourcePreamblePlugin and load a `sourceMap` project, so the
//     source is preamble-shifted by four lines and prog.SourcePreamble is set.
//  2. Emit through EmitWithPluginTransformer with an identity transform.
//  3. Decode source-bearing `.js.map` segments and require their source lines
//     in {0, 1} (not the shifted {4, 5}) and both authored lines represented.
//     The test decoder ignores generated-column-only segments.
//
// @evidence contracts/testing.md#behavioral-verification Registers a real preamble plugin and emits through the actual identity-transform route, decoding source-map JSON/VLQ and requiring mappings to both authored zero/one lines and no shifted lines.
// @evidence contracts/testing.md#independent-expectations Literal two authored lines and four injected lines independently establish permitted original mapping coordinates; test-local decoding does not call production map correction.
// @evidence contracts/testing.md#distinguishing-cases Applied preamble presence plus nonempty mappings and both source-line controls prevent vacuous success from absent preamble or map output.
// @evidence contracts/testing.md#execution-ownership The owning Go driver unit executes actual registered plugin/compiler/emitter APIs with test-scoped manifest, private Program cleanup and local writes, without building a transform host.
func TestEmitWithPluginTransformerCorrectsPreambleShift(t *testing.T) {
  resetLinkedPluginRegistry()
  driver.RegisterPlugin(preambleEmitPlugin{})
  t.Setenv(driver.LinkedPluginsEnv, `[{"name":"preamble","stage":"transform","config":{}}]`)

  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "outDir": "bin",
    "sourceMap": true,
    "strict": true
  },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", "export const a = 0;\nexport const b = 1;\n")
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
  if _, err := prog.EmitWithPluginTransformer(identity, func(fileName shimtspath.RootedFilePath, text string, _ *shimcompiler.WriteFileData) error {
    emitted[filepath.Base(fileName.AsString())] = text
    return nil
  }); err != nil {
    t.Fatal(err)
  }

  mapText := emitted["index.js.map"]
  if mapText == "" {
    t.Fatalf("index.js.map was not emitted; got %v", keysOf(emitted))
  }
  var parsed struct {
    Mappings string `json:"mappings"`
  }
  if err := json.Unmarshal([]byte(mapText), &parsed); err != nil {
    t.Fatalf("index.js.map is not valid JSON: %v", err)
  }
  segments := parseMappings(parsed.Mappings)
  if len(segments) == 0 {
    t.Fatalf("decoded no mappings from %q", parsed.Mappings)
  }
  seen := map[int]bool{}
  for _, s := range segments {
    if s.srcLine < 0 || s.srcLine > 1 {
      t.Fatalf("mapping points at source line %d; the 4-line preamble shift was not corrected (authored lines are 0-1)", s.srcLine)
    }
    seen[s.srcLine] = true
  }
  if !seen[0] || !seen[1] {
    t.Fatalf("expected mappings to both authored lines 0 and 1, got set %v", seen)
  }
}

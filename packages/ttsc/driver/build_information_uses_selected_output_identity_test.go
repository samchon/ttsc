package driver

import (
  "encoding/json"
  "os"
  "path/filepath"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimprinter "github.com/microsoft/typescript-go/shim/printer"
  shimtspath "github.com/microsoft/typescript-go/shim/tspath"
)

// TestBuildInformationUsesSelectedOutputIdentity Verifies incremental metadata
// retains its compiler-selected identity across containment and map correction.
//
// File extensions do not define artifact kinds: selected state may end in .map
// or .js, while an unrelated .tsbuildinfo outside the output boundary is not
// metadata. All three emit lanes must retain the same compiler-selected state.
//
// 1. Load explicit, inferred, nonincremental, noEmit and semantic-error projects.
// 2. Check selected state and unrelated suffix paths against containment and correction.
// 3. Emit through raw, rewritten and plugin lanes and assert exact state/JS outputs.
//
// @evidence contracts/testing.md#behavioral-verification Actual loaded Programs exercise outputEscapesOutDir, NewSourceMapCorrector and all three whole-program emit lanes; selected state is versioned JSON at its exact authored key and survives map correction without text changes, while unrelated outside suffix paths remain contained.
// @evidence contracts/testing.md#independent-expectations Authored cache filenames and the pinned native inferred config-root state contract establish literal expected keys. Incremental/composite owns state eligibility independently of filename extension; noEmit forbids JavaScript, while disabled noEmitOnError permits partial output with an independently asserted TS2322.
// @evidence contracts/testing.md#distinguishing-cases Contrasts .tsbuildinfo, .map, .js and extensionless selected state, default inference above outDir, a selected-looking nonincremental path, noEmit state-only output and semantic-error partial output. Adjacent unrelated .tsbuildinfo/.map names must not escape containment. All lanes share the same unchanged input generation and record their own writes.
// @evidence contracts/testing.md#execution-ownership Go discovers this driver unit directly. Each case loads one owned temporary project and runs actual compiler/emitter operations in process; deferred Close releases its Program and no consumer, executable or native host is built.
func TestBuildInformationUsesSelectedOutputIdentity(t *testing.T) {
  for _, c := range []struct {
    name        string
    state       string
    incremental bool
    noEmit      bool
    bad         bool
  }{
    {name: "standard", state: "cache/state.tsbuildinfo", incremental: true},
    {name: "map", state: "cache/state.map", incremental: true},
    {name: "javascript", state: "cache/state.js", incremental: true},
    {name: "extensionless", state: "cache/state", incremental: true},
    {name: "inferred", incremental: true},
    {name: "nonincremental", state: "cache/state.tsbuildinfo"},
    {name: "noEmit", state: "cache/state.map", incremental: true, noEmit: true},
    {name: "partialError", state: "cache/state.map", incremental: true, bad: true},
  } {
    t.Run(c.name, func(t *testing.T) {
      root := t.TempDir()
      options := map[string]any{"target": "es2020", "module": "commonjs", "rootDir": "src", "outDir": "dist", "sourceMap": true, "incremental": c.incremental, "noEmit": c.noEmit, "noEmitOnError": false}
      if c.state != "" {
        options["tsBuildInfoFile"] = c.state
      }
      config, err := json.Marshal(map[string]any{"compilerOptions": options, "files": []string{"src/input.ts"}})
      if err != nil {
        t.Fatal(err)
      }
      if err = os.MkdirAll(filepath.Join(root, "src"), 0700); err != nil {
        t.Fatal(err)
      }
      if err = os.WriteFile(filepath.Join(root, "tsconfig.json"), config, 0600); err != nil {
        t.Fatal(err)
      }
      source := "export const value: number = 1;\n"
      if c.bad {
        source = "export const value: number = 'wrong';\n"
      }
      if err = os.WriteFile(filepath.Join(root, "src/input.ts"), []byte(source), 0600); err != nil {
        t.Fatal(err)
      }
      p, diagnostics, err := LoadProgram(root, "tsconfig.json", LoadProgramOptions{SourcePreamble: "// source preamble\n"})
      if err != nil || len(diagnostics) != 0 {
        t.Fatalf("load: %v %v", err, diagnostics)
      }
      defer p.Close()
      state := c.state
      if state == "" {
        state = "tsconfig.tsbuildinfo"
      }
      expected := filepath.ToSlash(filepath.Join(root, state))
      if escaped := p.outputEscapesOutDir(shimtspath.RootedFilePathFromAbsolute(expected)); escaped == c.incremental {
        t.Errorf("selected state containment: escaped=%v incremental=%v", escaped, c.incremental)
      }
      for _, decoy := range []string{"cache/unrelated.tsbuildinfo", "cache/unrelated.map"} {
        if !p.outputEscapesOutDir(shimtspath.RootedFilePathFromAbsolute(filepath.ToSlash(filepath.Join(root, decoy)))) {
          t.Errorf("unselected output escaped containment: %s", decoy)
        }
      }
      if c.incremental {
        original := `{"version":"unchanged-state","fileNames":["../src/input.ts"]}`
        corrected, correctionErr := p.NewSourceMapCorrector()(expected, original)
        if correctionErr != nil || corrected != original {
          t.Errorf("selected state correction: %q %v", corrected, correctionErr)
        }
      }
      if c.bad {
        sawTypeError := false
        for _, diagnostic := range p.Diagnostics() {
          if diagnostic.Code == 2322 {
            sawTypeError = true
          }
        }
        if !sawTypeError {
          t.Error("authored semantic error did not produce TS2322")
        }
      }
      for _, lane := range []string{"raw", "rewrite", "plugin"} {
        t.Run(lane, func(t *testing.T) {
          writes := map[string]string{}
          writer := func(file shimtspath.RootedFilePath, text string, _ *shimcompiler.WriteFileData) error {
            writes[filepath.ToSlash(file.AsString())] = text
            return nil
          }
          var emitted []Diagnostic
          var emitErr error
          switch lane {
          case "raw":
            _, emitted, emitErr = p.EmitAllRaw(writer)
          case "rewrite":
            _, emitted, emitErr = p.EmitAll(NewRewriteSet(), writer)
          case "plugin":
            emitted, emitErr = p.EmitWithPluginTransformer(func(_ *shimprinter.EmitContext, source *shimast.SourceFile) *shimast.SourceFile { return source }, writer)
          }
          if emitErr != nil || len(emitted) != 0 {
            t.Errorf("emit: %v %v", emitErr, emitted)
          }
          text, found := writes[expected]
          if found != c.incremental {
            t.Errorf("selected state presence=%v incremental=%v writes=%v", found, c.incremental, writes)
          }
          if found {
            var document struct {
              Version string `json:"version"`
            }
            if err := json.Unmarshal([]byte(text), &document); err != nil || document.Version == "" {
              t.Errorf("state is not versioned JSON: %v %s", err, text)
            }
          }
          javascript := filepath.ToSlash(filepath.Join(root, "dist/input.js"))
          if (writes[javascript] != "") == c.noEmit {
            t.Errorf("JavaScript presence contradicts noEmit=%v: %v", c.noEmit, writes)
          }
          if c.noEmit && len(writes) != 1 {
            t.Errorf("noEmit must retain only state, got %v", writes)
          }
        })
      }
    })
  }
}

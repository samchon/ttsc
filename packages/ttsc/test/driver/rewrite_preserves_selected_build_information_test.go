package driver_test

import (
  "encoding/json"
  "fmt"
  "os"
  "path/filepath"
  "strings"
  "testing"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverRewritePreservesSelectedBuildInformation Verifies compiler-selected
// state never acquires executable-call authority from its filename extension.
//
// The state artifact deliberately shares the registered source's stem. With
// noEmit it is the only output, so no prior JavaScript write can exhaust the
// registration cursor and hide incorrect metadata admission. Emitting cases
// independently require the actual call replacement alongside unchanged state.
//
// 1. Load each authored state filename with and without JavaScript emission.
// 2. Capture raw and rewritten output from the same immutable Program.
// 3. Require exact state bytes, versioned JSON and the independently expected JS policy.
// 4. Fail the state writer and require its actual error as an emit diagnostic.
//
// @evidence contracts/testing.md#behavioral-verification Actual LoadProgram and EmitAll preserve selected build information byte-for-byte against raw output, decode its version and rewrite the registered live call when emission is enabled. Metadata-only emission still invokes the writer and reports its failure as an emit diagnostic.
// @evidence contracts/testing.md#independent-expectations Authored cache/input filenames name the exact state artifact independently of source association. Incremental noEmit requires only state; enabled emission requires the supplied selected-state-replaced value and canonical marker in dist/input.js. Raw metadata bytes are the independent compiler-output preservation oracle.
// @evidence contracts/testing.md#distinguishing-cases Four JavaScript-looking extensions contrast with standard, map and extensionless metadata, each sharing the registered source stem. Metadata-only and ordinary emission distinguish an active cursor from one already consumed by a JavaScript write; a failing metadata writer distinguishes preservation from silently skipping the artifact.
// @evidence contracts/testing.md#execution-ownership This direct driver Go unit loads and closes one immutable temporary Program per named case and invokes raw/rewritten emission in process. It builds no host, installs no consumer and starts no independent executable.
func TestDriverRewritePreservesSelectedBuildInformation(t *testing.T) {
  for _, extension := range []string{".js", ".jsx", ".mjs", ".cjs", ".tsbuildinfo", ".map", ""} {
    for _, noEmit := range []bool{false, true} {
      name := extension
      if name == "" {
        name = "extensionless"
      }
      t.Run(fmt.Sprintf("%s/noEmit=%t", name, noEmit), func(t *testing.T) {
        root := t.TempDir()
        state := filepath.Join(root, "cache", "input"+extension)
        javascript := filepath.Join(root, "dist", "input.js")
        config, err := json.Marshal(map[string]any{
          "compilerOptions": map[string]any{
            "module": "commonjs", "target": "es2020", "strict": true,
            "rootDir": "src", "outDir": "dist", "incremental": true,
            "tsBuildInfoFile": "cache/input"+extension, "noEmit": noEmit,
          },
          "files": []string{"src/input.ts"},
        })
        if err != nil {
          t.Fatal(err)
        }
        writeProjectFile(t, root, "tsconfig.json", string(config))
        writeProjectFile(t, root, "src/input.ts", `const plugin = { make(): string { return "original"; } };
export const value = plugin.make();
`)
        program, diagnostics, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
        if err != nil || program == nil || len(diagnostics) != 0 {
          t.Fatalf("load: diagnostics=%#v err=%v", diagnostics, err)
        }
        defer program.Close()
        source := program.SourceFile(filepath.Join(root, "src", "input.ts"))
        if source == nil {
          t.Fatal("missing source file")
        }
        rewrites := driver.NewRewriteSet()
        rewrites.Add(driver.Rewrite{File: source, RootName: "plugin", Method: "make", Replacement: `"selected-state-replaced"`, ConsumeParens: true})
        capture := func(outputs map[string]string) shimcompiler.WriteFile {
          return func(file, text string, _ *shimcompiler.WriteFileData) error {
            outputs[filepath.Clean(file)] = text
            return nil
          }
        }
        raw := map[string]string{}
        _, diagnostics, err = program.EmitAllRaw(capture(raw))
        if err != nil || len(diagnostics) != 0 {
          t.Errorf("raw: diagnostics=%#v err=%v", diagnostics, err)
        }
        output := map[string]string{}
        _, diagnostics, err = program.EmitAll(rewrites, capture(output))
        if err != nil || len(diagnostics) != 0 {
          t.Errorf("rewrite: diagnostics=%#v err=%v", diagnostics, err)
        }
        var document struct { Version string `json:"version"` }
        if jsonErr := json.Unmarshal([]byte(raw[state]), &document); jsonErr != nil || document.Version == "" {
          t.Errorf("raw selected state is not versioned JSON: %v %q", jsonErr, raw[state])
        }
        if output[state] == "" || output[state] != raw[state] {
          t.Errorf("selected state changed or omitted: raw=%q rewritten=%q", raw[state], output[state])
        }
        if noEmit {
          if len(output) != 1 || output[javascript] != "" {
            t.Errorf("noEmit must write only selected state: %v", sortedStringKeys(output))
          }
          _, diagnostics, err = program.EmitAll(rewrites, func(file, _ string, _ *shimcompiler.WriteFileData) error {
            if filepath.Clean(file) != state {
              t.Errorf("unexpected metadata-only write: %s", file)
            }
            return os.ErrPermission
          })
          sawWriterFailure := false
          for _, diagnostic := range diagnostics {
            if strings.Contains(diagnostic.Message, os.ErrPermission.Error()) {
              sawWriterFailure = true
            }
          }
          if err != nil || !sawWriterFailure {
            t.Errorf("metadata writer failure was not reported: diagnostics=%#v err=%v", diagnostics, err)
          }
        } else if !strings.HasPrefix(output[javascript], "\"use strict\";\n"+driver.RewriteSentinel+"\n") || !strings.Contains(output[javascript], `"selected-state-replaced"`) || strings.Contains(output[javascript], "plugin.make()") {
          t.Errorf("live JavaScript rewrite missing: %s", output[javascript])
        }
      })
    }
  }
}

package driver_test

import (
  "encoding/json"
  "fmt"
  "os"
  "path/filepath"
  "testing"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestRuntimeJsxProfiles emits four distinct effective JSX configurations.
// Authored package inputs are shared once; equivalent preserved and already
// executable policy requests consume the same canonical compiler output.
//
// @evidence contracts/testing.md#behavioral-verification Actual LoadProgram, complete program diagnostics and EmitAllRaw produce executable CommonJS view output at the four distinct effective JSX configurations. The Node VM owner consumes the exact emitted artifacts and evaluates the authored runtime rather than substituting rendered strings.
// @evidence contracts/testing.md#independent-expectations The authored component contains a div hello followed by b world inside a fragment. Its independent literal HTML expectation belongs to the Node VM owner; this Go owner requires actual nonempty emitted output and zero native diagnostics, not a generated expected artifact.
// @evidence contracts/testing.md#distinguishing-cases Classic factory/fragment, development automatic runtime, namespace classic and automatic import-source have separate effective programs. Preserved classic and already-react inputs share identical effective work; factory or namespace beside import-source both clear irrelevant declarations in the exact runtime argument units and share automatic emission. The response-file root consumer remains a real E2E transport owner.
// @evidence contracts/testing.md#execution-ownership One named Go unit in the physical driver-unit package creates one temporary fixture workspace and loads four genuinely distinct compiler programs in the same existing unit test process. No product or contributor native binary, consumer installation or product host is built or launched. Programs close in each subtest, all outputs flow only through memory stdout records, and the VM unit requires the exact population.
func TestRuntimeJsxProfiles(t *testing.T) {
  bytes, err := os.ReadFile(filepath.Join("..", "..", "..", "..", "tests", "test-ttsc", "src", "internal", "runtime-jsx-fixture.json"))
  if err != nil { t.Fatal(err) }
  var fixture struct { Files map[string]string `json:"files"`; Source string `json:"source"` }
  if err := json.Unmarshal(bytes, &fixture); err != nil { t.Fatal(err) }
  if len(fixture.Files) == 0 || fixture.Source == "" { t.Fatal("empty authored JSX fixture") }
  root := t.TempDir()
  write := func(name, text string) {
    t.Helper()
    file := filepath.Join(root, filepath.FromSlash(name))
    if err := os.MkdirAll(filepath.Dir(file), 0o755); err != nil { t.Fatal(err) }
    if err := os.WriteFile(file, []byte(text), 0o644); err != nil { t.Fatal(err) }
  }
  for name, text := range fixture.Files { write(name, text) }
  for _, profile := range []struct { name string; options map[string]any; prefix string; global bool }{
    {"classic", map[string]any{"jsx": "react", "jsxFactory": "h", "jsxFragmentFactory": "Fragment"}, "import { Fragment, h } from \"myjsx\";\nvoid h; void Fragment;\n", true},
    {"development", map[string]any{"jsx": "react-jsxdev", "jsxImportSource": "myjsx"}, "", false},
    {"namespace", map[string]any{"jsx": "react", "reactNamespace": "R"}, "import * as R from \"myjsx\";\nvoid R;\n", true},
    {"automatic", map[string]any{"jsx": "react-jsx", "jsxImportSource": "myjsx"}, "", false},
  } {
    t.Run(profile.name, func(t *testing.T) {
      options := map[string]any{"target": "ES2022", "module": "commonjs", "strict": true, "types": []string{}, "outDir": "dist"}
      for name, value := range profile.options { options[name] = value }
      files := []string{"view.tsx"}
      directory := "profiles/" + profile.name + "/"
      write(directory + "view.tsx", profile.prefix + fixture.Source)
      if profile.global {
        write(directory + "jsx.d.ts", "declare namespace JSX { type Element = string; interface IntrinsicElements { [name: string]: { children?: unknown } } }\n")
        files = append(files, "jsx.d.ts")
      }
      config, err := json.Marshal(map[string]any{"compilerOptions": options, "files": files})
      if err != nil { t.Fatal(err) }
      write(directory + "tsconfig.json", string(config))
      program, diagnostics, err := driver.LoadProgram(root, directory + "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true, TsgoArgs: []string{}})
      if err != nil { t.Fatal(err) }
      if len(diagnostics) != 0 { t.Fatalf("configuration diagnostics: %#v", diagnostics) }
      defer program.Close()
      if diagnostics := program.Diagnostics(); len(diagnostics) != 0 { t.Fatalf("program diagnostics: %#v", diagnostics) }
      var output string
      _, diagnostics, err = program.EmitAllRaw(func(name, text string, _ *shimcompiler.WriteFileData) error {
        if filepath.Base(name) == "view.js" { output = text }
        return nil
      })
      if err != nil { t.Fatal(err) }
      if len(diagnostics) != 0 { t.Fatalf("emit diagnostics: %#v", diagnostics) }
      if output == "" { t.Fatal("view.js was not emitted") }
      record, err := json.Marshal(map[string]string{"name": profile.name, "javascript": output})
      if err != nil { t.Fatal(err) }
      fmt.Printf("TTSC_JSX_EMIT_V1:%s\n", record)
    })
  }
}

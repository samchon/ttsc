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

// TestRuntimeJsxProfiles emits four distinct effective JSX configurations.
// Authored package inputs are shared once; each profile is compiled in its own
// subdirectory and its emitted view.js is checked for the JSX runtime form that
// TypeScript's jsx modes define, then printed as a TTSC_JSX_EMIT_V1 record.
//
// @evidence contracts/testing.md#behavioral-verification Each subtest runs LoadProgram, complete Program diagnostics and EmitAllRaw over one authored view.tsx and requires zero configuration, program and emit diagnostics plus nonempty view.js. The emitted text must then call the factory its jsx mode selects: classic calls the jsxFactory h with the Fragment factory, react-jsxdev calls jsxDEV from myjsx/jsx-dev-runtime, reactNamespace R calls R.createElement, and react-jsx calls jsx and jsxs from myjsx/jsx-runtime. The emitted text is not executed here; each record is also printed for a Node VM consumer file, tests/test-ttsc/src/features/runtime/test_runtime_compiler_output_renders_jsx_profiles.cjs, whose runner is not part of this test.
// @evidence contracts/testing.md#independent-expectations The expected call forms follow from the documented meaning of the TypeScript jsx, jsxFactory, jsxFragmentFactory, reactNamespace and jsxImportSource options, not from a captured emit: classic output names the configured factory, development output names the development runtime entry, and automatic output names the production runtime entry. Each profile also lists tokens that belong to a different mode and must be absent. The rendered HTML expectation lives in the Node VM consumer, not in this Go test.
// @evidence contracts/testing.md#distinguishing-cases Four profiles differ in jsx mode or its option: factory classic, react-jsxdev with import source, namespace classic, and react-jsx with import source. A required token proves the intended mode ran and a forbidden token proves a neighbouring mode did not, so a build that ignored the jsx option or applied one mode to every profile fails at least one subtest. The preserved and already-react request variants and the response-file root consumer are not exercised by this Go test.
// @evidence contracts/testing.md#execution-ownership One named Go unit in the physical driver-unit package writes one temporary workspace and loads four distinct compiler programs in the existing unit test process through driver.LoadProgram. It builds or launches no product binary, consumer installation or host and runs no Node process; each Program is closed by its subtest and the temporary directory is owned by t.TempDir.
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
  for _, profile := range []struct { name string; options map[string]any; prefix string; global bool; want, absent []string }{
    {"classic", map[string]any{"jsx": "react", "jsxFactory": "h", "jsxFragmentFactory": "Fragment"}, "import { Fragment, h } from \"myjsx\";\nvoid h; void Fragment;\n", true,
      []string{"myjsx_1.h)(", "myjsx_1.Fragment", `"div"`, `"b"`}, []string{"jsx-runtime", "jsxDEV", "createElement"}},
    {"development", map[string]any{"jsx": "react-jsxdev", "jsxImportSource": "myjsx"}, "", false,
      []string{`require("myjsx/jsx-dev-runtime")`, ".jsxDEV)("}, []string{`myjsx/jsx-runtime"`, "createElement", ".h)("}},
    {"namespace", map[string]any{"jsx": "react", "reactNamespace": "R"}, "import * as R from \"myjsx\";\nvoid R;\n", true,
      []string{"R.createElement(R.Fragment", `R.createElement("div"`}, []string{"jsx-runtime", "jsxDEV", ".h)("}},
    {"automatic", map[string]any{"jsx": "react-jsx", "jsxImportSource": "myjsx"}, "", false,
      []string{`require("myjsx/jsx-runtime")`, ".jsxs)(", `.jsx)("div"`}, []string{"jsxDEV", "createElement", ".h)("}},
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
      for _, token := range profile.want {
        if !strings.Contains(output, token) { t.Fatalf("%s output lacks %q:\n%s", profile.name, token, output) }
      }
      for _, token := range profile.absent {
        if strings.Contains(output, token) { t.Fatalf("%s output contains %q that belongs to another jsx mode:\n%s", profile.name, token, output) }
      }
      record, err := json.Marshal(map[string]string{"name": profile.name, "javascript": output})
      if err != nil { t.Fatal(err) }
      fmt.Printf("TTSC_JSX_EMIT_V1:%s\n", record)
    })
  }
}

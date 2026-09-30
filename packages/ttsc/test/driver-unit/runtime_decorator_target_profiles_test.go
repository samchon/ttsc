package driver_test

import (
  "encoding/json"
  "fmt"
  "path/filepath"
  "os"
  "strings"
  "testing"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestRuntimeDecoratorTargetProfiles observes actual compiler emit without a
// native executable or Node host. The same actual emitted JavaScript is handed to the Node unit runner in memory
// for portable execution effects; real runtime assembly stays in E2E consumers.
//
// @evidence contracts/testing.md#behavioral-verification LoadProgram parses each real fixture configuration and CLI overlay; EmitAllRaw must retain optional chaining at modern/default targets, lower it at ES2019, and select the standard or legacy decorator protocol.
// @evidence contracts/testing.md#independent-expectations Optional chaining belongs to ES2020 and later. The fixture's optional function must therefore retain ?. at default/ES2025 and lose it at ES2019. Standard decorators use __esDecorate while experimentalDecorators uses __decorate; emitted artifacts, rather than repository source arrangement, are inspected.
// @evidence contracts/testing.md#distinguishing-cases Default, ES2025, ES2019, CLI ES2019 overriding ESNext, CLI null clearing ESNext, and legacy ESNext are separate named subtests. The additional ES2025 member witness covers private field, auto-accessor and class/static/instance initializer ordering. Each requires a nonempty actual index.js, zero configuration/emit diagnostics and both positive and negative helper distinctions. The Node VM unit executes the same compiler output against authored replacement/method/legacy literals; real assembly and member initialization have an actual VM owner; native ESM assembly remains in the member boundary consumer.
// @evidence contracts/testing.md#execution-ownership This named Go test calls the owning driver library in process and creates only temporary compiler-input files; it does not install a consumer, build a native product artifact or launch a host. Each subtest closes its Program and owns its temporary directory. The physical driver-unit package is separate from native-host and race populations; its unit runner enrollment selects this package explicitly.
func TestRuntimeDecoratorTargetProfiles(t *testing.T) {
  fixtureBytes, err := os.ReadFile(filepath.Join("..", "..", "..", "..", "tests", "test-ttsc", "src", "internal", "runtime-decorator-fixture.json"))
  if err != nil { t.Fatal(err) }
  var fixture struct { Source string `json:"source"`; MemberSource string `json:"memberSource"` }
  if err := json.Unmarshal(fixtureBytes, &fixture); err != nil { t.Fatal(err) }
  if fixture.Source == "" { t.Fatal("empty authored decorator fixture") }
  cases := []struct {
    name string
    target string
    args []string
    legacy bool
    optional bool
    members bool
  }{
    {name: "default", optional: true},
    {name: "es2025", target: "ES2025", optional: true},
    {name: "es2019", target: "ES2019"},
    {name: "cli-es2019", target: "ESNext", args: []string{"-t", "es2019"}},
    {name: "cli-null", target: "ESNext", args: []string{"--target", "null"}, optional: true},
    {name: "legacy-esnext", target: "ESNext", legacy: true, optional: true},
    {name: "members", target: "ES2025", members: true},
  }
  for _, c := range cases {
    t.Run(c.name, func(t *testing.T) {
      root := t.TempDir()
      write := func(name, text string) {
        t.Helper()
        file := filepath.Join(root, filepath.FromSlash(name))
        if err := os.MkdirAll(filepath.Dir(file), 0o755); err != nil { t.Fatal(err) }
        if err := os.WriteFile(file, []byte(text), 0o644); err != nil { t.Fatal(err) }
      }
      options := map[string]any{"module": "commonjs", "outDir": "dist", "strict": true}
      if c.target != "" { options["target"] = c.target }
      if c.legacy { options["experimentalDecorators"] = true }
      config, err := json.Marshal(map[string]any{"compilerOptions": options, "files": []string{"index.ts"}})
      if err != nil { t.Fatal(err) }
      write("tsconfig.json", string(config))
      source := fixture.Source + `
export {};
function optional(value?: { answer: number }) { return value?.answer; }
console.log(optional.toString().includes("?."));
`
      if c.legacy { source = `function legacy(target: Function) { console.log(target.name); }
@legacy
class Foo {}
new Foo();
export {};
export function optional(value?: { answer: number }) { return value?.answer; }
` }
      if c.members { source = fixture.MemberSource + "\nexport {};" }
      write("index.ts", source)
      args := append([]string{}, c.args...)
      prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true, TsgoArgs: args})
      if err != nil { t.Fatal(err) }
      if len(diags) != 0 { t.Fatalf("unexpected configuration diagnostics: %#v", diags) }
      defer prog.Close()
      if diagnostics := prog.Diagnostics(); len(diagnostics) != 0 { t.Fatalf("unexpected program diagnostics: %#v", diagnostics) }
      var output string
      _, emitDiags, err := prog.EmitAllRaw(func(name, text string, _ *shimcompiler.WriteFileData) error {
        if filepath.Base(name) == "index.js" { output = text }
        return nil
      })
      if err != nil { t.Fatal(err) }
      if len(emitDiags) != 0 { t.Fatalf("unexpected emit diagnostics: %#v", emitDiags) }
      if output == "" { t.Fatal("index.js was not emitted") }
      record, err := json.Marshal(map[string]string{"name": c.name, "javascript": output})
      if err != nil { t.Fatal(err) }
      fmt.Printf("TTSC_RUNTIME_EMIT_V1:%s\n", record)
      if got := strings.Contains(output, "?.answer"); !c.members && got != c.optional {
        t.Fatalf("optional chaining: got %v, want %v\n%s", got, c.optional, output)
      }
      if got := strings.Contains(output, "__esDecorate"); got == c.legacy {
        t.Fatalf("standard decorator helper: got %v, legacy %v\n%s", got, c.legacy, output)
      }
      if got := strings.Contains(output, "__decorate"); got != c.legacy {
        t.Fatalf("legacy decorator helper: got %v, want %v\n%s", got, c.legacy, output)
      }
    })
  }
}

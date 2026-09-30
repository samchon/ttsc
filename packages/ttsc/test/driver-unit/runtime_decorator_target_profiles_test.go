package driver_test

import (
  "encoding/json"
  "path/filepath"
  "os"
  "strings"
  "testing"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestRuntimeDecoratorTargetProfiles observes actual compiler emit without a
// native executable or Node host. Runtime effect checks remain in the shared
// standard-decorator consumers; these profiles own syntax and option overlay.
//
// @evidence contracts/testing.md#behavioral-verification LoadProgram parses each real fixture configuration and CLI overlay; EmitAllRaw must retain optional chaining at modern/default targets, lower it at ES2019, and select the standard or legacy decorator protocol.
// @evidence contracts/testing.md#independent-expectations Optional chaining belongs to ES2020 and later. The fixture's optional function must therefore retain ?. at default/ES2025 and lose it at ES2019. Standard decorators use __esDecorate while experimentalDecorators uses __decorate; emitted artifacts, rather than repository source arrangement, are inspected.
// @evidence contracts/testing.md#distinguishing-cases Default, ES2025, ES2019, CLI ES2019 overriding ESNext, CLI null clearing ESNext, and legacy ESNext are separate named subtests. Each requires a nonempty actual index.js, zero configuration/emit diagnostics and both positive and negative helper distinctions. Runtime observable replacement and member initialization belong to the surviving Node boundary consumers.
// @evidence contracts/testing.md#execution-ownership This named Go test calls the owning driver library in process and creates only temporary compiler-input files; it does not install a consumer, build a native product artifact or launch a host. Each subtest closes its Program and owns its temporary directory. The physical driver-unit package is separate from native-host and race populations; its unit runner enrollment selects this package explicitly.
func TestRuntimeDecoratorTargetProfiles(t *testing.T) {
  cases := []struct {
    name string
    target string
    args []string
    legacy bool
    optional bool
  }{
    {name: "default", optional: true},
    {name: "es2025", target: "ES2025", optional: true},
    {name: "es2019", target: "ES2019"},
    {name: "cli-es2019", target: "ESNext", args: []string{"-t", "es2019"}},
    {name: "cli-null", target: "ESNext", args: []string{"--target", "null"}, optional: true},
    {name: "legacy-esnext", target: "ESNext", legacy: true, optional: true},
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
      write("index.ts", `function decorate(target: any, context?: any) { return target; }
@decorate
class Foo { answer = 42; }
export function optional(value?: { answer: number }) { return value?.answer; }
export const instance = new Foo();
`)
      args := append([]string{}, c.args...)
      prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true, TsgoArgs: args})
      if err != nil { t.Fatal(err) }
      if len(diags) != 0 { t.Fatalf("unexpected configuration diagnostics: %#v", diags) }
      defer prog.Close()
      var output string
      _, emitDiags, err := prog.EmitAllRaw(func(name, text string, _ *shimcompiler.WriteFileData) error {
        if filepath.Base(name) == "index.js" { output = text }
        return nil
      })
      if err != nil { t.Fatal(err) }
      if len(emitDiags) != 0 { t.Fatalf("unexpected emit diagnostics: %#v", emitDiags) }
      if output == "" { t.Fatal("index.js was not emitted") }
      if got := strings.Contains(output, "?.answer"); got != c.optional {
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

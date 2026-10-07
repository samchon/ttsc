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

// TestRuntimeDecoratorTargetProfiles observes actual compiler emit without a
// native executable or Node host. Each subtest prints its emitted JavaScript as
// a TTSC_RUNTIME_EMIT_V1 record for a Node VM consumer file; this test itself
// only inspects the emitted text.
//
// 1. Emit the seven existing valid target and decorator profiles.
// 2. Check invalid decorator admission and three distinct missing-library inputs.
// 3. Reject an invalid forwarded target before constructing a Program.
//
// @evidence contracts/testing.md#behavioral-verification Each successful emission subtest writes a tsconfig and the authored decorator fixture, runs driver.LoadProgram with the profile's target and CLI overlay, requires zero configuration, program and emit diagnostics, and captures index.js from EmitAllRaw. The emitted text must keep the ?. optional-chaining operator when the effective target is ES2020 or later, lower it at ES2019, and use the standard decorator helpers (__esDecorate, __runInitializers) or the legacy __decorate helper according to experimentalDecorators. The emitted program is not executed here. Five rejecting rows call the same LoadProgram path and require TS1329 for an invalid decorator, TS2318 for empty lib/config noLib/forwarded noLib, and TS6046 with no Program for an invalid target; authored input bytes remain unchanged.
// @evidence contracts/testing.md#independent-expectations Optional chaining is an ES2020 feature, so the fixture's value?.answer must survive at the default target and ES2025 and be lowered at ES2019. Standard TC39 decorators lower to __esDecorate and __runInitializers while experimentalDecorators lowers to __decorate; these are the TypeScript helper names and not values captured from this build. The members subtest asserts only helper selection, diagnostics and nonempty output; its initializer ordering and private-field values are not checked in Go. The literal diagnostic identifiers follow the invalid decorator signature, missing global-library types and unsupported target value rather than observed output.
// @evidence contracts/testing.md#distinguishing-cases Seven subtests differ in the effective target source: default, ES2025 in tsconfig, ES2019 in tsconfig, tsconfig ESNext overridden by CLI -t es2019, tsconfig ESNext cleared by CLI --target null, legacy decorators at ESNext, and an ES2025 member fixture. The optional-chaining check separates the lowering targets from the retaining ones, and the three helper checks (__esDecorate, __decorate, __runInitializers) separate standard from legacy emission in both directions. The rejecting matrix distinguishes a semantic decorator error, three independent library-selection inputs and command-line rejection before Program construction.
// @evidence contracts/testing.md#execution-ownership This named Go test calls driver.LoadProgram and Program.EmitAllRaw in the existing unit test process over temporary compiler inputs and the shared decorator fixture file. It builds or launches no product binary, consumer installation or host and runs no Node process. Each constructed Program is closed and each subtest owns its t.TempDir workspace. Four additional diagnostic Programs and one parser-only invalid-target call do not execute emit, user effects or the runtime launcher.
// The rejecting matrix additionally calls the same LoadProgram API four times
// with incompatible library inputs, then once for an invalid target that must
// return no Program. Literal TS1329, TS2318 and TS6046 distinguish decorator,
// global-library and command-line admission. These checks do not execute emit
// or user effects and do not certify the runtime launcher's abort ordering.
func TestRuntimeDecoratorTargetProfiles(t *testing.T) {
  fixtureBytes, err := os.ReadFile(filepath.Join("..", "..", "..", "..", "tests", "test-ttsc", "src", "internal", "runtime-decorator-fixture.json"))
  if err != nil {
    t.Fatal(err)
  }
  var fixture struct {
    Source       string `json:"source"`
    MemberSource string `json:"memberSource"`
  }
  if err := json.Unmarshal(fixtureBytes, &fixture); err != nil {
    t.Fatal(err)
  }
  if fixture.Source == "" {
    t.Fatal("empty authored decorator fixture")
  }
  cases := []struct {
    name     string
    target   string
    args     []string
    legacy   bool
    optional bool
    members  bool
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
        if err := os.MkdirAll(filepath.Dir(file), 0o755); err != nil {
          t.Fatal(err)
        }
        if err := os.WriteFile(file, []byte(text), 0o644); err != nil {
          t.Fatal(err)
        }
      }
      options := map[string]any{"module": "commonjs", "outDir": "dist", "strict": true}
      if c.target != "" {
        options["target"] = c.target
      }
      if c.legacy {
        options["experimentalDecorators"] = true
      }
      config, err := json.Marshal(map[string]any{"compilerOptions": options, "files": []string{"index.ts"}})
      if err != nil {
        t.Fatal(err)
      }
      write("tsconfig.json", string(config))
      source := fixture.Source + `
export {};
function optional(value?: { answer: number }) { return value?.answer; }
console.log(optional.toString().includes("?."));
`
      if c.legacy {
        source = `function legacy(target: Function) { console.log(target.name); }
@legacy
class Foo {}
new Foo();
export {};
export function optional(value?: { answer: number }) { return value?.answer; }
`
      }
      if c.members {
        source = fixture.MemberSource + "\nexport {};"
      }
      write("index.ts", source)
      args := append([]string{}, c.args...)
      prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true, TsgoArgs: args})
      if err != nil {
        t.Fatal(err)
      }
      if len(diags) != 0 {
        t.Fatalf("unexpected configuration diagnostics: %#v", diags)
      }
      defer prog.Close()
      if diagnostics := prog.Diagnostics(); len(diagnostics) != 0 {
        t.Fatalf("unexpected program diagnostics: %#v", diagnostics)
      }
      var output string
      _, emitDiags, err := prog.EmitAllRaw(func(name, text string, _ *shimcompiler.WriteFileData) error {
        if filepath.Base(name) == "index.js" {
          output = text
        }
        return nil
      })
      if err != nil {
        t.Fatal(err)
      }
      if len(emitDiags) != 0 {
        t.Fatalf("unexpected emit diagnostics: %#v", emitDiags)
      }
      if output == "" {
        t.Fatal("index.js was not emitted")
      }
      record, err := json.Marshal(map[string]string{"name": c.name, "javascript": output})
      if err != nil {
        t.Fatal(err)
      }
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
      // Standard decorators run their added initializers through
      // __runInitializers; the legacy protocol has no initializer concept.
      if got := strings.Contains(output, "__runInitializers"); got == c.legacy {
        t.Fatalf("standard initializer helper: got %v, legacy %v\n%s", got, c.legacy, output)
      }
    })
  }
  rejecting := []struct {
    name          string
    options       map[string]any
    args          []string
    source        string
    code          int32
    configuration bool
  }{
    {name: "invalid-decorator", options: map[string]any{}, source: "function invalid() { return 42; }\n@invalid\nclass Foo {}\nconsole.log(\"executed\");", code: 1329},
    {name: "empty-config-libraries", options: map[string]any{"lib": []string{}}, source: fixture.Source, code: 2318},
    {name: "config-no-lib", options: map[string]any{"noLib": true}, source: fixture.Source, code: 2318},
    {name: "forwarded-no-lib", options: map[string]any{}, args: []string{"--noLib"}, source: fixture.Source, code: 2318},
    {name: "invalid-forwarded-target", options: map[string]any{}, args: []string{"--target", "invalid"}, source: fixture.Source, code: 6046, configuration: true},
  }
  for _, c := range rejecting {
    t.Run(c.name, func(t *testing.T) {
      root := t.TempDir()
      options := map[string]any{"module": "commonjs", "target": "ESNext", "strict": true}
      for key, value := range c.options {
        options[key] = value
      }
      config, err := json.Marshal(map[string]any{"compilerOptions": options, "files": []string{"index.ts"}})
      if err != nil {
        t.Fatal(err)
      }
      if err := os.WriteFile(filepath.Join(root, "tsconfig.json"), config, 0o644); err != nil {
        t.Fatal(err)
      }
      sourceFile := filepath.Join(root, "index.ts")
      if err := os.WriteFile(sourceFile, []byte(c.source), 0o644); err != nil {
        t.Fatal(err)
      }
      prog, diagnostics, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceNoEmit: true, TsgoArgs: append([]string{}, c.args...)})
      if err != nil {
        t.Fatal(err)
      }
      if prog != nil {
        defer prog.Close()
      }
      if c.configuration {
        if prog != nil {
          t.Fatal("invalid target constructed a Program")
        }
      } else {
        if prog == nil || len(diagnostics) != 0 {
          t.Fatalf("expected program diagnostics after valid option parsing: %#v", diagnostics)
        }
        diagnostics = prog.Diagnostics()
      }
      found := false
      for _, diagnostic := range diagnostics {
        if diagnostic.Code == c.code {
          found = true
        }
      }
      if !found || driver.CountErrors(diagnostics) == 0 {
        t.Fatalf("expected error TS%d: %#v", c.code, diagnostics)
      }
      unchanged, err := os.ReadFile(sourceFile)
      if err != nil {
        t.Fatal(err)
      }
      if string(unchanged) != c.source {
        t.Fatal("diagnostic admission changed the authored source")
      }
    })
  }
}

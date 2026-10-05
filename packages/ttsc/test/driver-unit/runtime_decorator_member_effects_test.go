package driver_test

import (
  "encoding/json"
  "fmt"
  "os"
  "os/exec"
  "path/filepath"
  "strings"
  "testing"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/ttsc/internal/e2etrace"
)

// TestRuntimeDecoratorMemberEffects executes the actual library-emitted
// CommonJS member fixture in a fresh Node VM context. It retains the complete
// value and static/class/field/accessor initializer-order expectation, without
// exercising installed ttsx, ESM loading, or a runtime bootstrap.
//
// @evidence contracts/testing.md#behavioral-verification driver.LoadProgram and EmitAllRaw produce the CommonJS JavaScript actually evaluated by Node vm.Script. Its complete console transcript must equal the authored memberExpected: value 11 method and static:run,class:Foo,field:#value,accessor:count ordering.
// @evidence contracts/testing.md#independent-expectations The shared donor fixture authors the expected transcript independently of emitted JavaScript: field 2 plus one and accessor 4 times two yield 11, while its static method, class and instance initializers specify the complete event order. Node executes the actual emitted bytes; no emitted-text reconstruction or helper-name check substitutes for those values.
// @evidence contracts/testing.md#distinguishing-cases The one member fixture combines a decorated private field, auto-accessor, static method and class initializer. Configuration, program and emit diagnostics must be empty, JavaScript must be present, the independent Node command must succeed, and both complete transcript lines must match. Target/helper-shape profiles and actual ESM runtime assembly remain separate owners; this case authenticates neither.
// @evidence contracts/testing.md#execution-ownership This discoverable Go source-unit constructs and closes a native compiler Program directly over its own temporary project. A restored empty linked-plugin manifest excludes ambient hooks. One synchronous Node child is the independent output oracle, not a product host; its owned VM context has fresh CommonJS bindings and a supplied console collector, without replacing foreign methods. Its CombinedOutput call runs once, private trace observes the actual Cmd result, and completion precedes temporary cleanup. Missing Node or failed evaluation fails rather than skips; no consumer installation or product binary build occurs.
func TestRuntimeDecoratorMemberEffects(t *testing.T) {
  t.Setenv(driver.LinkedPluginsEnv, "")
  fixtureBytes, err := os.ReadFile(filepath.Join("..", "..", "..", "..", "tests", "test-ttsc", "src", "internal", "runtime-decorator-fixture.json"))
  if err != nil {
    t.Fatal(err)
  }
  var fixture struct {
    MemberSource   string `json:"memberSource"`
    MemberExpected string `json:"memberExpected"`
  }
  if err := json.Unmarshal(fixtureBytes, &fixture); err != nil {
    t.Fatal(err)
  }
  if fixture.MemberSource == "" || fixture.MemberExpected == "" {
    t.Fatal("member oracle requires authored source and complete expectation")
  }
  root := t.TempDir()
  if err := os.WriteFile(filepath.Join(root, "tsconfig.json"), []byte(`{
  "compilerOptions": { "target": "ES2022", "module": "commonjs", "strict": true, "outDir": "dist" },
  "files": ["index.ts"]
}
`), 0o644); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(filepath.Join(root, "index.ts"), []byte(fixture.MemberSource+"\nexport {};"), 0o644); err != nil {
    t.Fatal(err)
  }
  prog, diagnostics, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(diagnostics) != 0 {
    t.Fatalf("unexpected configuration diagnostics: %#v", diagnostics)
  }
  if prog == nil {
    t.Fatal("compiler Program was not constructed")
  }
  defer prog.Close()
  if diagnostics := prog.Diagnostics(); len(diagnostics) != 0 {
    t.Fatalf("unexpected program diagnostics: %#v", diagnostics)
  }
  var javascript string
  _, diagnostics, err = prog.EmitAllRaw(func(name, text string, _ *shimcompiler.WriteFileData) error {
    if filepath.Base(name) == "index.js" {
      javascript = text
    }
    return nil
  })
  if err != nil {
    t.Fatal(err)
  }
  if len(diagnostics) != 0 {
    t.Fatalf("unexpected emit diagnostics: %#v", diagnostics)
  }
  if javascript == "" {
    t.Fatal("member CommonJS JavaScript was not emitted")
  }
  record, err := json.Marshal(map[string]string{"name": "members-commonjs-effects", "javascript": javascript})
  if err != nil {
    t.Fatal(err)
  }
  fmt.Printf("TTSC_RUNTIME_EMIT_V1:%s\n", record)
  const oracle = `const fs = require("node:fs");
const vm = require("node:vm");
const util = require("node:util");
const javascript = fs.readFileSync(0, "utf8");
const lines = [];
const moduleValue = { exports: {} };
const context = { module: moduleValue, exports: moduleValue.exports,
  console: { log(...values) { lines.push(util.format(...values)); } } };
new vm.Script(javascript, { filename: "member-output.cjs" }).runInNewContext(context, { timeout: 10000 });
process.stdout.write(JSON.stringify(lines));`
  cmd := exec.Command("node", "-e", oracle)
  cmd.Dir = root
  cmd.Stdin = strings.NewReader(javascript)
  observation := e2etrace.BeginCommand(cmd, "CombinedOutput")
  output, err := cmd.CombinedOutput()
  observation.Result(err)
  if err != nil {
    t.Fatalf("independent member evaluation failed: %v\n%s", err, output)
  }
  var lines []string
  if err := json.Unmarshal(output, &lines); err != nil {
    t.Fatalf("invalid member oracle transcript: %v\n%s", err, output)
  }
  if got := strings.Join(lines, "\n"); got != fixture.MemberExpected {
    t.Fatalf("member transcript = %q, want %q", got, fixture.MemberExpected)
  }
}

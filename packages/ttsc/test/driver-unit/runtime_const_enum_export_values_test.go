package driver_test

import (
  "encoding/json"
  "os"
  "os/exec"
  "path/filepath"
  "reflect"
  "strings"
  "testing"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/ttsc/internal/e2etrace"
)

// TestRuntimeConstEnumExportValues verifies actual library-emitted CommonJS
// values from one source DAG under erased, preserved and isolated enum modes.
// These incompatible compiler options require three Programs, not installed
// ttsx hosts. One independent Node VM command evaluates their emitted modules.
//
// 1. Emit the same decorator, enum, barrel and importer sources in three modes.
// 2. Evaluate every actual output population through one independent Node oracle.
// 3. Require enum presence, erased types, full effects, live getters and deferred values.
//
// @evidence contracts/testing.md#behavioral-verification Actual LoadProgram and EmitAllRaw outputs must preserve decorator effects and erased interface absence, expose enum 42 only in preserved/isolated modes, forward owned barrel values and the 42-to-43 live getter, and keep an isolated importer responsive to four independently emitted enum values.
// @evidence contracts/testing.md#independent-expectations Authored enum Entry=42, actual=17, live=42/change=43 and enum variants 1/2/3/4 ground values independently of output. The existing fixture authors the complete decorator transcript. Node executes emitted modules with owned CommonJS bindings rather than reconstructing emitter text.
// @evidence contracts/testing.md#distinguishing-cases Erased and preserved modes differ in enum object presence while interfaces disappear in all modes. Direct/barrel exports and repeated owned require identity distinguish value forwarding and one-time source effects. Isolated importer bytes stay unchanged while four actual emitted enum-module values are supplied in separate VM module populations; this is not a persistent runtime cache or package-format transition.
// @evidence contracts/testing.md#execution-ownership This single discoverable driver-unit test loads three native compiler Programs over one temporary input DAG, closes each, captures actual emit and launches one Node child as an independent value oracle. The Cmd method runs once and private trace observes its result. No product binary, CLI, consumer installation or native plugin host is prepared; Node ESM advertisement, project selection, orphan caching and OS child lifetime are not authenticated by this test.
func TestRuntimeConstEnumExportValues(t *testing.T) {
  t.Setenv(driver.LinkedPluginsEnv, "")
  fixtureBytes, err := os.ReadFile(filepath.Join("..", "..", "..", "..", "tests", "test-ttsc", "src", "internal", "runtime-decorator-fixture.json"))
  if err != nil { t.Fatal(err) }
  var fixture struct { Source string `json:"source"`; Expected string `json:"expected"` }
  if err := json.Unmarshal(fixtureBytes, &fixture); err != nil { t.Fatal(err) }
  if fixture.Source == "" || fixture.Expected == "" { t.Fatal("missing authored decorator source or expectation") }
  root := t.TempDir()
  sources := map[string]string{
    "direct.ts": fixture.Source + "\nexport const enum Value { Entry = 42 }\nexport interface OnlyType { value: number }\n",
    "barrel.ts": fixture.Source + "\nexport * from './values';\n",
    "values.ts": "console.log('values-loaded'); export const enum Value { Entry = 42 } export interface OnlyType { value: number } export const actual = 17; export let live = 42; export function change() { live = 43; }\n",
    "importer.ts": fixture.Source + "\nimport { Value } from './enum-1'; export const answer = Value.Entry;\n",
    "enum-1.ts": "export const enum Value { Entry = 1 }\n",
    "enum-2.ts": "export const enum Value { Entry = 2 }\n",
    "enum-3.ts": "export const enum Value { Entry = 3 }\n",
    "enum-4.ts": "export const enum Value { Entry = 4 }\n",
  }
  names := []string{"direct.ts", "barrel.ts", "values.ts", "importer.ts", "enum-1.ts", "enum-2.ts", "enum-3.ts", "enum-4.ts"}
  config, err := json.Marshal(map[string]any{
    "compilerOptions": map[string]any{"target": "es2022", "module": "commonjs", "outDir": "dist", "preserveConstEnums": false},
    "files": names,
  })
  if err != nil { t.Fatal(err) }
  if err := os.WriteFile(filepath.Join(root, "tsconfig.json"), config, 0o644); err != nil { t.Fatal(err) }
  for _, name := range names {
    if err := os.WriteFile(filepath.Join(root, name), []byte(sources[name]), 0o644); err != nil { t.Fatal(err) }
  }
  type emittedProfile struct { Name string `json:"name"`; Modules map[string]string `json:"modules"` }
  profiles := []struct { name string; args []string }{
    {"erased", []string{}},
    {"preserved", []string{"--preserveConstEnums", "true"}},
    {"isolated", []string{"--isolatedModules", "--preserveConstEnums", "true", "--noCheck", "--noResolve"}},
  }
  emitted := make([]emittedProfile, 0, len(profiles))
  for _, profile := range profiles {
    prog, diagnostics, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true, TsgoArgs: profile.args})
    if err != nil { t.Fatal(err) }
    if prog == nil { t.Fatal("missing compiler Program") }
    func() {
      defer prog.Close()
      if len(diagnostics) != 0 { t.Fatalf("%s config diagnostics: %#v", profile.name, diagnostics) }
      if diagnostics := prog.Diagnostics(); len(diagnostics) != 0 { t.Fatalf("%s program diagnostics: %#v", profile.name, diagnostics) }
      modules := map[string]string{}
      _, diagnostics, err := prog.EmitAllRaw(func(name, text string, _ *shimcompiler.WriteFileData) error {
        if filepath.Ext(name) == ".js" { modules[filepath.Base(name)] = text }
        return nil
      })
      if err != nil { t.Fatal(err) }
      if len(diagnostics) != 0 { t.Fatalf("%s emit diagnostics: %#v", profile.name, diagnostics) }
      for _, name := range names {
        output := strings.TrimSuffix(name, ".ts") + ".js"
        if modules[output] == "" { t.Fatalf("%s missing %s", profile.name, output) }
      }
      emitted = append(emitted, emittedProfile{profile.name, modules})
    }()
  }
  input, err := json.Marshal(emitted)
  if err != nil { t.Fatal(err) }
  const oracle = `const fs = require('node:fs');
const vm = require('node:vm');
const util = require('node:util');
const path = require('node:path').posix;
const profiles = JSON.parse(fs.readFileSync(0, 'utf8'));
function population(modules) {
  const loaded = new Map(), lines = [];
  function load(name) {
    if (loaded.has(name)) return loaded.get(name).exports;
    if (!Object.hasOwn(modules, name)) throw new Error('missing emitted module: ' + name);
    const mod = {exports: {}}; loaded.set(name, mod);
    const context = {module: mod, exports: mod.exports,
      console: {log(...values) { lines.push(util.format(...values)); }},
      require(specifier) { const target = path.normalize(path.join(path.dirname(name), specifier)); return load(target.endsWith('.js') ? target : target + '.js'); }};
    new vm.Script(modules[name], {filename: name}).runInNewContext(context, {timeout: 10000});
    return mod.exports;
  }
  return {load, lines};
}
const results = profiles.map(({name, modules}) => {
  const directPopulation = population(modules), direct = directPopulation.load('direct.js');
  const barrelPopulation = population(modules), barrel = barrelPopulation.load('barrel.js'), values = barrelPopulation.load('values.js');
  const liveBefore = barrel.live; values.change();
  const answers = [];
  if (name === 'isolated') for (const n of [1,2,3,4]) {
    const variant = {...modules, 'enum-1.js': modules['enum-' + n + '.js']};
    const current = population(variant);
    answers.push(current.load('importer.js').answer);
    if (current.lines.join('\n') !== directPopulation.lines.join('\n')) throw new Error('importer decorator effects changed');
  }
  return {name, directEnum: Object.hasOwn(direct, 'Value'), directValue: String(direct.Value?.Entry ?? 'missing'), directType: Object.hasOwn(direct, 'OnlyType'),
    directLines: directPopulation.lines.join('\n'), barrelEnum: Object.hasOwn(barrel, 'Value'), barrelValue: String(barrel.Value?.Entry ?? 'missing'),
    barrelType: Object.hasOwn(barrel, 'OnlyType'), enumIdentity: barrel.Value === values.Value, actual: barrel.actual, liveBefore, liveAfter: barrel.live,
    repeatedIdentity: barrelPopulation.load('barrel.js') === barrel, valuesLoads: barrelPopulation.lines.filter(line => line === 'values-loaded').length,
    decoratorLines: barrelPopulation.lines.filter(line => line !== 'values-loaded').join('\n'), answers};
});
process.stdout.write(JSON.stringify(results));`
  cmd := exec.Command("node", "-e", oracle)
  cmd.Dir = root
  cmd.Stdin = strings.NewReader(string(input))
  observation := e2etrace.BeginCommand(cmd, "CombinedOutput")
  output, err := cmd.CombinedOutput()
  observation.Result(err)
  if err != nil { t.Fatalf("independent enum evaluation failed: %v\n%s", err, output) }
  var got []struct {
    Name string `json:"name"`
    DirectEnum bool `json:"directEnum"`
    DirectValue string `json:"directValue"`
    DirectType bool `json:"directType"`
    DirectLines string `json:"directLines"`
    BarrelEnum bool `json:"barrelEnum"`
    BarrelValue string `json:"barrelValue"`
    BarrelType bool `json:"barrelType"`
    EnumIdentity bool `json:"enumIdentity"`
    Actual int `json:"actual"`
    LiveBefore int `json:"liveBefore"`
    LiveAfter int `json:"liveAfter"`
    RepeatedIdentity bool `json:"repeatedIdentity"`
    ValuesLoads int `json:"valuesLoads"`
    DecoratorLines string `json:"decoratorLines"`
    Answers []int `json:"answers"`
  }
  if err := json.Unmarshal(output, &got); err != nil { t.Fatalf("invalid oracle result: %v\n%s", err, output) }
  if len(got) != 3 { t.Fatalf("oracle profiles = %d, want 3", len(got)) }
  for index, result := range got {
    preserved := index != 0
    enumValue := "missing"
    if preserved { enumValue = "42" }
    if result.Name != profiles[index].name || result.DirectEnum != preserved || result.DirectValue != enumValue || result.DirectType || result.DirectLines != fixture.Expected || result.BarrelEnum != preserved || result.BarrelValue != enumValue || result.BarrelType || !result.EnumIdentity || result.Actual != 17 || result.LiveBefore != 42 || result.LiveAfter != 43 || !result.RepeatedIdentity || result.ValuesLoads != 1 || result.DecoratorLines != fixture.Expected {
      t.Errorf("%s enum/barrel/effects result: %#v", profiles[index].name, result)
    }
    wantAnswers := []int{}
    if index == 2 { wantAnswers = []int{1, 2, 3, 4} }
    if !reflect.DeepEqual(result.Answers, wantAnswers) { t.Errorf("%s deferred answers = %v, want %v", result.Name, result.Answers, wantAnswers) }
  }
}

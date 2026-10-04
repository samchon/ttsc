package driver_test

import (
  "encoding/json"
  "io/fs"
  "os"
  "os/exec"
  "path/filepath"
  "strings"
  "testing"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/ttsc/internal/e2etrace"
)

// TestRuntimeEmittedExportPopulation verifies a compatible source DAG through
// one library Program and one independent Node evaluation of its output files.
// The .ts population uses NodeNext with a CommonJS root; explicit .mts and .cts
// inputs retain their distinct output formats. This does not exercise ttsx's
// ESM extensionless loader, installed consumers, plugin stripping or cache life.
//
// @evidence contracts/testing.md#behavioral-verification LoadProgram and EmitAllRaw produce the actual files consumed by native Node require/import. Complete decorator and member transcripts, live reexports, namespace values, dynamic CommonJS exports, cyclic exports, directory-index resolution and side-effect values are compared to authored literals.
// @evidence contracts/testing.md#independent-expectations Expected strings and numbers are independent constants. Hidden and ghost modules throw if executed; template/comment/type-only export decoys must remain absent. The runtime provider is the existing tslib package copied without rewriting, not an authored helper substitute.
// @evidence contracts/testing.md#distinguishing-cases The same Program contains CommonJS .ts packages, explicit ESM .mts and CommonJS .cts decorators, star/renamed/namespace reexports, a cycle, dynamic property creation, a live value mutation and directory/side-effect edges. Missing outputs, configuration/emit diagnostics, Node failure or any literal mismatch fail. No native type-check, ESM extensionless policy, export-name scanner, orphan ownership, source cache or stripping claim is made.
// @evidence contracts/testing.md#execution-ownership An owned temporary project receives package-owned byte inputs and an unchanged existing tslib provider. One compiler Program is closed after its emission; one synchronous Node child reads those emitted files and completes before cleanup. Its Output call runs once and private trace records the actual Cmd outcome. No SDK installation, product CLI, shared host, foreign-method replacement or per-donor Program loop occurs. Existing console warnings are retained on stderr and are not a strip oracle.
func TestRuntimeEmittedExportPopulation(t *testing.T) {
  t.Setenv(driver.LinkedPluginsEnv, "")
  root := t.TempDir()
  write := func(name string, data []byte) {
    if err := os.MkdirAll(filepath.Dir(name), 0o755); err != nil { t.Fatal(err) }
    if err := os.WriteFile(name, data, 0o644); err != nil { t.Fatal(err) }
  }
  copyTree := func(source, destination string) {
    resolved, err := filepath.EvalSymlinks(source)
    if err != nil { t.Fatal(err) }
    source = resolved
    err = filepath.WalkDir(source, func(name string, entry fs.DirEntry, walkErr error) error {
      if walkErr != nil { return walkErr }
      if entry.IsDir() { return nil }
      relative, err := filepath.Rel(source, name)
      if err != nil { return err }
      data, err := os.ReadFile(name)
      if err != nil { return err }
      write(filepath.Join(destination, relative), data)
      return nil
    })
    if err != nil { t.Fatal(err) }
  }
  copyTree(filepath.Join("..", "fixtures", "unit", "runtime-emitted-export-population"), root)
  provider := filepath.Join("..", "..", "..", "..", "tests", "test-e2e", "node_modules", "tslib")
  copyTree(provider, filepath.Join(root, "node_modules", "tslib"))
  write(filepath.Join(root, "package.json"), []byte(`{"type":"commonjs"}`))
  config := map[string]any{
    "compilerOptions": map[string]any{
      "target": "ES2022", "module": "NodeNext", "moduleResolution": "NodeNext",
      "rootDir": ".", "outDir": "dist", "allowJs": true, "noCheck": true,
    },
    "include": []string{"export-population/**/*", "node-compatible/**/*", "standard.mts", "standard.cts", "member.mts", "member.cts"},
  }
  encoded, err := json.Marshal(config)
  if err != nil { t.Fatal(err) }
  write(filepath.Join(root, "tsconfig.json"), encoded)
  prog, diagnostics, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true, TsgoArgs: []string{}})
  if err != nil { t.Fatal(err) }
  if prog == nil || len(diagnostics) != 0 { t.Fatalf("Program/configuration: %v, %#v", prog, diagnostics) }
  defer prog.Close()
  emitted := make(map[string]bool)
  _, diagnostics, err = prog.EmitAllRaw(func(name, text string, _ *shimcompiler.WriteFileData) error {
    write(name, []byte(text))
    emitted[filepath.Clean(name)] = true
    return nil
  })
  if err != nil || len(diagnostics) != 0 { t.Fatalf("emit: %v, %#v", err, diagnostics) }
  dist := filepath.Join(root, "dist")
  for _, name := range []string{
    "export-population/inert/index.js", "export-population/dynamic/index.js",
    "export-population/dynamic/dynamic.cjs", "export-population/collision/index.js",
    "export-population/lowering/index.js", "node-compatible/star/index.js",
    "node-compatible/cycle/index.js", "node-compatible/scanner/directory.js",
    "node-compatible/scanner/side-effect.js", "standard.mjs", "standard.cjs", "member.mjs", "member.cjs",
  } {
    if !emitted[filepath.Join(dist, filepath.FromSlash(name))] { t.Errorf("required output absent: %s", name) }
  }
  if t.Failed() { return }
  write(filepath.Join(dist, "package.json"), []byte(`{"type":"commonjs"}`))
  for _, name := range []string{"inert", "dynamic", "collision", "lowering"} {
    data, err := os.ReadFile(filepath.Join(root, "export-population", name, "package.json"))
    if err != nil { t.Fatal(err) }
    write(filepath.Join(dist, "export-population", name, "package.json"), data)
  }
  const oracle = `const path=require("node:path");
const {pathToFileURL}=require("node:url");
const root=process.argv[1];
const load=(name)=>require(path.join(root,name));
(async()=>{
  const inert=load("export-population/inert/index.js");
  const before=inert.nested; inert.change();
  const dynamic=load("export-population/dynamic/index.js");
  const lowering=load("export-population/lowering/index.js");
  const star=load("node-compatible/star/index.js");
  const cycle=load("node-compatible/cycle/index.js");
  const standardCjs=load("standard.cjs"),memberCjs=load("member.cjs");
  const standardEsm=await import(pathToFileURL(path.join(root,"standard.mjs")).href);
  const memberEsm=await import(pathToFileURL(path.join(root,"member.mjs")).href);
  process.stdout.write(JSON.stringify({
    inert:[inert.observed,inert.answer,inert.actual,before,inert.nested,inert.inertArithmetic,
      Object.hasOwn(inert,"hidden"),Object.hasOwn(inert,"ghost"),
      inert.inlineText.includes("__exportStar(require(\"./ghost\"), exports);"),
      inert.memberText.includes("tslib_1.__exportStar(require(\"./ghost\"), exports);")],
    dynamic:[dynamic.observed,dynamic.answer,dynamic.actual,dynamic.dynamic],
    collision:load("export-population/collision/index.js").packageValue,
    lowering:[lowering.answer,lowering.shout("ok"),lowering.namespaceBox.value],
    star:[star.foo,star.bar(),star.qux,star.grouped.leaf,
      ["Hidden","commentedGhost","stringGhost","commentAssignGhost","blockAssignGhost","stringAssignGhost","templateAssignGhost"].some(name=>Object.hasOwn(star,name))],
    cycle:[cycle.labelA,cycle.labelB,cycle.combine(),cycle===load("node-compatible/cycle/index.js")],
    directory:load("node-compatible/scanner/directory.js").observed,
    sideEffect:load("node-compatible/scanner/side-effect.js").observed,
    standard:[standardCjs.observed,standardCjs.answer,standardEsm.observed,standardEsm.answer],
    member:[memberCjs.observed,memberEsm.observed]
  }));
})().catch(error=>{console.error(error);process.exitCode=1;});`
  cmd := exec.Command("node", "-e", oracle, dist)
  cmd.Dir = root
  observation := e2etrace.BeginCommand(cmd, "Output")
  output, err := cmd.Output()
  observation.Result(err)
  if err != nil {
    if exit, ok := err.(*exec.ExitError); ok { t.Fatalf("output oracle: %v\n%s", err, exit.Stderr) }
    t.Fatal(err)
  }
  const transcript = "Hello Class Foo\nHello Function getBar\nabc"
  const memberTranscript = "11 method\nstatic:run,class:Foo,field:#value,accessor:count"
  expected := map[string]any{
    "inert": []any{transcript, 42, 17, 42, 43, true, false, false, true, true},
    "dynamic": []any{transcript, 42, 17, 42},
    "collision": "package", "lowering": []any{42, "OK", 7},
    "star": []any{"foo-ok", "bar-ok", "renamed-ok", "leaf-ok", false},
    "cycle": []any{"A", "B", "AB", true},
    "directory": "directory-index-ok", "sideEffect": "side-effect-import-ok",
    "standard": []any{transcript, 42, transcript, 42},
    "member": []any{memberTranscript, memberTranscript},
  }
  var actual map[string]json.RawMessage
  if err := json.Unmarshal(output, &actual); err != nil { t.Fatalf("oracle JSON: %v\n%s", err, output) }
  if len(actual) != len(expected) { t.Errorf("oracle fields = %d, want %d", len(actual), len(expected)) }
  for name, value := range expected {
    want, err := json.Marshal(value)
    if err != nil { t.Fatal(err) }
    if strings.TrimSpace(string(actual[name])) != string(want) { t.Errorf("%s = %s, want %s", name, actual[name], want) }
  }
}

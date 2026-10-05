package driver_test

import (
  "encoding/json"
  "fmt"
  "path/filepath"
  "reflect"
  "sort"
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimprinter "github.com/microsoft/typescript-go/shim/printer"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestEmitWithPluginTransformerEmitsDeclarationOutputs Verifies transformed JavaScript retains
// the raw emitter's declaration artifacts and map contents.
//
// EmitWithPluginTransformers owns the transformed JavaScript path, but it must
// not narrow tsgo's output set to only `.js` and `.js.map`. A declaration build
// must still emit the same declaration artifacts as raw tsgo emit: `.d.ts` and
// `.d.ts.map`, including the declaration map trailer inside the `.d.ts`.
//
// 1. Emit one declaration fixture through raw emission and numeric/standalone-member transforms.
// 2. Compare artifact sets and declaration bytes, then check JS replacements, both v3 maps and trailers.
//
// @evidence contracts/testing.md#behavioral-verification Runs actual EmitWithPluginTransformers with numeric and standalone-factory member replacements, compares complete artifact sets and declaration/map bytes with raw emit, and asserts generated arrow/marker, Payload/payload declarations, both populated v3 maps and trailers.
// @evidence contracts/testing.md#independent-expectations The delegated native raw emitter independently owns declaration compatibility; authored Payload/value/payload source, before versus GO DRIVER EMIT PLUGIN, input => input.value, artifact names, src/index.ts, version three and replacement two are literal controls.
// @evidence contracts/testing.md#distinguishing-cases Numeric and string replacements coexist with the preserved declaration API and label member; raw before versus transformed marker distinguishes actual transformation while JS/declaration maps and incremental output retain the original artifact parity controls.
// @evidence contracts/testing.md#execution-ownership The owning driver Go unit runs raw and plugin operations on the same private in-process Program and captures writes, then closes it; no native host is built and the generated JavaScript is not executed here.
func TestEmitWithPluginTransformerEmitsDeclarationOutputs(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "rootDir": "src",
    "outDir": "dist",
    "declaration": true,
    "declarationMap": true,
    "incremental": true,
    "sourceMap": true,
    "strict": true,
    "tsBuildInfoFile": "dist/index.tsbuildinfo"
  },
  "include": ["src"]
}
`)
  writeProjectFile(t, root, "src/index.ts", strings.Join([]string{
    "export interface Payload {",
    "  readonly label: string;",
    "  readonly value: string;",
    "}",
    "export const payload: Payload = { label: 'kept', value: 'before' };",
    "console.log(payload.value);",
    "export const value: number = 1;",
    "",
  }, "\n"))

  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  defer prog.Close()

  raw := map[string]string{}
  if _, emitDiags, err := prog.EmitAllRaw(func(fileName, text string, _ *shimcompiler.WriteFileData) error {
    raw[filepath.Base(fileName)] = text
    return nil
  }); err != nil || len(emitDiags) != 0 {
    t.Fatalf("raw emit mismatch: diags=%#v err=%v", emitDiags, err)
  }

  transform := func(ec *shimprinter.EmitContext, sf *shimast.SourceFile) *shimast.SourceFile {
    var visitor *shimast.NodeVisitor
    visit := func(node *shimast.Node) *shimast.Node {
      if node == nil {
        return node
      }
      if node.Kind == shimast.KindNumericLiteral && node.Text() == "1" {
        return ec.Factory.NewNumericLiteral("2", 0)
      }
      if node.Kind == shimast.KindStringLiteral && node.Text() == "before" {
        f := ec.Factory
        standalone := shimast.NewNodeFactory(shimast.NodeFactoryHooks{})
        access := standalone.NewPropertyAccessExpression(f.NewIdentifier("input"), nil, standalone.NewIdentifier("value"), shimast.NodeFlagsNone)
        parameter := f.NewParameterDeclaration(nil, nil, f.NewIdentifier("input"), nil, nil, nil)
        arrow := f.NewArrowFunction(nil, nil, f.NewNodeList([]*shimast.Node{parameter}), nil, nil, f.NewToken(shimast.KindEqualsGreaterThanToken), access)
        argument := f.NewObjectLiteralExpression(f.NewNodeList([]*shimast.Node{
          f.NewPropertyAssignment(nil, f.NewIdentifier("value"), nil, nil, f.NewStringLiteral("GO DRIVER EMIT PLUGIN", 0)),
        }), false)
        return f.NewCallExpression(f.NewParenthesizedExpression(arrow), nil, nil, f.NewNodeList([]*shimast.Node{argument}), shimast.NodeFlagsNone)
      }
      return visitor.VisitEachChild(node)
    }
    visitor = ec.NewNodeVisitor(visit)
    return visitor.VisitSourceFile(sf)
  }

  plugin := map[string]string{}
  if emitDiags, err := prog.EmitWithPluginTransformers([]driver.PluginTransform{transform}, func(fileName, text string, _ *shimcompiler.WriteFileData) error {
    plugin[filepath.Base(fileName)] = text
    return nil
  }); err != nil || len(emitDiags) != 0 {
    t.Fatalf("plugin emit mismatch: diags=%#v err=%v", emitDiags, err)
  }

  if got, want := sortedStringKeys(plugin), sortedStringKeys(raw); !reflect.DeepEqual(got, want) {
    t.Fatalf("plugin emit output set mismatch:\n  got  %v\n  want %v", got, want)
  }
  for _, name := range []string{"index.js", "index.js.map", "index.d.ts", "index.d.ts.map"} {
    if plugin[name] == "" {
      t.Fatalf("%s was not emitted; got keys %v", name, sortedStringKeys(plugin))
    }
  }
  if !strings.Contains(plugin["index.js"], "exports.value = 2;") {
    t.Fatalf("plugin transform did not affect JavaScript:\n%s", plugin["index.js"])
  }
  for _, literal := range []string{"input => input.value", "GO DRIVER EMIT PLUGIN", "console.log(exports.payload.value)", "//# sourceMappingURL=index.js.map"} {
    if !strings.Contains(plugin["index.js"], literal) {
      t.Fatalf("JavaScript lost %q:\n%s", literal, plugin["index.js"])
    }
  }
  if !strings.Contains(raw["index.js"], "before") || strings.Contains(raw["index.js"], "GO DRIVER EMIT PLUGIN") {
    t.Fatalf("raw JavaScript lost the untransformed control:\n%s", raw["index.js"])
  }
  for _, literal := range []string{"export interface Payload", "readonly label: string;", "readonly value: string;", "export declare const payload: Payload;"} {
    if !strings.Contains(plugin["index.d.ts"], literal) {
      t.Fatalf("declaration lost %q:\n%s", literal, plugin["index.d.ts"])
    }
  }
  if plugin["index.d.ts"] != raw["index.d.ts"] {
    t.Fatalf("declaration output diverged from raw tsgo emit:\nplugin:\n%s\nraw:\n%s", plugin["index.d.ts"], raw["index.d.ts"])
  }
  if plugin["index.d.ts.map"] != raw["index.d.ts.map"] {
    t.Fatalf("declaration map output diverged from raw tsgo emit:\nplugin:\n%s\nraw:\n%s", plugin["index.d.ts.map"], raw["index.d.ts.map"])
  }
  if !strings.Contains(plugin["index.d.ts"], "//# sourceMappingURL=index.d.ts.map") {
    t.Fatalf("declaration output missing declaration map trailer:\n%s", plugin["index.d.ts"])
  }

  var parsed struct {
    Version  int      `json:"version"`
    Sources  []string `json:"sources"`
    Mappings string   `json:"mappings"`
  }
  if err := json.Unmarshal([]byte(plugin["index.d.ts.map"]), &parsed); err != nil {
    t.Fatalf("index.d.ts.map is not valid JSON: %v\n%s", err, plugin["index.d.ts.map"])
  }
  if parsed.Version != 3 || parsed.Mappings == "" {
    t.Fatalf("index.d.ts.map is not a populated v3 source map: %#v", parsed)
  }
  foundSource := false
  for _, source := range parsed.Sources {
    if strings.HasSuffix(filepath.ToSlash(source), "src/index.ts") {
      foundSource = true
    }
  }
  if !foundSource {
    t.Fatalf("declaration map sources do not reference src/index.ts: %v", parsed.Sources)
  }
  parsed.Version, parsed.Sources, parsed.Mappings = 0, nil, ""
  if err := json.Unmarshal([]byte(plugin["index.js.map"]), &parsed); err != nil {
    t.Fatalf("index.js.map is not valid JSON: %v", err)
  }
  if parsed.Version != 3 || parsed.Mappings == "" {
    t.Fatalf("index.js.map is not a populated v3 source map: %#v", parsed)
  }
  foundSource = false
  for _, source := range parsed.Sources {
    if strings.HasSuffix(filepath.ToSlash(source), "src/index.ts") {
      foundSource = true
    }
  }
  if !foundSource {
    t.Fatalf("JavaScript map sources do not reference src/index.ts: %v", parsed.Sources)
  }
}

// TestEmitWithPluginTransformerEmitDeclarationOnlyOutputs Verifies declaration-only emission
// preserves declaration artifacts without running the JavaScript transformer.
//
// Declaration-only output belongs to the delegated native declaration emitter. An
// observable JavaScript callback must remain idle while nonempty declaration and
// declaration-map artifacts match the raw output set, separating this branch
// from a mixed JavaScript build. This entry does not compare artifact bytes.
//
// 1. Emit the declaration-only fixture through raw and transformed emission.
// 2. Require matching artifact names, nonempty declarations, no JavaScript output and no JS transformer invocation.
//
// @evidence contracts/testing.md#behavioral-verification Calls actual declaration-only emission and requires no JS transform call, no index.js, two nonempty declaration artifacts and complete output-set parity with raw emission.
// @evidence contracts/testing.md#independent-expectations Authored emitDeclarationOnly/declarationMap options independently require declaration artifacts and exclude JavaScript; raw native emitter independently owns output-set compatibility.
// @evidence contracts/testing.md#distinguishing-cases Observable identity-transform callback must remain idle, contrasting mixed JS/declaration emission in the sibling entry.
// @evidence contracts/testing.md#execution-ownership The owning Go driver unit uses its actual Program and emit APIs with local output maps and deferred Program close, without invoking an executable host.
func TestEmitWithPluginTransformerEmitDeclarationOnlyOutputs(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "rootDir": "src",
    "outDir": "dist",
    "declaration": true,
    "declarationMap": true,
    "emitDeclarationOnly": true,
    "strict": true
  },
  "include": ["src"]
}
`)
  writeProjectFile(t, root, "src/index.ts", strings.Join([]string{
    "export interface Payload {",
    "  readonly label: string;",
    "}",
    "export declare const payload: Payload;",
    "",
  }, "\n"))

  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  defer prog.Close()

  raw := map[string]string{}
  if _, emitDiags, err := prog.EmitAllRaw(func(fileName, text string, _ *shimcompiler.WriteFileData) error {
    raw[filepath.Base(fileName)] = text
    return nil
  }); err != nil || len(emitDiags) != 0 {
    t.Fatalf("raw emit mismatch: diags=%#v err=%v", emitDiags, err)
  }

  transformCalled := false
  plugin := map[string]string{}
  transform := func(_ *shimprinter.EmitContext, sf *shimast.SourceFile) *shimast.SourceFile {
    transformCalled = true
    return sf
  }
  if emitDiags, err := prog.EmitWithPluginTransformer(transform, func(fileName, text string, _ *shimcompiler.WriteFileData) error {
    plugin[filepath.Base(fileName)] = text
    return nil
  }); err != nil || len(emitDiags) != 0 {
    t.Fatalf("plugin emit mismatch: diags=%#v err=%v", emitDiags, err)
  }

  if transformCalled {
    t.Fatal("JavaScript transform ran during emitDeclarationOnly")
  }
  if got, want := sortedStringKeys(plugin), sortedStringKeys(raw); !reflect.DeepEqual(got, want) {
    t.Fatalf("plugin emit output set mismatch:\n  got  %v\n  want %v", got, want)
  }
  if _, ok := plugin["index.js"]; ok {
    t.Fatalf("emitDeclarationOnly unexpectedly emitted JavaScript: %v", sortedStringKeys(plugin))
  }
  for _, name := range []string{"index.d.ts", "index.d.ts.map"} {
    if plugin[name] == "" {
      t.Fatalf("%s was not emitted; got keys %v", name, sortedStringKeys(plugin))
    }
  }
}

// TestEmitWithPluginTransformerDeclarationWriteCallbackSerialized Verifies repeated
// declaration-only emission writes each source once into an unguarded callback map.
//
// The hand-assembled JavaScript lane is serial; delegated declaration emission
// may invoke writers concurrently under the selected native threading policy.
// A plugin writer may be a plain output map, so ttsc serializes that callback
// just like EmitAllRaw does. This test does not measure actual worker overlap.
//
// 1. Load twenty-four declaration sources and repeat declaration-only emission one hundred times.
// 2. Require exactly one callback per source in each fresh unguarded map; no race-detector claim is made.
//
// @evidence contracts/testing.md#behavioral-verification Calls actual declaration-only emitter one hundred times on twenty-four sources, requiring each declaration callback exactly once in a fresh unguarded map.
// @evidence contracts/testing.md#independent-expectations Authored source-name list independently defines exact expected file count and per-file count one.
// @evidence contracts/testing.md#distinguishing-cases Wide declaration-only emission and repeated iterations exercise callback serialization distinct from the JS funnel and its rewrite state.
// @evidence contracts/testing.md#execution-ownership The owning driver Go unit reuses one immutable Program with fresh per-iteration callback maps, captures actual compiler writes and closes its Program; no external emitter executes.
func TestEmitWithPluginTransformerDeclarationWriteCallbackSerialized(t *testing.T) {
  root := t.TempDir()

  const sources = 24
  names := make([]string, sources)
  for i := range names {
    names[i] = fmt.Sprintf("mod%02d", i)
  }
  writeProjectFile(t, root, "tsconfig.json", fmt.Sprintf(`{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "outDir": "dist",
    "declaration": true,
    "emitDeclarationOnly": true,
    "strict": true
  },
  "files": [%s]
}
`, `"`+strings.Join(filesList(names), `", "`)+`"`))
  for _, name := range names {
    writeProjectFile(t, root, name+".ts", fmt.Sprintf("export const value = %q;\n", name))
  }

  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  defer prog.Close()

  const iterations = 100
  for iter := 0; iter < iterations; iter++ {
    emitted := map[string]int{}
    emitDiags, err := prog.EmitWithPluginTransformers(nil, func(fileName, _ string, _ *shimcompiler.WriteFileData) error {
      _ = len(emitted)
      emitted[filepath.Base(fileName)]++
      return nil
    })
    if err != nil {
      t.Fatalf("iteration %d: %v", iter, err)
    }
    if len(emitDiags) != 0 {
      t.Fatalf("iteration %d: unexpected emit diagnostics: %#v", iter, emitDiags)
    }
    if len(emitted) != len(names) {
      t.Fatalf("iteration %d: expected %d declaration outputs, got %d: %#v", iter, len(names), len(emitted), emitted)
    }
    for _, name := range names {
      if count := emitted[name+".d.ts"]; count != 1 {
        t.Fatalf("iteration %d: %s.d.ts written %d times", iter, name, count)
      }
    }
  }
}

// TestEmitPluginTransformersDeclarationDirOutputsSurviveOutDirContainment Verifies separate
// declaration-directory outputs survive containment while all writes remain in permitted
// roots.
//
// The JS output for a dependency source may be skipped by the forced-emit
// outDir guard, but that decision must be per emitted path. A legitimate
// project declaration written under declarationDir must still survive.
//
// 1. Emit the self-referenced fixture with distinct output and declaration directories.
// 2. Require every write inside either permitted directory and all four main JS/map/declaration artifacts.
//
// @evidence contracts/testing.md#behavioral-verification Calls actual plugin emission in the self-referenced layout and requires all writes within outDir or declarationDir plus JS/map/declaration/map for main.
// @evidence contracts/testing.md#independent-expectations Authored project dist and types prefixes and explicit four main artifacts independently specify permitted output.
// @evidence contracts/testing.md#distinguishing-cases A separate declarationDir distinguishes valid declaration writes from dependency source outputs forbidden outside both configured roots.
// @evidence contracts/testing.md#execution-ownership The owning Go unit runs actual compiler/emitter APIs with private filesystem input and captured paths and deferred Program close, without a native host.
func TestEmitPluginTransformersDeclarationDirOutputsSurviveOutDirContainment(t *testing.T) {
  root := t.TempDir()
  project := writeSelfReferencedDependencyProject(t, root)
  writeProjectFile(t, root, "proj/tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "moduleResolution": "bundler",
    "rootDir": "src",
    "outDir": "dist",
    "declaration": true,
    "declarationMap": true,
    "declarationDir": "types",
    "sourceMap": true,
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
`)
  prog, diags, err := driver.LoadProgram(project, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  defer prog.Close()

  written := map[string]bool{}
  emitDiags, err := prog.EmitWithPluginTransformers(nil, func(fileName, text string, _ *shimcompiler.WriteFileData) error {
    written[filepath.ToSlash(fileName)] = true
    return nil
  })
  if err != nil {
    t.Fatal(err)
  }
  if len(emitDiags) != 0 {
    t.Fatalf("unexpected emit diagnostics: %#v", emitDiags)
  }

  outDir := filepath.ToSlash(filepath.Join(project, "dist")) + "/"
  declarationDir := filepath.ToSlash(filepath.Join(project, "types")) + "/"
  saw := map[string]bool{}
  for file := range written {
    if !strings.HasPrefix(file, outDir) && !strings.HasPrefix(file, declarationDir) {
      t.Fatalf("emit escaped outDir and declarationDir: %s (all writes: %v)", file, sortedBoolKeys(written))
    }
    switch {
    case strings.HasSuffix(file, "/main.js"):
      saw["main.js"] = true
    case strings.HasSuffix(file, "/main.js.map"):
      saw["main.js.map"] = true
    case strings.HasSuffix(file, "/main.d.ts"):
      saw["main.d.ts"] = true
    case strings.HasSuffix(file, "/main.d.ts.map"):
      saw["main.d.ts.map"] = true
    }
  }
  for _, name := range []string{"main.js", "main.js.map", "main.d.ts", "main.d.ts.map"} {
    if !saw[name] {
      t.Fatalf("%s was not emitted; wrote %v", name, sortedBoolKeys(written))
    }
  }
}

func sortedStringKeys(m map[string]string) []string {
  out := make([]string, 0, len(m))
  for key := range m {
    out = append(out, key)
  }
  sort.Strings(out)
  return out
}

func sortedBoolKeys(m map[string]bool) []string {
  out := make([]string, 0, len(m))
  for key := range m {
    out = append(out, key)
  }
  sort.Strings(out)
  return out
}

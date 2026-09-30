package evidence

import (
  "encoding/json"
  "fmt"
  "os"
  "path/filepath"
  "sort"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcore "github.com/microsoft/typescript-go/shim/core"
  shimparser "github.com/microsoft/typescript-go/shim/parser"

  "github.com/samchon/ttsc/packages/lint/rule"
)

// These benchmarks exist because a TypeScript reference selects modules and
// then walks what they publish, so the population's cost follows the shape of
// the code rather than the size of the configuration.
//
// Two axes are measured separately. `WideModule` grows the declarations inside
// one module, which is what a generated declaration barrel does. `SharedModule`
// grows the number of selected modules that reach one wide module, which is
// what a glob over a package with several entry points does. `WatchCycle`
// measures what a watch cycle actually repeats: the graph rebuild over a
// Program that is already parsed, where the traversal is the whole cost rather
// than a fraction of parsing. `WatchCycleErpScale` puts that last one at the
// size the failure in upstream lint-plugin-evidence#155 was measured at, so the numbers here are
// answerable against a real application rather than only against each other.
//
// Run them with `go test -run XXX -bench . -benchtime 30x ./native`.

// writeWideModule writes one module declaring `units` exported interfaces.
func writeWideModule(b *testing.B, root string, relative string, units int) {
  b.Helper()
  body := ""
  for unit := 0; unit < units; unit++ {
    body += fmt.Sprintf("export interface IUnit%d { value: string }\n", unit)
  }
  location := filepath.Join(root, filepath.FromSlash(relative))
  if err := os.MkdirAll(filepath.Dir(location), 0o755); err != nil {
    b.Fatal(err)
  }
  if err := os.WriteFile(location, []byte(body), 0o644); err != nil {
    b.Fatal(err)
  }
}

func benchmarkWideModule(b *testing.B, units int) {
  root := b.TempDir()
  writeWideModule(b, root, "src/wide.ts", units)
  if err := os.WriteFile(
    filepath.Join(root, "src", "index.ts"),
    []byte("export * from \"./wide.js\";\n"),
    0o644,
  ); err != nil {
    b.Fatal(err)
  }
  entries := []string{"src/wide.ts", "src/index.ts"}
  symbols := symbolSet{"type": true}
  loader := newTypeScriptLoader(root, nil)
  if warm := materializeEntryUnits(loader, entries, symbols); len(warm.Units) != units {
    b.Fatalf("fixture materialized %d units, expected %d", len(warm.Units), units)
  }
  b.ResetTimer()
  for iteration := 0; iteration < b.N; iteration++ {
    materializeEntryUnits(loader, entries, symbols)
  }
}

func BenchmarkTraversalWideModule20(b *testing.B)  { benchmarkWideModule(b, 20) }
func BenchmarkTraversalWideModule80(b *testing.B)  { benchmarkWideModule(b, 80) }
func BenchmarkTraversalWideModule320(b *testing.B) { benchmarkWideModule(b, 320) }

func benchmarkSharedModule(b *testing.B, barrels int, units int) {
  root := b.TempDir()
  writeWideModule(b, root, "src/shared.ts", units)
  entries := []string{"src/shared.ts"}
  for barrel := 0; barrel < barrels; barrel++ {
    relative := fmt.Sprintf("src/barrel%d.ts", barrel)
    if err := os.WriteFile(
      filepath.Join(root, filepath.FromSlash(relative)),
      []byte("export * from \"./shared.js\";\n"),
      0o644,
    ); err != nil {
      b.Fatal(err)
    }
    entries = append(entries, relative)
  }
  symbols := symbolSet{"type": true}
  loader := newTypeScriptLoader(root, nil)
  if warm := materializeEntryUnits(loader, entries, symbols); len(warm.Units) != units {
    b.Fatalf("fixture materialized %d units, expected %d", len(warm.Units), units)
  }
  b.ResetTimer()
  for iteration := 0; iteration < b.N; iteration++ {
    materializeEntryUnits(loader, entries, symbols)
  }
}

func BenchmarkTraversalSharedModule4(b *testing.B)  { benchmarkSharedModule(b, 4, 100) }
func BenchmarkTraversalSharedModule16(b *testing.B) { benchmarkSharedModule(b, 16, 100) }

// benchmarkGraphRebuild rebuilds the graph over an already-parsed Program,
// which is the work a `ttsc check --watch` cycle repeats after every keystroke.
//
// The fixture is the shape a generated backend has: one barrel nesting every
// operation module, one wide declaration module beside them, and a test suite
// claiming the whole population.
func benchmarkGraphRebuild(
  b *testing.B,
  operations int,
  dtos int,
  properties int,
  tests int,
) {
  files := map[string]string{}
  barrel := "export * as structures from \"./structures.js\";\n"
  structures := ""
  for dto := 0; dto < dtos; dto++ {
    body := ""
    for property := 0; property < properties; property++ {
      body += fmt.Sprintf(" field%d: string;", property)
    }
    structures += fmt.Sprintf("export interface IDto%d {%s }\n", dto, body)
  }
  files["src/api/structures.ts"] = structures
  for operation := 0; operation < operations; operation++ {
    files[fmt.Sprintf("src/api/op%d.ts", operation)] = fmt.Sprintf(
      "export function operation%d(): void {}\n",
      operation,
    )
    barrel += fmt.Sprintf(
      "export * as op%d from \"./op%d.js\";\n",
      operation,
      operation,
    )
  }
  files["src/api/index.ts"] = barrel
  for test := 0; test < tests; test++ {
    files[fmt.Sprintf("test/features/test%d.ts", test)] = fmt.Sprintf(
      "export function test_case%d(): void {}\n",
      test,
    )
  }
  const config = `{"claims":[{
    "type":"typescript",
    "files":["test/features/**"],
    "symbol":"function",
    "reference":{"type":"typescript","files":["src/api/**"],"symbol":["type","function","property"]}
  }]}`

  root := b.TempDir()
  paths := make([]string, 0, len(files))
  for path := range files {
    paths = append(paths, path)
  }
  sort.Strings(paths)
  sources := []*shimast.SourceFile{}
  for _, relative := range paths {
    absolute := filepath.Join(root, filepath.FromSlash(relative))
    if err := os.MkdirAll(filepath.Dir(absolute), 0o755); err != nil {
      b.Fatal(err)
    }
    if err := os.WriteFile(absolute, []byte(files[relative]), 0o644); err != nil {
      b.Fatal(err)
    }
    sources = append(sources, shimparser.ParseSourceFile(
      shimast.SourceFileParseOptions{FileName: filepath.ToSlash(absolute)},
      files[relative],
      shimcore.ScriptKindTS,
    ))
  }
  b.ResetTimer()
  for iteration := 0; iteration < b.N; iteration++ {
    graphRule{}.Check(rule.NewProjectContext(
      rule.ProjectIdentity{PhysicalProjectRoot: root},
      sources,
      nil,
      rule.SeverityError,
      json.RawMessage(config),
      &capturedProjectReporter{},
    ))
  }
}

func BenchmarkWatchCycleSdk50(b *testing.B)  { benchmarkGraphRebuild(b, 50, 50, 3, 1) }
func BenchmarkWatchCycleSdk200(b *testing.B) { benchmarkGraphRebuild(b, 200, 200, 3, 1) }

// The sizes here are the ones upstream lint-plugin-evidence#155 measured on a completed application,
// so these numbers are answerable against a real project rather than only
// against each other.
func BenchmarkWatchCycleErpScale(b *testing.B) {
  benchmarkGraphRebuild(b, 663, 124, 10, 1326)
}

func BenchmarkWatchCycleErpScaleHalf(b *testing.B) {
  benchmarkGraphRebuild(b, 331, 62, 10, 663)
}

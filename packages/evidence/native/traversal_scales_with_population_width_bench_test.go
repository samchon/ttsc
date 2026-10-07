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
// size of a completed application, so the numbers here are answerable against
// a real application rather than only against each other.
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

/**
 * Measures traversal of one 20-declaration module behind a barrel.
 *
 * @evidence contracts/testing.md#behavioral-verification BenchmarkTraversalWideModule20 times repeated materializeEntryUnits over a module that exports 20 interfaces. The warm-up call fails the benchmark unless exactly 20 units materialize.
 * @evidence contracts/testing.md#independent-expectations The only expectation is the authored fixture size, written as a literal in the call; no duration is asserted, so a slowdown is observed by comparing benchmark output between runs, not detected by this entry.
 * @evidence contracts/testing.md#distinguishing-cases The sibling benchmarks of this file vary one dimension while keeping the others fixed, so the output of the family shows how cost grows with that dimension; this entry owns one point on that curve.
 * @evidence contracts/testing.md#execution-ownership BenchmarkTraversalWideModule20 is a Go benchmark entry of package evidence. It runs only under go test -bench in the package process, never in the ordinary go test run, and starts no child process.
 */
func BenchmarkTraversalWideModule20(b *testing.B) { benchmarkWideModule(b, 20) }

/**
 * Measures traversal of one 80-declaration module behind a barrel.
 *
 * @evidence contracts/testing.md#behavioral-verification BenchmarkTraversalWideModule80 times repeated materializeEntryUnits over a module that exports 80 interfaces. The warm-up call fails the benchmark unless exactly 80 units materialize.
 * @evidence contracts/testing.md#independent-expectations The only expectation is the authored fixture size, written as a literal in the call; no duration is asserted, so a slowdown is observed by comparing benchmark output between runs, not detected by this entry.
 * @evidence contracts/testing.md#distinguishing-cases The sibling benchmarks of this file vary one dimension while keeping the others fixed, so the output of the family shows how cost grows with that dimension; this entry owns one point on that curve.
 * @evidence contracts/testing.md#execution-ownership BenchmarkTraversalWideModule80 is a Go benchmark entry of package evidence. It runs only under go test -bench in the package process, never in the ordinary go test run, and starts no child process.
 */
func BenchmarkTraversalWideModule80(b *testing.B) { benchmarkWideModule(b, 80) }

/**
 * Measures traversal of one 320-declaration module behind a barrel.
 *
 * @evidence contracts/testing.md#behavioral-verification BenchmarkTraversalWideModule320 times repeated materializeEntryUnits over a module that exports 320 interfaces. The warm-up call fails the benchmark unless exactly 320 units materialize.
 * @evidence contracts/testing.md#independent-expectations The only expectation is the authored fixture size, written as a literal in the call; no duration is asserted, so a slowdown is observed by comparing benchmark output between runs, not detected by this entry.
 * @evidence contracts/testing.md#distinguishing-cases The sibling benchmarks of this file vary one dimension while keeping the others fixed, so the output of the family shows how cost grows with that dimension; this entry owns one point on that curve.
 * @evidence contracts/testing.md#execution-ownership BenchmarkTraversalWideModule320 is a Go benchmark entry of package evidence. It runs only under go test -bench in the package process, never in the ordinary go test run, and starts no child process.
 */
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

/**
 * Measures traversal when four selected barrels reach one 100-declaration module.
 *
 * @evidence contracts/testing.md#behavioral-verification BenchmarkTraversalSharedModule4 times repeated materializeEntryUnits over four barrels that re-export one module of 100 interfaces. The warm-up call fails the benchmark unless exactly 100 units materialize, so a barrel never counts the shared module twice.
 * @evidence contracts/testing.md#independent-expectations The only expectation is the authored fixture size, written as a literal in the call; no duration is asserted, so a slowdown is observed by comparing benchmark output between runs, not detected by this entry.
 * @evidence contracts/testing.md#distinguishing-cases The sibling benchmarks of this file vary one dimension while keeping the others fixed, so the output of the family shows how cost grows with that dimension; this entry owns one point on that curve.
 * @evidence contracts/testing.md#execution-ownership BenchmarkTraversalSharedModule4 is a Go benchmark entry of package evidence. It runs only under go test -bench in the package process, never in the ordinary go test run, and starts no child process.
 */
func BenchmarkTraversalSharedModule4(b *testing.B) { benchmarkSharedModule(b, 4, 100) }

/**
 * Measures traversal when sixteen selected barrels reach one 100-declaration module.
 *
 * @evidence contracts/testing.md#behavioral-verification BenchmarkTraversalSharedModule16 times repeated materializeEntryUnits over sixteen barrels that re-export one module of 100 interfaces. The warm-up call fails the benchmark unless exactly 100 units materialize, so a barrel never counts the shared module twice.
 * @evidence contracts/testing.md#independent-expectations The only expectation is the authored fixture size, written as a literal in the call; no duration is asserted, so a slowdown is observed by comparing benchmark output between runs, not detected by this entry.
 * @evidence contracts/testing.md#distinguishing-cases The sibling benchmarks of this file vary one dimension while keeping the others fixed, so the output of the family shows how cost grows with that dimension; this entry owns one point on that curve.
 * @evidence contracts/testing.md#execution-ownership BenchmarkTraversalSharedModule16 is a Go benchmark entry of package evidence. It runs only under go test -bench in the package process, never in the ordinary go test run, and starts no child process.
 */
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

/**
 * Measures one graph rebuild over a parsed Program of 50 operations and 50 DTOs.
 *
 * @evidence contracts/testing.md#behavioral-verification BenchmarkWatchCycleSdk50 times repeated graphRule.Check over a parsed Program with 50 operation modules, 50 DTOs of 3 properties and one test module. It asserts nothing about the diagnostics the rebuild returns; it measures the rebuild cost alone.
 * @evidence contracts/testing.md#independent-expectations The only expectation is the authored fixture size, written as a literal in the call; no duration is asserted, so a slowdown is observed by comparing benchmark output between runs, not detected by this entry.
 * @evidence contracts/testing.md#distinguishing-cases The sibling benchmarks of this file vary one dimension while keeping the others fixed, so the output of the family shows how cost grows with that dimension; this entry owns one point on that curve.
 * @evidence contracts/testing.md#execution-ownership BenchmarkWatchCycleSdk50 is a Go benchmark entry of package evidence. It runs only under go test -bench in the package process, never in the ordinary go test run, and starts no child process.
 */
func BenchmarkWatchCycleSdk50(b *testing.B) { benchmarkGraphRebuild(b, 50, 50, 3, 1) }

/**
 * Measures one graph rebuild over a parsed Program of 200 operations and 200 DTOs.
 *
 * @evidence contracts/testing.md#behavioral-verification BenchmarkWatchCycleSdk200 times repeated graphRule.Check over a parsed Program with 200 operation modules, 200 DTOs of 3 properties and one test module. It asserts nothing about the diagnostics the rebuild returns; it measures the rebuild cost alone.
 * @evidence contracts/testing.md#independent-expectations The only expectation is the authored fixture size, written as a literal in the call; no duration is asserted, so a slowdown is observed by comparing benchmark output between runs, not detected by this entry.
 * @evidence contracts/testing.md#distinguishing-cases The sibling benchmarks of this file vary one dimension while keeping the others fixed, so the output of the family shows how cost grows with that dimension; this entry owns one point on that curve.
 * @evidence contracts/testing.md#execution-ownership BenchmarkWatchCycleSdk200 is a Go benchmark entry of package evidence. It runs only under go test -bench in the package process, never in the ordinary go test run, and starts no child process.
 */
func BenchmarkWatchCycleSdk200(b *testing.B) { benchmarkGraphRebuild(b, 200, 200, 3, 1) }

/**
 * Measures one graph rebuild at the size of a completed ERP application.
 *
 * @evidence contracts/testing.md#behavioral-verification BenchmarkWatchCycleErpScale times repeated graphRule.Check over a parsed Program with 663 operation modules, 124 DTOs of 10 properties and 1326 test modules. It asserts nothing about the diagnostics the rebuild returns; it measures the rebuild cost alone.
 * @evidence contracts/testing.md#independent-expectations The only expectation is the authored fixture size, written as a literal in the call; no duration is asserted, so a slowdown is observed by comparing benchmark output between runs, not detected by this entry.
 * @evidence contracts/testing.md#distinguishing-cases The sibling benchmarks of this file vary one dimension while keeping the others fixed, so the output of the family shows how cost grows with that dimension; this entry owns one point on that curve.
 * @evidence contracts/testing.md#execution-ownership BenchmarkWatchCycleErpScale is a Go benchmark entry of package evidence. It runs only under go test -bench in the package process, never in the ordinary go test run, and starts no child process.
 */
func BenchmarkWatchCycleErpScale(b *testing.B) {
  benchmarkGraphRebuild(b, 663, 124, 10, 1326)
}

/**
 * Measures one graph rebuild at half the size of a completed ERP application.
 *
 * @evidence contracts/testing.md#behavioral-verification BenchmarkWatchCycleErpScaleHalf times repeated graphRule.Check over a parsed Program with 331 operation modules, 62 DTOs of 10 properties and 663 test modules. It asserts nothing about the diagnostics the rebuild returns; it measures the rebuild cost alone.
 * @evidence contracts/testing.md#independent-expectations The only expectation is the authored fixture size, written as a literal in the call; no duration is asserted, so a slowdown is observed by comparing benchmark output between runs, not detected by this entry.
 * @evidence contracts/testing.md#distinguishing-cases The sibling benchmarks of this file vary one dimension while keeping the others fixed, so the output of the family shows how cost grows with that dimension; this entry owns one point on that curve.
 * @evidence contracts/testing.md#execution-ownership BenchmarkWatchCycleErpScaleHalf is a Go benchmark entry of package evidence. It runs only under go test -bench in the package process, never in the ordinary go test run, and starts no child process.
 */
func BenchmarkWatchCycleErpScaleHalf(b *testing.B) {
  benchmarkGraphRebuild(b, 331, 62, 10, 663)
}

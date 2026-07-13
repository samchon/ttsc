package linthost

import (
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// declarationBenchRules is a value-level rule set (none of it opts into
// declaration files), matching the common case the declaration-file skip
// targets: a normal lint config running over a `.d.ts`-heavy include set.
func declarationBenchRules() RuleConfig {
  return RuleConfig{
    "no-var":                SeverityError,
    "eqeqeq":                SeverityError,
    "object-shorthand":      SeverityError,
    "no-unneeded-ternary":   SeverityError,
    "prefer-template":       SeverityError,
    "dot-notation":          SeverityError,
    "no-extra-boolean-cast": SeverityError,
    "no-debugger":           SeverityError,
    "no-console":            SeverityError,
  }
}

// engineBenchDeclarationSource returns a synthetic declaration file shaped
// like a real `.d.ts`: interfaces, ambient functions and classes, type
// aliases, enums, and namespaces. Repeated so the walk cost dominates.
func engineBenchDeclarationSource() string {
  const block = `
export interface Options_IDX {
  readonly name: string;
  readonly count: number;
  callback(value: string, index: number): boolean;
  nested: { inner: ReadonlyArray<string>; flag?: boolean };
}
export declare function process_IDX(input: Options_IDX, mode?: "fast" | "safe"): Promise<string[]>;
export declare class Worker_IDX {
  readonly id: number;
  constructor(options: Options_IDX);
  run(limit: number): Map<string, number>;
  get state(): "idle" | "busy";
}
export type Result_IDX = Options_IDX | Worker_IDX | null;
export declare enum Flags_IDX {
  None = 0,
  Read = 1,
  Write = 2,
  All = 3,
}
declare namespace internal_IDX {
  interface Hidden {
    value: unknown;
  }
}
`
  var sb strings.Builder
  for i := 0; i < 40; i++ {
    sb.WriteString(strings.ReplaceAll(block, "_IDX", "_"+digitsFor(i)))
  }
  return sb.String()
}

// BenchmarkEngineRunOverDeclarationFile measures Engine.Run over a
// declaration file with a value-level rule config — the case issue #177's
// skip targets. With no rule opting into declaration files the engine
// binds nothing and skips the whole walk, so the per-op cost should be a
// small constant (severity resolution + directive parse), not a function
// of file size.
//
// Compare against BenchmarkEngineRunOverDeclarationShapedValueFile (the
// identical input walked as a normal source) to see the saving in one run:
//
//  node scripts/bench-go-lint.cjs -bench=OverDeclaration
func BenchmarkEngineRunOverDeclarationFile(b *testing.B) {
  file := parseBenchTSFile(b, "/virtual/bench.d.ts", engineBenchDeclarationSource())
  file.IsDeclarationFile = true
  rules := declarationBenchRules()
  files := []*shimast.SourceFile{file}
  b.ResetTimer()
  b.ReportAllocs()
  for i := 0; i < b.N; i++ {
    engine := NewEngine(rules)
    engine.SetSerial(true)
    _ = engine.Run(files, nil)
  }
}

// BenchmarkEngineRunOverDeclarationShapedValueFile is the control for
// BenchmarkEngineRunOverDeclarationFile: the same source walked WITHOUT the
// declaration-file flag, paying the full dispatch walk. The gap between the
// two is the saving the declaration-file skip buys.
func BenchmarkEngineRunOverDeclarationShapedValueFile(b *testing.B) {
  file := parseBenchTSFile(b, "/virtual/bench-shaped.ts", engineBenchDeclarationSource())
  rules := declarationBenchRules()
  files := []*shimast.SourceFile{file}
  b.ResetTimer()
  b.ReportAllocs()
  for i := 0; i < b.N; i++ {
    engine := NewEngine(rules)
    engine.SetSerial(true)
    _ = engine.Run(files, nil)
  }
}

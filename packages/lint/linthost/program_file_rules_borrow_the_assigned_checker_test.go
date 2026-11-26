package linthost

import (
  "context"
  "path/filepath"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimchecker "github.com/microsoft/typescript-go/shim/checker"
)

type checkerAffinityRule struct {
  Rule
  t    *testing.T
  want map[*shimast.SourceFile]*shimchecker.Checker
}

func (r checkerAffinityRule) Check(ctx *Context, node *shimast.Node) {
  if ctx.Checker != r.want[ctx.File] {
    r.t.Errorf("%s: file rule did not receive its Program checker", ctx.File.FileName())
  }
  r.Rule.Check(ctx, node)
}

// TestProgramFileRulesBorrowTheAssignedChecker verifies the actual built-in
// rule sees the same checker that owns each file's semantic diagnostics.
//
//  1. Check a multi-file project on the compiler's ordinary diagnostic path.
//  2. Compare each rule binding with the compiler's checker for that file.
//  3. Verify semantic and lint findings, file order, and release of each lease.
//
// @evidence contracts/testing.md#behavioral-verification Wraps the actual await-thenable check to observe its checker and asserts independent diagnostics. Reacquiring the checkers after the walk requires the leases to have been released.
// @evidence contracts/testing.md#independent-expectations The upstream exclusive API supplies each expected checker. The authored invalid assignment and awaits independently specify the compiler error and two lint warnings.
// @evidence contracts/testing.md#distinguishing-cases Parallel and single-threaded configurations run the same checks; the Promise is an adjacent allowed case and the other two awaits must report in input order.
// @evidence contracts/testing.md#execution-ownership The Go unit exercises the actual Program and lint engine over temporary files without installing or launching a host.
func TestProgramFileRulesBorrowTheAssignedChecker(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{"compilerOptions":{"target":"es2022","strict":true},"files":["a.ts","b.ts","c.ts"]}`)
  writeFile(t, filepath.Join(root, "a.ts"), "export async function a() { await 1; }\n")
  writeFile(t, filepath.Join(root, "b.ts"), "export async function b() { await Promise.resolve(1); }\n")
  writeFile(t, filepath.Join(root, "c.ts"), "export async function c() { await false; }\nconst invalid: string = 1;\n")
  const name = "typescript/await-thenable"
  for _, single := range []bool{false, true} {
    engine := NewEngine(RuleConfig{name: SeverityWarn})
    prog, diags, err := loadProgram(root, "tsconfig.json", loadProgramOptions{
      checkers: 4, singleThreaded: single, needsRuleChecker: engine.needsStandalone,
    })
    if err != nil || len(diags) != 0 || prog == nil {
      t.Fatalf("load (single=%v): program=%v diagnostics=%v error=%v", single, prog, diags, err)
    }
    defer prog.close()
    if prog.checker != nil {
      t.Fatal("built-in file rule created a standalone checker")
    }
    if got := prog.programDiagnostics(); len(got) != 1 || got[0].Code() != 2322 {
      t.Fatalf("want only the invalid assignment diagnostic, got %v", got)
    }
    files := prog.userSourceFiles()
    want := make(map[*shimast.SourceFile]*shimchecker.Checker, len(files))
    for _, file := range files {
      checker, release := prog.tsProgram.GetTypeCheckerForFileExclusive(context.Background(), file)
      want[file] = checker
      release()
    }
    for kind, rules := range engine.rules {
      for i, rule := range rules {
        if rule.Name() == name {
          engine.rules[kind][i] = checkerAffinityRule{Rule: rule, t: t, want: want}
        }
      }
    }
    got := prog.runLintCycle(engine)
    if len(got) != 2 || got[0].File != files[0] || got[1].File != files[2] ||
      got[0].Rule != name || got[1].Rule != name || got[0].Severity != SeverityWarn || got[1].Severity != SeverityWarn {
      t.Fatalf("want await warnings in a.ts and c.ts in source order, got %v", got)
    }
    for _, file := range files {
      _, release := prog.tsProgram.GetTypeCheckerForFileExclusive(context.Background(), file)
      release()
    }
  }
}

package linthost

import (
  "path/filepath"
  "sync"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimchecker "github.com/microsoft/typescript-go/shim/checker"

  publicrule "github.com/samchon/ttsc/packages/lint/rule"
)

// TestProgramContributorsShareStandaloneChecker verifies both public file rule
// adapters use the program's standalone checker.
//
//  1. Enable a contributor and a formatter in separate lint cycles.
//  2. Load a multi-file program with four compiler checkers.
//  3. Compare each observed checker with the standalone checker.
//
// @evidence contracts/testing.md#behavioral-verification The registered contributor adapters run over the actual lint program with its real checker allocation.
// @evidence contracts/testing.md#independent-expectations Each checker pointer must be the standalone checker owned by the program, and all four authored source files must be visited.
// @evidence contracts/testing.md#distinguishing-cases The format adapter and ordinary adapter each run in isolation, so the ordinary adapter cannot enable the standalone path on behalf of the formatter.
// @evidence contracts/testing.md#execution-ownership The Go unit owns its temporary source files and restores every test-owned registry entry.
func TestProgramContributorsShareStandaloneChecker(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{"include":["*.ts"]}`)
  files := []string{"a.ts", "b.ts", "c.ts", "d.ts"}
  for _, file := range files {
    writeFile(t, filepath.Join(root, file), "export const value = 1;\n")
  }
  for _, format := range []bool{false, true} {
    contributor := &standaloneCheckerObserver{format: format}
    metadata, err := inspectContributor(contributor)
    if err != nil {
      t.Fatal(err)
    }
    adapter := newContributorAdapter(metadata)
    var rule Rule = adapter
    if metadata.isFormat {
      rule = formatContributorAdapter{adapter}
    }
    registered.rules[metadata.name] = rule
    t.Cleanup(func() { delete(registered.rules, metadata.name) })
    engine := NewEngine(RuleConfig{metadata.name: SeverityWarn})
    prog, diags, err := loadProgram(root, "tsconfig.json", loadProgramOptions{
      checkers: 4, needsRuleChecker: engine.needsStandalone,
    })
    if err != nil || len(diags) != 0 || prog == nil {
      t.Fatalf("load (format=%v): program=%v diagnostics=%v error=%v", format, prog, diags, err)
    }
    defer prog.close()
    prog.runLintCycle(engine)
    if prog.checker == nil || len(contributor.seen) != len(files) {
      t.Fatalf("format=%v: standalone=%p, visits=%d", format, prog.checker, len(contributor.seen))
    }
    for _, checker := range contributor.seen {
      if checker != prog.checker {
        t.Fatalf("format=%v: got checker %p, want %p", format, checker, prog.checker)
      }
    }
  }
}

type standaloneCheckerObserver struct {
  mu     sync.Mutex
  format bool
  seen   []*shimchecker.Checker
}

func (r *standaloneCheckerObserver) Name() string {
  if r.format {
    return "demo/standalone-format-checker"
  }
  return "demo/standalone-lint-checker"
}

func (r *standaloneCheckerObserver) IsFormat() bool { return r.format }

func (*standaloneCheckerObserver) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}

func (r *standaloneCheckerObserver) Check(ctx *publicrule.Context, _ *shimast.Node) {
  r.mu.Lock()
  defer r.mu.Unlock()
  r.seen = append(r.seen, ctx.Checker)
}

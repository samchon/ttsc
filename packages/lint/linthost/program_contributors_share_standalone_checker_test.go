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
// adapters and a directly registered rule use the standalone checker.
//
//  1. Enable a contributor, a formatter and a raw rule in separate lint cycles.
//  2. Load a multi-file program with four compiler checkers.
//  3. Compare each observed checker with the standalone checker.
//
// @evidence contracts/testing.md#behavioral-verification The registered contributor adapters run over the actual lint program with its real checker allocation.
// @evidence contracts/testing.md#independent-expectations Each checker pointer must be the standalone checker owned by the program, and all four authored source files must be visited.
// @evidence contracts/testing.md#distinguishing-cases The two adapters and a directly registered rule each run in isolation, so one rule cannot enable the standalone path on behalf of another.
// @evidence contracts/testing.md#execution-ownership The Go unit owns its temporary source files and restores every test-owned registry entry.
func TestProgramContributorsShareStandaloneChecker(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{"include":["*.ts"]}`)
  files := []string{"a.ts", "b.ts", "c.ts", "d.ts"}
  for _, file := range files {
    writeFile(t, filepath.Join(root, file), "export const value = 1;\n")
  }
  verify := func(rule Rule, observer *standaloneCheckerObserver) {
    name := rule.Name()
    Register(rule)
    t.Cleanup(func() { delete(registered.rules, name); invalidateRuntimeRuleCodes() })
    engine := NewEngine(RuleConfig{name: SeverityWarn})
    prog, diags, err := loadProgram(root, "tsconfig.json", loadProgramOptions{
      checkers: 4, needsRuleChecker: engine.needsStandalone,
    })
    if err != nil || len(diags) != 0 || prog == nil {
      t.Fatalf("load %s: program=%v diagnostics=%v error=%v", name, prog, diags, err)
    }
    defer prog.close()
    prog.runLintCycle(engine)
    if prog.checker == nil || len(observer.seen) != len(files) {
      t.Fatalf("%s: standalone=%p, visits=%d", name, prog.checker, len(observer.seen))
    }
    for _, checker := range observer.seen {
      if checker != prog.checker {
        t.Fatalf("%s: got checker %p, want %p", name, checker, prog.checker)
      }
    }
  }
  for _, format := range []bool{false, true} {
    contributor := &standaloneCheckerObserver{format: format}
    metadata, err := inspectContributor(contributor)
    if err != nil {
      t.Fatal(err)
    }
    adapter := newContributorAdapter(metadata)
    if metadata.isFormat {
      verify(formatContributorAdapter{adapter}, contributor)
    } else {
      verify(adapter, contributor)
    }
  }
  direct := &directCheckerObserver{}
  verify(direct, &direct.standaloneCheckerObserver)
  retired := &standaloneCheckerObserver{name: "solid/jsx-uses-vars"}
  metadata, err := inspectContributor(retired)
  if err != nil {
    t.Fatal(err)
  }
  verify(newContributorAdapter(metadata), retired)
}

// TestASTOnlyFileContributorPreservesNativeCheckerPool verifies that the
// project checker's lifetime does not force an AST-only file rule to share it.
//
// @evidence contracts/testing.md#behavioral-verification Actual rule resolution keeps the native file-checker pool eligible beside a standalone project checker.
// @evidence contracts/testing.md#independent-expectations The project rule declares the conservative default, the built-in needs types, and the external file rule explicitly needs none.
// @evidence contracts/testing.md#distinguishing-cases The three rule capabilities are enabled together rather than tested in separate engines.
// @evidence contracts/testing.md#execution-ownership The unit builds the real rule engine and restores its test-owned registration entries. It checks pool admission, without claiming concurrent execution.
func TestASTOnlyFileContributorPreservesNativeCheckerPool(t *testing.T) {
  project := externalStateProjectRule{}
  registeredProjectRules[project.Name()] = projectRuleAdapter{
    inner: project,
    name:  project.Name(),
  }
  file := &astOnlyCheckerObserver{}
  Register(file)
  t.Cleanup(func() {
    delete(registeredProjectRules, project.Name())
    delete(registered.rules, file.Name())
    invalidateRuntimeRuleCodes()
  })
  engine := NewEngine(RuleConfig{
    project.Name():              SeverityWarn,
    file.Name():                 SeverityWarn,
    "typescript/await-thenable": SeverityWarn,
  })
  if !engine.needsStandalone || !engine.needsFileChecker || engine.needsStandaloneFileChecker {
    t.Fatalf("project standalone=%v, typed files=%v, file standalone=%v",
      engine.needsStandalone, engine.needsFileChecker, engine.needsStandaloneFileChecker)
  }
}

type standaloneCheckerObserver struct {
  mu     sync.Mutex
  format bool
  seen   []*shimchecker.Checker
  name   string
}

func (r *standaloneCheckerObserver) Name() string {
  if r.name != "" {
    return r.name
  }
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
  r.observe(ctx.Checker)
}

func (r *standaloneCheckerObserver) observe(checker *shimchecker.Checker) {
  r.mu.Lock()
  defer r.mu.Unlock()
  r.seen = append(r.seen, checker)
}

type directCheckerObserver struct{ standaloneCheckerObserver }

func (*directCheckerObserver) Name() string { return "demo/direct-standalone-checker" }

func (*directCheckerObserver) NeedsTypeChecker() bool { return true }

func (r *directCheckerObserver) Check(ctx *Context, _ *shimast.Node) {
  r.observe(ctx.Checker)
}

type astOnlyCheckerObserver struct{ directCheckerObserver }

func (*astOnlyCheckerObserver) Name() string { return "demo/ast-only-checker" }

func (*astOnlyCheckerObserver) NeedsTypeChecker() bool { return false }

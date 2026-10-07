package linthost

import (
  "strings"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// TestEngineQuarantinesPanickingRulePerFile verifies a recovered panic disables
// only that rule for the rest of the current file. The failure must remain
// visible even under inline disables, while sibling rules and later files keep
// running normally.
//
//  1. Register a panicking rule and a healthy sibling, then parse two files with
//     specific and blanket inline disables.
//  2. Run serial dispatch over both files to observe deterministic visit counts.
//  3. Require one visible failure per file with its original cause and source,
//     and all six healthy sibling visits; clean up both owned registrations.
//
// @evidence contracts/testing.md#behavioral-verification Real Engine executes a panicking rule only once per file, emits two unsuppressed engine failures with original panic causes and corresponding source identities, while a healthy sibling receives all six visits in each file.
// @evidence contracts/testing.md#independent-expectations Authored two-file sources contain six requested identifier/numeric visits each; literal one panic visit and six sibling visits independently specify per-file quarantine, alongside two error findings and the original throw text.
// @evidence contracts/testing.md#distinguishing-cases Specific and blanket eslint-disable directives must not hide execution failures; repeated matching nodes and a second file distinguish per-file quarantine from permanent disable or aborting unrelated rules. Both sentinel names are checked before registration, and each owned registration has immediate cleanup and derived-code invalidation.
// @evidence contracts/testing.md#execution-ownership Real in-process registration and serial Engine dispatch exercise recovery with deterministic counters and cleanup; intentional failures bypass the semantic guard, and no native producer, install or external process runs.
func TestEngineQuarantinesPanickingRulePerFile(t *testing.T) {
  bomb := &fileQuarantinePanickingRule{checks: map[string]int{}}
  sibling := &fileQuarantineSiblingRule{checks: map[string]int{}}
  for _, rule := range []Rule{bomb, sibling} {
    if LookupRule(rule.Name()) != nil {
      t.Fatalf("quarantine sentinel is already registered: %s", rule.Name())
    }
  }
  Register(bomb)
  t.Cleanup(func() {
    delete(registered.rules, bomb.Name())
    invalidateRuntimeRuleCodes()
  })
  Register(sibling)
  t.Cleanup(func() {
    delete(registered.rules, sibling.Name())
    invalidateRuntimeRuleCodes()
  })

  first := parseTSFile(t, "/virtual/panic-first.ts", `// eslint-disable test/quarantine-panic
const alpha = 1;
alpha;
const beta = 2;
beta;
`)
  second := parseTSFile(t, "/virtual/panic-second.ts", `// eslint-disable
const gamma = 3;
gamma;
const delta = 4;
delta;
`)
  engine := NewEngine(RuleConfig{
    bomb.Name():    SeverityError,
    sibling.Name(): SeverityError,
  })
  engine.SetSerial(true)
  findings := engine.Run([]*shimast.SourceFile{first, second}, nil)

  if got, want := len(findings), 2; got != want {
    t.Fatalf("recovered panic findings = %d, want %d: %+v", got, want, findings)
  }
  for i, finding := range findings {
    if finding.Rule != bomb.Name() || finding.Severity != SeverityError ||
      !strings.Contains(finding.Message, "panicked") {
      t.Fatalf("finding %d is not the unsuppressed engine failure: %+v", i, finding)
    }
    if !finding.engineFailure || !strings.Contains(finding.Message, "synthetic repeated panic") || finding.File != []*shimast.SourceFile{first, second}[i] {
      t.Fatalf("failure %d lost its cause or file identity: %+v", i, finding)
    }
  }

  for _, file := range []*shimast.SourceFile{first, second} {
    name := file.FileName()
    if got, want := bomb.checks[name], 1; got != want {
      t.Fatalf("panicking rule checks for %s = %d, want %d", name, got, want)
    }
    if got, want := sibling.checks[name], 6; got != want {
      t.Fatalf("sibling rule checks for %s = %d, want %d", name, got, want)
    }
  }
}

type fileQuarantinePanickingRule struct {
  checks map[string]int
}

func (*fileQuarantinePanickingRule) Name() string { return "test/quarantine-panic" }
func (*fileQuarantinePanickingRule) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindIdentifier, shimast.KindNumericLiteral}
}
func (r *fileQuarantinePanickingRule) Check(ctx *Context, _ *shimast.Node) {
  r.checks[ctx.File.FileName()]++
  panic("synthetic repeated panic")
}

type fileQuarantineSiblingRule struct {
  checks map[string]int
}

func (*fileQuarantineSiblingRule) Name() string { return "test/quarantine-sibling" }
func (*fileQuarantineSiblingRule) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindIdentifier, shimast.KindNumericLiteral}
}
func (r *fileQuarantineSiblingRule) Check(ctx *Context, _ *shimast.Node) {
  r.checks[ctx.File.FileName()]++
}

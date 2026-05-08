package main

import (
  "sort"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

func TestEngineDispatchesOnlyToInterestedRules(t *testing.T) {
  // Build an engine with two rules enabled. The walker should call
  // each rule only on the kinds it registered for.
  engine := NewEngine(RuleConfig{
    "no-var":      SeverityError,
    "no-debugger": SeverityWarn,
  })
  if got := engine.EnabledRules(); len(got) != 2 {
    t.Fatalf("want 2 enabled rules, got %d", len(got))
  }
  file := parseTS(t, `
    var a = 1;
    debugger;
    var b = 2;
  `)
  findings := engine.Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 3 {
    t.Fatalf("want 3 findings, got %d", len(findings))
  }
  names := map[string]int{}
  for _, f := range findings {
    names[f.Rule]++
  }
  if names["no-var"] != 2 || names["no-debugger"] != 1 {
    t.Errorf("expected 2 no-var + 1 no-debugger, got %v", names)
  }
}

func TestEngineSkipsOffRules(t *testing.T) {
  engine := NewEngine(RuleConfig{
    "no-var": SeverityOff,
  })
  if len(engine.EnabledRules()) != 0 {
    t.Fatalf("want 0 enabled, got %d", len(engine.EnabledRules()))
  }
  file := parseTS(t, "var a = 1;")
  findings := engine.Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 0 {
    t.Errorf("disabled rule should not fire; got %d findings", len(findings))
  }
}

func TestEngineRecordsUnknownRules(t *testing.T) {
  engine := NewEngine(RuleConfig{
    "never-existed": SeverityError,
    "no-var":        SeverityError,
  })
  unknown := engine.UnknownRules()
  if len(unknown) != 1 || unknown[0] != "never-existed" {
    t.Fatalf("want [never-existed], got %v", unknown)
  }
  if _, ok := engine.EnabledRules()["never-existed"]; ok {
    t.Errorf("unknown rule should not be enabled")
  }
  if _, ok := engine.EnabledRules()["no-var"]; !ok {
    t.Errorf("known rule should still be enabled")
  }
}

func TestEngineSkipsDeclarationFiles(t *testing.T) {
  // Declaration files should not be linted (they're library typings).
  // The engine filters them by IsDeclarationFile.
  file := parseTS(t, "var a = 1;")
  file.IsDeclarationFile = true
  engine := NewEngine(RuleConfig{"no-var": SeverityError})
  findings := engine.Run([]*shimast.SourceFile{file}, nil)
  if len(findings) != 0 {
    t.Errorf("declaration files must be skipped; got %d findings", len(findings))
  }
}

func TestEngineRespectsESLintDisableNextLine(t *testing.T) {
  engine := NewEngine(RuleConfig{"no-var": SeverityError})
  file := parseTS(t, `
    var before = 1;
    // eslint-disable-next-line no-var -- deliberate fixture
    var skipped = 2;
    var after = 3;
  `)
  findings := engine.Run([]*shimast.SourceFile{file}, nil)
  if got := len(findings); got != 2 {
    t.Fatalf("want 2 unsuppressed findings, got %d: %v", got, findingRules(findings))
  }
}

func TestEngineRespectsLintDisableNextLineAlias(t *testing.T) {
  engine := NewEngine(RuleConfig{"no-debugger": SeverityError})
  file := parseTS(t, `
    debugger;
    // lint-disable-next-line no-debugger
    debugger;
    debugger;
  `)
  findings := engine.Run([]*shimast.SourceFile{file}, nil)
  if got := len(findings); got != 2 {
    t.Fatalf("want 2 unsuppressed findings, got %d: %v", got, findingRules(findings))
  }
}

func TestEngineRespectsESLintDisableLine(t *testing.T) {
  engine := NewEngine(RuleConfig{"no-var": SeverityError})
  file := parseTS(t, `
    var before = 1;
    var skipped = 2; // eslint-disable-line no-var
    var after = 3;
  `)
  findings := engine.Run([]*shimast.SourceFile{file}, nil)
  if got := len(findings); got != 2 {
    t.Fatalf("want 2 unsuppressed findings, got %d: %v", got, findingRules(findings))
  }
}

func TestEngineRespectsBlockDisableEnable(t *testing.T) {
  engine := NewEngine(RuleConfig{"no-var": SeverityError})
  file := parseTS(t, `
    var before = 1;
    /* eslint-disable no-var */
    var skipped = 2;
    /* eslint-enable no-var */
    var after = 3;
  `)
  findings := engine.Run([]*shimast.SourceFile{file}, nil)
  if got := len(findings); got != 2 {
    t.Fatalf("want 2 unsuppressed findings, got %d: %v", got, findingRules(findings))
  }
}

func TestEngineDirectiveWithoutRulesDisablesAllRulesOnTargetLine(t *testing.T) {
  engine := NewEngine(RuleConfig{
    "no-var":      SeverityError,
    "no-debugger": SeverityError,
  })
  file := parseTS(t, `
    // eslint-disable-next-line
    var skipped = 1; debugger;
    var reported = 2; debugger;
  `)
  findings := engine.Run([]*shimast.SourceFile{file}, nil)
  if got := len(findings); got != 2 {
    t.Fatalf("want 2 unsuppressed findings, got %d: %v", got, findingRules(findings))
  }
}

func TestEngineDirectiveNormalizesTypeScriptESLintRuleNames(t *testing.T) {
  engine := NewEngine(RuleConfig{"no-explicit-any": SeverityError})
  file := parseTS(t, `
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const skipped: any = 1;
    const reported: any = 2;
  `)
  findings := engine.Run([]*shimast.SourceFile{file}, nil)
  if got := len(findings); got != 1 {
    t.Fatalf("want 1 unsuppressed finding, got %d: %v", got, findingRules(findings))
  }
}

func TestEngineIgnoresDirectiveTextInsideStrings(t *testing.T) {
  engine := NewEngine(RuleConfig{"no-var": SeverityError})
  file := parseTS(t, `
    const text = "// eslint-disable-next-line no-var";
    var reported = 1;
  `)
  findings := engine.Run([]*shimast.SourceFile{file}, nil)
  if got := len(findings); got != 1 {
    t.Fatalf("want 1 finding, got %d: %v", got, findingRules(findings))
  }
}

func TestEngineBlockDisableAfterCodeDoesNotSuppressEarlierSameLine(t *testing.T) {
  engine := NewEngine(RuleConfig{"no-var": SeverityError})
  file := parseTS(t, `
    var reported = 1; /* eslint-disable no-var */
    var skipped = 2;
  `)
  findings := engine.Run([]*shimast.SourceFile{file}, nil)
  if got := len(findings); got != 1 {
    t.Fatalf("want 1 finding, got %d: %v", got, findingRules(findings))
  }
}

func TestAllRuleNamesIsSorted(t *testing.T) {
  names := AllRuleNames()
  sorted := append([]string(nil), names...)
  sort.Strings(sorted)
  for i := range names {
    if names[i] != sorted[i] {
      t.Fatalf("AllRuleNames not sorted: %v", names)
    }
  }
  // Sanity: registry has at least the headline rules from the README.
  for _, headline := range []string{"no-var", "no-explicit-any", "no-non-null-assertion", "eqeqeq"} {
    found := false
    for _, n := range names {
      if n == headline {
        found = true
        break
      }
    }
    if !found {
      t.Errorf("missing headline rule %q in registry", headline)
    }
  }
}

func TestRuleCodeIsStable(t *testing.T) {
  // The hashed rule code must be deterministic across runs and inside
  // the (9000, 18000) banner range.
  code := RuleCode("no-var")
  again := RuleCode("no-var")
  if code != again {
    t.Errorf("ruleCode is non-deterministic")
  }
  if code < 9000 || code >= 18000 {
    t.Errorf("ruleCode out of expected band: %d", code)
  }
  // Two distinct rules should not share a code unless we're unlucky;
  // pick names known not to hash-collide with FNV-1a 32-bit.
  a := RuleCode("no-var")
  b := RuleCode("no-debugger")
  if a == b {
    t.Errorf("ruleCode collision for no-var vs no-debugger")
  }
}

func findingRules(findings []*Finding) []string {
  names := make([]string, 0, len(findings))
  for _, finding := range findings {
    names = append(names, finding.Rule)
  }
  sort.Strings(names)
  return names
}

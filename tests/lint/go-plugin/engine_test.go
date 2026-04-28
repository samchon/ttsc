package lint_test

import (
	"sort"
	"testing"

	shimast "github.com/microsoft/typescript-go/shim/ast"

	lintpkg "github.com/samchon/ttsc/packages/lint/go-plugin/lint"
)

func TestEngineDispatchesOnlyToInterestedRules(t *testing.T) {
	// Build an engine with two rules enabled. The walker should call
	// each rule only on the kinds it registered for.
	engine := lintpkg.NewEngine(lintpkg.RuleConfig{
		"no-var":      lintpkg.SeverityError,
		"no-debugger": lintpkg.SeverityWarn,
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
	engine := lintpkg.NewEngine(lintpkg.RuleConfig{
		"no-var": lintpkg.SeverityOff,
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
	engine := lintpkg.NewEngine(lintpkg.RuleConfig{
		"never-existed": lintpkg.SeverityError,
		"no-var":        lintpkg.SeverityError,
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
	engine := lintpkg.NewEngine(lintpkg.RuleConfig{"no-var": lintpkg.SeverityError})
	findings := engine.Run([]*shimast.SourceFile{file}, nil)
	if len(findings) != 0 {
		t.Errorf("declaration files must be skipped; got %d findings", len(findings))
	}
}

func TestAllRuleNamesIsSorted(t *testing.T) {
	names := lintpkg.AllRuleNames()
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
	code := lintpkg.RuleCode("no-var")
	again := lintpkg.RuleCode("no-var")
	if code != again {
		t.Errorf("ruleCode is non-deterministic")
	}
	if code < 9000 || code >= 18000 {
		t.Errorf("ruleCode out of expected band: %d", code)
	}
	// Two distinct rules should not share a code unless we're unlucky;
	// pick names known not to hash-collide with FNV-1a 32-bit.
	a := lintpkg.RuleCode("no-var")
	b := lintpkg.RuleCode("no-debugger")
	if a == b {
		t.Errorf("ruleCode collision for no-var vs no-debugger")
	}
}

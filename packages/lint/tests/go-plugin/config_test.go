package lint_test

import (
	lintpkg "github.com/samchon/ttsc/packages/lint/go-plugin/lint"

	"strings"
	"testing"
)

func TestParseRulesAcceptsStringSeverities(t *testing.T) {
	cfg, err := lintpkg.ParseRules(map[string]any{
		"no-var":         "error",
		"no-explicit-any": "warn",
		"no-debugger":    "off",
		"eqeqeq":         "WARNING",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.Severity("no-var") != lintpkg.SeverityError {
		t.Errorf("no-var: want error, got %v", cfg.Severity("no-var"))
	}
	if cfg.Severity("no-explicit-any") != lintpkg.SeverityWarn {
		t.Errorf("no-explicit-any: want warn, got %v", cfg.Severity("no-explicit-any"))
	}
	if cfg.Severity("no-debugger") != lintpkg.SeverityOff {
		t.Errorf("no-debugger: want off, got %v", cfg.Severity("no-debugger"))
	}
	if cfg.Severity("eqeqeq") != lintpkg.SeverityWarn {
		t.Errorf("eqeqeq (WARNING alias): want warn, got %v", cfg.Severity("eqeqeq"))
	}
	// Unconfigured rule defaults to off.
	if cfg.Severity("not-listed") != lintpkg.SeverityOff {
		t.Errorf("unlisted rule: want off, got %v", cfg.Severity("not-listed"))
	}
}

func TestParseRulesAcceptsNumericSeverities(t *testing.T) {
	cfg, err := lintpkg.ParseRules(map[string]any{
		"a": float64(0),
		"b": float64(1),
		"c": float64(2),
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.Severity("a") != lintpkg.SeverityOff || cfg.Severity("b") != lintpkg.SeverityWarn || cfg.Severity("c") != lintpkg.SeverityError {
		t.Errorf("numeric severities not parsed correctly: %+v", cfg)
	}
}

func TestParseRulesRejectsNonsense(t *testing.T) {
	if _, err := lintpkg.ParseRules(map[string]any{"foo": "kaboom"}); err == nil {
		t.Errorf("expected error for unknown severity")
	}
	if _, err := lintpkg.ParseRules(map[string]any{"foo": float64(99)}); err == nil {
		t.Errorf("expected error for out-of-range severity")
	}
	if _, err := lintpkg.ParseRules(map[string]any{"foo": []string{"warn"}}); err == nil {
		t.Errorf("expected error for non-string-or-number severity")
	}
}

func TestParseRulesNilTreatedAsEmpty(t *testing.T) {
	cfg, err := lintpkg.ParseRules(nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(cfg) != 0 {
		t.Errorf("want empty config, got %v", cfg)
	}
}

func TestParsePluginsRoundTrip(t *testing.T) {
	const blob = `[
		{"name": "@ttsc/lint", "mode": "ttsc-lint", "contractVersion": 1, "config": {"rules": {"no-var": "error"}}}
	]`
	entries, err := lintpkg.ParsePlugins(blob)
	if err != nil {
		t.Fatalf("lintpkg.ParsePlugins: %v", err)
	}
	if len(entries) != 1 {
		t.Fatalf("want 1 entry, got %d", len(entries))
	}
	entry := lintpkg.FindLintEntry(entries)
	if entry == nil {
		t.Fatal("lintpkg.FindLintEntry returned nil")
	}
	if entry.Mode != "ttsc-lint" {
		t.Errorf("entry.Mode: want ttsc-lint, got %q", entry.Mode)
	}
	cfg, err := lintpkg.ParseRules(entry.Config["rules"])
	if err != nil {
		t.Fatalf("lintpkg.ParseRules: %v", err)
	}
	if cfg.Severity("no-var") != lintpkg.SeverityError {
		t.Errorf("no-var severity: want error, got %v", cfg.Severity("no-var"))
	}
}

func TestParsePluginsRejectsBadJSON(t *testing.T) {
	if _, err := lintpkg.ParsePlugins("not-json"); err == nil {
		t.Error("expected error for malformed JSON")
	} else if !strings.Contains(err.Error(), "invalid --plugins-json") {
		t.Errorf("error should mention plugins-json: %v", err)
	}
}

package main

import (
	"strings"
	"testing"
)

func TestParseRulesAcceptsStringSeverities(t *testing.T) {
	cfg, err := ParseRules(map[string]any{
		"no-var":          "error",
		"no-explicit-any": "warning",
		"no-debugger":     "off",
		"eqeqeq":          "warn",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.Severity("no-var") != SeverityError {
		t.Errorf("no-var: want error, got %v", cfg.Severity("no-var"))
	}
	if cfg.Severity("no-explicit-any") != SeverityWarn {
		t.Errorf("no-explicit-any: want warning, got %v", cfg.Severity("no-explicit-any"))
	}
	if cfg.Severity("no-debugger") != SeverityOff {
		t.Errorf("no-debugger: want off, got %v", cfg.Severity("no-debugger"))
	}
	if cfg.Severity("eqeqeq") != SeverityWarn {
		t.Errorf("eqeqeq: want warning, got %v", cfg.Severity("eqeqeq"))
	}
	// Unconfigured rule defaults to off.
	if cfg.Severity("not-listed") != SeverityOff {
		t.Errorf("unlisted rule: want off, got %v", cfg.Severity("not-listed"))
	}
}

func TestParseRulesAcceptsLegacyNumericSeverities(t *testing.T) {
	cfg, err := ParseRules(map[string]any{
		"a": float64(0),
		"b": float64(1),
		"c": float64(2),
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.Severity("a") != SeverityOff || cfg.Severity("b") != SeverityWarn || cfg.Severity("c") != SeverityError {
		t.Errorf("numeric severities not parsed correctly: %+v", cfg)
	}
}

func TestParseRulesNilTreatedAsEmpty(t *testing.T) {
	cfg, err := ParseRules(nil)
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
	entries, err := ParsePlugins(blob)
	if err != nil {
		t.Fatalf("ParsePlugins: %v", err)
	}
	if len(entries) != 1 {
		t.Fatalf("want 1 entry, got %d", len(entries))
	}
	entry, err := FindLintEntry(entries)
	if err != nil {
		t.Fatalf("FindLintEntry: %v", err)
	}
	if entry == nil {
		t.Fatal("FindLintEntry returned nil")
	}
	if entry.Mode != "ttsc-lint" {
		t.Errorf("entry.Mode: want ttsc-lint, got %q", entry.Mode)
	}
	cfg, err := ParseRules(entry.Config["rules"])
	if err != nil {
		t.Fatalf("ParseRules: %v", err)
	}
	if cfg.Severity("no-var") != SeverityError {
		t.Errorf("no-var severity: want error, got %v", cfg.Severity("no-var"))
	}
}

func TestFindLintEntryRejectsNonFirstLintPlugin(t *testing.T) {
	const blob = `[
		{"name": "source-transform", "mode": "source-transform", "contractVersion": 1, "config": {}},
		{"name": "@ttsc/lint", "mode": "ttsc-lint", "contractVersion": 1, "config": {"rules": {"no-var": "error"}}}
	]`
	entries, err := ParsePlugins(blob)
	if err != nil {
		t.Fatalf("ParsePlugins: %v", err)
	}
	entry, err := FindLintEntry(entries)
	if err == nil {
		t.Fatal("expected non-first @ttsc/lint entry to fail")
	}
	if entry != nil {
		t.Fatalf("entry should be nil on placement error, got %+v", entry)
	}
	if !strings.Contains(err.Error(), "first active compilerOptions.plugins entry") {
		t.Fatalf("error should explain plugin placement, got %v", err)
	}
}

func TestParsePluginsRejectsBadJSON(t *testing.T) {
	if _, err := ParsePlugins("not-json"); err == nil {
		t.Error("expected error for malformed JSON")
	} else if !strings.Contains(err.Error(), "invalid --plugins-json") {
		t.Errorf("error should mention plugins-json: %v", err)
	}
}

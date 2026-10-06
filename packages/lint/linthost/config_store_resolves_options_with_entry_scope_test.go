package linthost

import (
	"encoding/json"
	"path/filepath"
	"testing"
)

// TestConfigStoreResolvesOptionsWithEntryScope verifies the severity/options fold
// to the same matching ConfigEntry sequence. A tuple from a sibling files
// selector must not become the option payload for an unrelated file.
//
// 1. Declare global, test, generated and globally ignored entries.
// 2. Resolve main, test and vendor files and compare their exact rule payloads.
// 3. Mutate one returned payload and require a later resolution to retain the original bytes.
//
// @evidence contracts/testing.md#behavioral-verification ConfigStore.ResolveRules selects paired severity/options for main and test files, ignores vendor without options, preserves unrelated custom-rule settings, contrasts inherited no-debugger error with the locally ignored functional path and returns defensively copied option bytes.
// @evidence contracts/testing.md#independent-expectations The authored disjoint files selectors and literal payloads establish the expected matches; The literal inherited no-debugger error and local functional ignore require error/off without invoking an executable config loader; mutating one returned byte buffer must not change the independently known original config payload.
// @evidence contracts/testing.md#distinguishing-cases Owns matching and nonmatching sibling tuples (the generated/** entry matches none of the resolved paths and must leak into none), unrelated rule, globally ignored file, the normal/functional error-off distinction, and read-mutate-read isolation of retained config state.
// @evidence contracts/testing.md#execution-ownership This discoverable Go entry owns the case described above. Authored ConfigStore entries resolve main, test and vendor paths directly in the shared Go process; option-buffer mutation and a second resolution exercise retained-state isolation without a native producer or script evaluator.
func TestConfigStoreResolvesOptionsWithEntryScope(t *testing.T) {
	root := t.TempDir()
	store := &ConfigStore{entries: []ConfigEntry{
		{
			BaseDir: root,
			Rules: RuleConfig{
				"no-restricted-syntax": SeverityError,
				"custom/rule":          SeverityWarn,
				"no-debugger":          SeverityError,
			},
			Options: RuleOptionsMap{
				"no-restricted-syntax": json.RawMessage(`"VariableDeclaration"`),
				"custom/rule":          json.RawMessage(`{"mode":"base"}`),
			},
		},
		{
			BaseDir: root,
			Files:   []string{"tests/**"},
			Rules:   RuleConfig{"no-restricted-syntax": SeverityWarn},
			Options: RuleOptionsMap{"no-restricted-syntax": json.RawMessage(`"DebuggerStatement"`)},
		},
		{
			BaseDir: root,
			Files:   []string{"generated/**"},
			Rules: RuleConfig{
				"no-restricted-syntax": SeverityError,
				"custom/rule":          SeverityError,
			},
			Options: RuleOptionsMap{
				"no-restricted-syntax": json.RawMessage(`"WithStatement"`),
				"custom/rule":          json.RawMessage(`{"mode":"generated"}`),
			},
		},
		{
			BaseDir:    root,
			Ignores:    []string{"vendor/**", "src/functional/**/*.ts"},
			IgnoreOnly: true,
		},
	}}

	main := store.ResolveRules(filepath.Join(root, "src", "main.ts"))
	if main.Ignored || main.Rules.Severity("no-restricted-syntax") != SeverityError ||
		string(main.RuleOptions("no-restricted-syntax")) != `"VariableDeclaration"` {
		t.Fatalf("main resolution crossed an entry boundary: %+v options=%s", main, main.RuleOptions("no-restricted-syntax"))
	}
	if main.Rules.Severity("custom/rule") != SeverityWarn ||
		string(main.RuleOptions("custom/rule")) != `{"mode":"base"}` {
		t.Fatalf("unrelated rule state crossed a nonmatching entry: %+v options=%s", main, main.RuleOptions("custom/rule"))
	}

	testFile := store.ResolveRules(filepath.Join(root, "tests", "unit.ts"))
	if testFile.Ignored || testFile.Rules.Severity("no-restricted-syntax") != SeverityWarn ||
		string(testFile.RuleOptions("no-restricted-syntax")) != `"DebuggerStatement"` {
		t.Fatalf("test resolution did not select its tuple: %+v options=%s", testFile, testFile.RuleOptions("no-restricted-syntax"))
	}

	ignored := store.ResolveRules(filepath.Join(root, "vendor", "library.ts"))
	if !ignored.Ignored || len(ignored.Options) != 0 {
		t.Fatalf("globally ignored file retained rule state: %+v", ignored)
	}

	if got := main.Rules.Severity("no-debugger"); got != SeverityError {
		t.Fatalf("inherited main no-debugger: want error, got %v", got)
	}
	functional := store.ResolveRules(filepath.Join(root, "src", "functional", "api.ts"))
	if got := functional.Rules.Severity("no-debugger"); got != SeverityOff {
		t.Fatalf("locally ignored no-debugger: want off, got %v", got)
	}

	main.Options["no-restricted-syntax"][0] = 'x'
	again := store.ResolveRules(filepath.Join(root, "src", "main.ts"))
	if string(again.RuleOptions("no-restricted-syntax")) != `"VariableDeclaration"` {
		t.Fatalf("resolved option payload aliases config state: %s", again.RuleOptions("no-restricted-syntax"))
	}
}

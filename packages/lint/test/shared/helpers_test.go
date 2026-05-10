// Helpers for the lint engine and config unit scenarios.
//
// The files in this directory are copied next to the native plugin sources by
// scripts/test-go-lint.cjs before `go test ./plugin` runs. Keeping the test
// source under packages/lint/test preserves the package-local test layout while
// still allowing these cases to inspect unexported engine and config helpers.
package main

import (
	"encoding/json"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"testing"

	shimast "github.com/microsoft/typescript-go/shim/ast"
	shimcore "github.com/microsoft/typescript-go/shim/core"
	shimparser "github.com/microsoft/typescript-go/shim/parser"
	shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

var ruleExpectationPattern = regexp.MustCompile(`//\s*expect:\s*([\w-]+)\s+(error|warn)\s*$`)

type ruleExpectation struct {
	Rule     string
	Severity Severity
	Line     int
}

// parseTS parses one virtual TypeScript source file for engine-only tests.
//
// 1. Use an absolute virtual path because the tsgo parser rejects relatives.
// 2. Parse as TypeScript, not JavaScript, so TS-only lint rules can run.
// 3. Fail the current scenario immediately if the parser returns no SourceFile.
func parseTS(t *testing.T, source string) *shimast.SourceFile {
	t.Helper()
	return parseTSFile(t, "/virtual/test.ts", source)
}

// parseTSFile parses one virtual TypeScript file with a caller-selected path.
//
// Some rule-corpus cases live in subdirectories and import sibling fixtures.
// The native rule engine only needs the offending source file for these AST
// rules, but preserving the relative fixture name makes assertion failures
// easier to map back to tests/test-lint/src/cases.
//
// 1. Keep the filename absolute because the tsgo parser rejects relatives.
// 2. Parse as TypeScript so TS-only syntax and directives are preserved.
// 3. Fail the current scenario immediately if parsing returns no SourceFile.
func parseTSFile(t *testing.T, fileName, source string) *shimast.SourceFile {
	t.Helper()
	opts := shimast.SourceFileParseOptions{
		FileName: fileName,
	}
	file := shimparser.ParseSourceFile(opts, source, shimcore.ScriptKindTS)
	if file == nil {
		t.Fatalf("parser returned nil source file")
	}
	return file
}

// assertRuleCorpusCase runs one annotated fixture through the native rule engine.
//
// The TypeScript feature corpus already exercises these files end-to-end through
// ttsc. This Go unit layer exists for coverage and debugging: it parses the same
// `// expect:` annotations, enables only the mentioned rules, and compares the
// rule/severity/line triples directly against Engine findings.
//
//  1. Parse expectation annotations using the same target-line convention as the
//     TypeScript helper.
//  2. Run the lint engine on the virtual fixture source with those rules enabled.
//  3. Compare normalized findings so every rule fixture contributes Go coverage.
func assertRuleCorpusCase(t *testing.T, relativeFile, source string) {
	t.Helper()
	expected := parseRuleExpectations(t, source)
	if len(expected) == 0 {
		t.Fatalf("%s has no rule expectations", relativeFile)
	}
	rules := RuleConfig{}
	for _, exp := range expected {
		rules[exp.Rule] = exp.Severity
	}
	file := parseTSFile(t, "/virtual/"+filepath.ToSlash(relativeFile), source)
	findings := NewEngine(rules).Run([]*shimast.SourceFile{file}, nil)
	actual := normalizeRuleFindings(file, findings)
	if len(actual) != len(expected) {
		t.Fatalf("%s: want %v, got %v", relativeFile, expected, actual)
	}
	for i := range expected {
		if actual[i] != expected[i] {
			t.Fatalf("%s[%d]: want %+v, got %+v; all findings=%+v", relativeFile, i, expected[i], actual[i], actual)
		}
	}
}

// parseRuleExpectations mirrors the TypeScript fixture helper's annotation
// parser. `// expect:` comments pin to the next non-blank target line, while
// stacked expectation comments can share the same target.
func parseRuleExpectations(t *testing.T, source string) []ruleExpectation {
	t.Helper()
	lines := strings.Split(strings.ReplaceAll(source, "\r\n", "\n"), "\n")
	expected := []ruleExpectation{}
	for i, line := range lines {
		match := ruleExpectationPattern.FindStringSubmatch(line)
		if match == nil {
			continue
		}
		target := i + 1
		for target < len(lines) {
			candidate := lines[target]
			if strings.TrimSpace(candidate) == "" || ruleExpectationPattern.MatchString(candidate) {
				target++
				continue
			}
			if match[1] != "ban-ts-comment" &&
				regexp.MustCompile(`^\s*//\s*@ts-(?:expect-error|ignore)\b`).MatchString(candidate) {
				target++
				continue
			}
			break
		}
		if target >= len(lines) {
			continue
		}
		expected = append(expected, ruleExpectation{
			Rule:     match[1],
			Severity: parseExpectedSeverity(t, match[2]),
			Line:     target + 1,
		})
	}
	return expected
}

func parseExpectedSeverity(t *testing.T, text string) Severity {
	t.Helper()
	switch text {
	case "error":
		return SeverityError
	case "warn":
		return SeverityWarn
	default:
		t.Fatalf("unknown fixture severity %q", text)
		return SeverityOff
	}
}

func normalizeRuleFindings(file *shimast.SourceFile, findings []*Finding) []ruleExpectation {
	actual := make([]ruleExpectation, 0, len(findings))
	for _, finding := range findings {
		actual = append(actual, ruleExpectation{
			Rule:     finding.Rule,
			Severity: finding.Severity,
			Line:     shimscanner.GetECMALineOfPosition(file, finding.Pos) + 1,
		})
	}
	sort.Slice(actual, func(i, j int) bool {
		if actual[i].Line != actual[j].Line {
			return actual[i].Line < actual[j].Line
		}
		if actual[i].Rule != actual[j].Rule {
			return actual[i].Rule < actual[j].Rule
		}
		return actual[i].Severity < actual[j].Severity
	})
	return actual
}

// findingRules returns a sorted rule-name snapshot from engine findings.
//
// 1. Drop source ranges because directive tests only need rule identity.
// 2. Sort names so assertions do not depend on AST walk order.
func findingRules(findings []*Finding) []string {
	names := make([]string, 0, len(findings))
	for _, finding := range findings {
		names = append(names, finding.Rule)
	}
	sort.Strings(names)
	return names
}

// writeFile materializes a config fixture file for discovery and loader tests.
//
// 1. Create the parent directory to model nested project layouts.
// 2. Write the exact config text used by the scenario.
func writeFile(t *testing.T, location, text string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(location), 0o755); err != nil {
		t.Fatalf("MkdirAll: %v", err)
	}
	if err := os.WriteFile(location, []byte(text), 0o644); err != nil {
		t.Fatalf("WriteFile: %v", err)
	}
}

// captureCommandOutput records stdout and stderr for command-frontdoor tests.
//
// The lint package writes directly to process streams because it is a native
// sidecar command. Capturing the real streams keeps tests close to host
// behavior while still allowing assertions on rendered diagnostics.
//
// 1. Swap os.Stdout and os.Stderr for pipes around the command function.
// 2. Execute the command and close writers before reading captured output.
// 3. Restore process streams before returning to the caller.
func captureCommandOutput(t *testing.T, fn func() int) (int, string, string) {
	t.Helper()
	prevOut, prevErr := os.Stdout, os.Stderr
	outReader, outWriter, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	errReader, errWriter, err := os.Pipe()
	if err != nil {
		t.Fatal(err)
	}
	os.Stdout = outWriter
	os.Stderr = errWriter
	code := fn()
	if err := outWriter.Close(); err != nil {
		t.Fatal(err)
	}
	if err := errWriter.Close(); err != nil {
		t.Fatal(err)
	}
	os.Stdout = prevOut
	os.Stderr = prevErr
	out, err := io.ReadAll(outReader)
	if err != nil {
		t.Fatal(err)
	}
	errOut, err := io.ReadAll(errReader)
	if err != nil {
		t.Fatal(err)
	}
	return code, string(out), string(errOut)
}

// seedLintProject materializes a minimal project for command-frontdoor tests.
//
// Project commands need a real tsconfig because RunCheck, RunBuild, and
// RunTransform all bootstrap tsgo. The helper keeps those fixtures consistent
// while letting each scenario decide source text and compiler options.
//
// 1. Create a temporary root with tsconfig.json and src/main.ts.
// 2. Use strict CommonJS output so emitted JavaScript has stable assertions.
// 3. Return the root path for --cwd command execution.
func seedLintProject(t *testing.T, source string) string {
	t.Helper()
	root := t.TempDir()
	writeFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "rootDir": "src",
    "outDir": "dist"
  },
  "files": ["src/main.ts"]
}
`)
	writeFile(t, filepath.Join(root, "src", "main.ts"), source)
	return root
}

// lintManifest serializes the plugin payload shape passed by ttsc.
//
// The command package receives its rules through --plugins-json, not by reading
// package.json. Tests use this helper to keep the sidecar protocol explicit.
func lintManifest(t *testing.T, rules map[string]string) string {
	t.Helper()
	data, err := json.Marshal([]map[string]any{{
		"name":  "@ttsc/lint",
		"stage": "check",
		"config": map[string]any{
			"config": rules,
		},
	}})
	if err != nil {
		t.Fatal(err)
	}
	return string(data)
}

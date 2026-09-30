package linthost

import (
  "encoding/json"
  "testing"
  shimast "github.com/microsoft/typescript-go/shim/ast"
)

const unicornFilenameCaseRuleName = "unicorn/filename-case"

// unicornFilenameCaseTestRoot is the virtual project directory every
// engine-level scenario resolves path segments against. A rooted, driveless
// spelling works on both Windows and POSIX `filepath.Rel` and mirrors how the
// tsgo host hands normalized forward-slash paths to the rule.
const unicornFilenameCaseTestRoot = "/project"

// runUnicornFilenameCaseFile lints one statement-bearing virtual file at the
// given project-relative path and returns the engine findings.
func runUnicornFilenameCaseFile(t *testing.T, projectRelativePath, optionsJSON string) []*Finding {
  t.Helper()
  return runUnicornFilenameCaseAbsolute(
    t,
    unicornFilenameCaseTestRoot+"/"+projectRelativePath,
    optionsJSON,
  )
}

// runUnicornFilenameCaseAbsolute is runUnicornFilenameCaseFile for callers
// that need full control of the virtual absolute path (outside-project and
// project-rooted scenarios).
func runUnicornFilenameCaseAbsolute(t *testing.T, absolutePath, optionsJSON string) []*Finding {
  t.Helper()
  var engine *Engine
  if optionsJSON == "" {
    engine = NewEngine(RuleConfig{unicornFilenameCaseRuleName: SeverityError})
  } else {
    engine = NewEngineWithResolver(InlineRuleResolver{
      Rules:   RuleConfig{unicornFilenameCaseRuleName: SeverityError},
      Options: RuleOptionsMap{unicornFilenameCaseRuleName: json.RawMessage(optionsJSON)},
    })
  }
  if err := engine.ConfigError(); err != nil {
    t.Fatalf("options %s: unexpected config error: %v", optionsJSON, err)
  }
  engine.SetCurrentDirectory(unicornFilenameCaseTestRoot)
  file := parseTSFile(t, absolutePath, "export const value = 1;\n")
  return engine.Run([]*shimast.SourceFile{file}, nil)
}

func assertUnicornFilenameCaseValid(t *testing.T, projectRelativePath, optionsJSON string) {
  t.Helper()
  findings := runUnicornFilenameCaseFile(t, projectRelativePath, optionsJSON)
  if len(findings) != 0 {
    t.Fatalf(
      "%s options=%s: want no findings, got %d: %q",
      projectRelativePath, optionsJSON, len(findings), findings[0].Message,
    )
  }
}

func assertUnicornFilenameCaseMessage(t *testing.T, projectRelativePath, optionsJSON, message string) {
  t.Helper()
  assertUnicornFilenameCaseMessageAbsolute(
    t,
    unicornFilenameCaseTestRoot+"/"+projectRelativePath,
    optionsJSON,
    message,
  )
}

func assertUnicornFilenameCaseMessageAbsolute(t *testing.T, absolutePath, optionsJSON, message string) {
  t.Helper()
  findings := runUnicornFilenameCaseAbsolute(t, absolutePath, optionsJSON)
  if len(findings) != 1 {
    t.Fatalf(
      "%s options=%s: want exactly one finding, got %d (%+v)",
      absolutePath, optionsJSON, len(findings), findings,
    )
  }
  if findings[0].engineFailure || findings[0].Severity != SeverityError || findings[0].Rule != unicornFilenameCaseRuleName {
    t.Fatalf("%s: finding rule: want %q, got %q", absolutePath, unicornFilenameCaseRuleName, findings[0].Rule)
  }
  if findings[0].Message != message {
    t.Fatalf(
      "%s options=%s:\nwant %q\ngot  %q",
      absolutePath, optionsJSON, message, findings[0].Message,
    )
  }
}

// TestRuleCorpusUnicornFilenameCase verifies the Go twin of the corpus fixture
// `tests/test-lint/src/cases/unicorn-filename-case.ts`.
//
// The fixture rides the corpus harness's `@ttsc-corpus-filename` directive to
// materialize as `src/utils/FooBar.ts`, so the default kebab-case check fires
// on the PascalCase stem. This twin pins the same logical path through the
// engine directly so the fixture's expectation line stays covered by Go tests.
//
// 1. Parse the fixture body under the fixture's logical project path.
// 2. Run the engine with the rule enabled at the annotated severity.
// 3. Compare rule/severity/line triples against the `// expect:` annotation.
//
// @evidence contracts/testing.md#behavioral-verification NewEngine.Run compares rule/severity/line triples for PascalCase FooBar.ts under the actual virtual project path.
// @evidence contracts/testing.md#independent-expectations The annotated error independently follows the supported default kebab-case filename policy, rather than a repository file-presence check.
// @evidence contracts/testing.md#distinguishing-cases The source-relative src/utils/FooBar.ts path owns the corpus report; UpstreamValidFilenames supplies compliant path counterparts.
// @evidence contracts/testing.md#execution-ownership TestRuleCorpusUnicornFilenameCase owns its retained literal paths/options as a discoverable Go unit entry; engine/configuration operations run in the shared process using virtual or isolated fixture paths, without installing a consumer, native build or product host.
func TestRuleCorpusUnicornFilenameCase(t *testing.T) {
  source := "// expect: unicorn/filename-case error\nexport const utilities = [] as string[];\n"
  expected := parseRuleExpectations(t, source)
  if len(expected) == 0 {
    t.Fatal("fixture twin has no rule expectations")
  }
  rules := RuleConfig{}
  for _, exp := range expected {
    rules[exp.Rule] = exp.Severity
  }
  engine := NewEngine(rules)
  engine.SetCurrentDirectory(unicornFilenameCaseTestRoot)
  file := parseTSFile(t, unicornFilenameCaseTestRoot+"/src/utils/FooBar.ts", source)
  findings := engine.Run([]*shimast.SourceFile{file}, nil)
  assertUnicornRuleErrorFindingIdentities(t, unicornFilenameCaseRuleName, findings)
  actual := normalizeRuleFindings(file, findings)
  if len(actual) != len(expected) {
    t.Fatalf("want %v, got %v", expected, actual)
  }
  for i := range expected {
    if actual[i] != expected[i] {
      t.Fatalf("[%d]: want %+v, got %+v", i, expected[i], actual[i])
    }
  }
}














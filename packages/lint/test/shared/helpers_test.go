// Helpers for the lint engine and config unit scenarios.
//
// The files in this directory are copied next to the native plugin sources by
// scripts/test-go-lint.cjs before `go test ./plugin` runs. Keeping the test
// source under packages/lint/test preserves the package-local test layout while
// still allowing these cases to inspect unexported engine and config helpers.
package linthost

import (
  "encoding/json"
  "net/url"
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

var ruleExpectationPattern = regexp.MustCompile(`//\s*expect:\s*([@\w/-]+)\s+(error|warn)\s*$`)
var ansiControlSequencePattern = regexp.MustCompile(`\x1b\[[0-9;?]*[ -/]*[@-~]`)

// diagnosticOutputContains compares rendered diagnostics after removing ANSI
// control sequences. Windows and POSIX runners color different path segments,
// so raw file:line substrings are not portable even when the diagnostic is.
func diagnosticOutputContains(output, substring string) bool {
  return strings.Contains(ansiControlSequencePattern.ReplaceAllString(output, ""), substring)
}

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
    // The tsgo parser asserts on normalized absolute paths; Windows
    // t.TempDir() callers would otherwise panic it with backslashes.
    FileName: filepath.ToSlash(fileName),
  }
  file := shimparser.ParseSourceFile(opts, source, shimcore.ScriptKindTS)
  if file == nil {
    t.Fatalf("parser returned nil source file")
  }
  return file
}

// parseTSXFile parses one virtual TSX file with a caller-selected path.
// Mirrors parseTSFile but uses ScriptKindTSX so JSX nodes
// (KindJsxElement, KindJsxAttribute, …) appear in the AST.
//
//  1. Keep the filename absolute because the tsgo parser rejects relatives.
//  2. Parse as TSX so JSX-only kinds are recognized instead of becoming
//     parse errors or alternative-grammar tokens.
//  3. Fail the current scenario immediately if parsing returns no SourceFile.
func parseTSXFile(t *testing.T, fileName, source string) *shimast.SourceFile {
  t.Helper()
  opts := shimast.SourceFileParseOptions{
    // Same normalization as parseTSFile — see the comment there.
    FileName: filepath.ToSlash(fileName),
  }
  file := shimparser.ParseSourceFile(opts, source, shimcore.ScriptKindTSX)
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

// assertRuleCorpusCaseTSX runs one annotated TSX fixture through the native
// rule engine.
//
// JSX-focused families need ScriptKindTSX so intrinsic tags and component tags
// surface as JSX nodes instead of parse errors. This mirrors assertRuleCorpusCase
// while preserving the caller's virtual file path for path-sensitive rules.
//
//  1. Parse expectation annotations from `// expect:` comments.
//  2. Parse the source as TSX under the requested virtual path.
//  3. Compare normalized Engine findings against the annotations.
func assertRuleCorpusCaseTSX(t *testing.T, relativeFile, source string) {
  t.Helper()
  expected := parseRuleExpectations(t, source)
  if len(expected) == 0 {
    t.Fatalf("%s has no rule expectations", relativeFile)
  }
  rules := RuleConfig{}
  for _, exp := range expected {
    rules[exp.Rule] = exp.Severity
  }
  file := parseTSXFile(t, "/virtual/"+filepath.ToSlash(relativeFile), source)
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
      if match[1] != "typescript/ban-ts-comment" &&
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
// 1. Swap os.Stdout and os.Stderr for temporary files around the command.
// 2. Execute the command and close files before reading captured output.
// 3. Restore process streams before returning to the caller.
func captureCommandOutput(t *testing.T, fn func() int) (int, string, string) {
  t.Helper()
  prevOut, prevErr := os.Stdout, os.Stderr
  outputDirectory := t.TempDir()
  outWriter, err := os.Create(filepath.Join(outputDirectory, "stdout"))
  if err != nil {
    t.Fatal(err)
  }
  errWriter, err := os.Create(filepath.Join(outputDirectory, "stderr"))
  if err != nil {
    t.Fatal(err)
  }
  os.Stdout = outWriter
  os.Stderr = errWriter
  defer func() {
    os.Stdout = prevOut
    os.Stderr = prevErr
  }()
  code := fn()
  if err := outWriter.Close(); err != nil {
    t.Fatal(err)
  }
  if err := errWriter.Close(); err != nil {
    t.Fatal(err)
  }
  os.Stdout = prevOut
  os.Stderr = prevErr
  out, err := os.ReadFile(outWriter.Name())
  if err != nil {
    t.Fatal(err)
  }
  errOut, err := os.ReadFile(errWriter.Name())
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
  return seedLintProjectFile(t, "main.ts", source)
}

// seedLintProjectFile is seedLintProject with a caller-selected source name.
// Snapshot tests use it when the filename controls TypeScript's grammar, while
// command-frontdoor tests keep the main.ts default above.
func seedLintProjectFile(t *testing.T, fileName, source string) string {
  t.Helper()
  root := t.TempDir()
  compilerOptions := map[string]any{
    "target":  "ES2022",
    "module":  "commonjs",
    "strict":  true,
    "rootDir": "src",
    "outDir":  "dist",
  }
  if strings.EqualFold(filepath.Ext(fileName), ".tsx") {
    compilerOptions["jsx"] = "preserve"
  }
  config, err := json.MarshalIndent(map[string]any{
    "compilerOptions": compilerOptions,
    "files": []string{
      filepath.ToSlash(filepath.Join("src", fileName)),
    },
  }, "", "  ")
  if err != nil {
    t.Fatalf("marshal tsconfig: %v", err)
  }
  writeFile(t, filepath.Join(root, "tsconfig.json"), string(config)+"\n")
  writeFile(t, filepath.Join(root, "src", fileName), source)
  return root
}

// lintManifest serializes the plugin payload shape passed by ttsc.
//
// The command package receives its plugin entry through --plugins-json, not by
// reading package.json. The tsconfig plugin entry carries no inline rule
// surface: it points at a lint config file via `configFile` or relies on
// auto-discovery. Tests that need rules pair this helper with `seedLintConfig`.
func lintManifest(t *testing.T) string {
  t.Helper()
  return lintManifestWithConfig(t, map[string]any{})
}

func lintManifestWithConfig(t *testing.T, config map[string]any) string {
  t.Helper()
  data, err := json.Marshal([]map[string]any{{
    "name":   "@ttsc/lint",
    "stage":  "check",
    "config": config,
  }})
  if err != nil {
    t.Fatal(err)
  }
  return string(data)
}

// seedLintConfig writes a `lint.config.json` carrying the given
// `ITtscLintConfig` object into `root`, so a command run with `--cwd root`
// discovers it the way a real project's config file would be picked up.
func seedLintConfig(t *testing.T, root string, config map[string]any) {
  t.Helper()
  data, err := json.Marshal(config)
  if err != nil {
    t.Fatal(err)
  }
  writeFile(t, filepath.Join(root, "lint.config.json"), string(data))
}

// seedLintRules is the common-case wrapper over seedLintConfig: it writes a
// `lint.config.json` whose only key is a `rules` severity map.
func seedLintRules(t *testing.T, root string, rules map[string]string) {
  t.Helper()
  seedLintConfig(t, root, map[string]any{"rules": rules})
}

func assertFileText(t *testing.T, file string, expected string) {
  t.Helper()
  got, err := os.ReadFile(file)
  if err != nil {
    t.Fatalf("ReadFile(%s): %v", file, err)
  }
  if string(got) != expected {
    t.Fatalf("%s text mismatch:\nwant %q\ngot  %q", file, expected, string(got))
  }
}

func lintTestFileURI(t *testing.T, file string) string {
  t.Helper()
  abs, err := filepath.Abs(file)
  if err != nil {
    t.Fatalf("Abs: %v", err)
  }
  uriPath := filepath.ToSlash(abs)
  if filepath.VolumeName(abs) != "" && !strings.HasPrefix(uriPath, "/") {
    uriPath = "/" + uriPath
  }
  return (&url.URL{Scheme: "file", Path: uriPath}).String()
}

// assertFixSnapshot runs one rule's findings through the native fix applier.
//
// Fixer tests need the real file-writing path, not just in-memory edit
// selection, because RunFix reloads a fresh Program from disk after every pass.
//
// 1. Materialize a real source file and load the AST or checker path the rule requires.
// 2. Run one enabled rule and apply collected text edits to disk.
// 3. Compare the rewritten source exactly.
func assertFixSnapshot(t *testing.T, ruleName, source, expected string) {
  t.Helper()
  got, fixed := runFixSnapshot(t, ruleName, source)
  if fixed == 0 {
    t.Fatalf("%s: expected at least one applied fix", ruleName)
  }
  if got != expected {
    t.Fatalf("%s fixed source mismatch:\nwant %q\ngot  %q", ruleName, expected, got)
  }
}

// assertFixSnapshotFile is assertFixSnapshot with a caller-selected source
// filename. Fixers whose safety depends on TypeScript's extension-selected
// grammar use it to exercise TS, TSX, MTS, and CTS without substituting a
// synthetic main.ts mode.
func assertFixSnapshotFile(t *testing.T, ruleName, fileName, source, expected string) {
  t.Helper()
  got, fixed := runFixSnapshotFile(t, ruleName, fileName, source)
  if fixed == 0 {
    t.Fatalf("%s: expected at least one applied fix", ruleName)
  }
  if got != expected {
    t.Fatalf("%s fixed source mismatch for %s:\nwant %q\ngot  %q", ruleName, fileName, expected, got)
  }
}

// assertNoFixSnapshot verifies a reported rule does not offer automatic edits.
func assertNoFixSnapshot(t *testing.T, ruleName, source string) {
  t.Helper()
  got, fixed := runFixSnapshot(t, ruleName, source)
  if fixed != 0 {
    t.Fatalf("%s: expected no applied fixes, got %d", ruleName, fixed)
  }
  if got != source {
    t.Fatalf("%s source should remain unchanged:\nwant %q\ngot  %q", ruleName, source, got)
  }
}

// assertRuleSkipsSource asserts the rule emits zero findings for the input.
// Distinguished from `assertNoFixSnapshot`: the latter requires at least one
// finding (and asserts no fix is applied); this helper is for cases where the
// rule must not fire at all — used for round-2 regression coverage of fixers
// that previously fired on the wrong shape and corrupted source.
func assertRuleSkipsSource(t *testing.T, ruleName, source string) {
  t.Helper()
  _, _, findings := runRuleFindingsSnapshot(t, ruleName, source, nil)
  if len(findings) != 0 {
    t.Fatalf("%s: expected zero findings, got %d (%+v)", ruleName, len(findings), findings)
  }
}

// assertFixSnapshotWithOptions runs one rule (configured with optsJSON)
// through the native fix applier and snapshots the rewritten source.
// Mirrors `assertFixSnapshot`; option-gated sibling of
// `assertRuleSkipsSourceWithOptions`. Cannot delegate to `runFixSnapshot`
// because that path uses the default `NewEngine` rather than
// `NewEngineWithResolver`; the shared findings loader selects the resolver.
func assertFixSnapshotWithOptions(t *testing.T, ruleName, source, optsJSON, expected string) {
  t.Helper()
  root, filePath, findings := runRuleFindingsSnapshot(t, ruleName, source, json.RawMessage(optsJSON))
  if len(findings) == 0 {
    t.Fatalf("%s: expected at least one finding", ruleName)
  }
  fixed, err := applyFindingFixes(root, findings)
  if err != nil {
    t.Fatalf("%s: applyFindingFixes: %v", ruleName, err)
  }
  if fixed == 0 {
    t.Fatalf("%s: expected at least one applied fix", ruleName)
  }
  got, err := os.ReadFile(filePath)
  if err != nil {
    t.Fatalf("%s: ReadFile: %v", ruleName, err)
  }
  if string(got) != expected {
    t.Fatalf("%s fixed source mismatch:\nwant %q\ngot  %q", ruleName, expected, string(got))
  }
}

// assertRuleSkipsSourceWithOptions asserts the rule emits zero findings for
// the input when configured with the given options JSON. Mirrors
// `assertRuleSkipsSource`; used for option-gated skip arms (e.g.
// `format/trailing-comma` under `mode: "es5"`) so per-case tests do not have
// to inline `InlineRuleResolver` + `NewEngineWithResolver` boilerplate.
func assertRuleSkipsSourceWithOptions(t *testing.T, ruleName, source, optsJSON string) {
  t.Helper()
  _, _, findings := runRuleFindingsSnapshot(t, ruleName, source, json.RawMessage(optsJSON))
  if len(findings) != 0 {
    t.Fatalf("%s: expected zero findings, got %d (%+v)", ruleName, len(findings), findings)
  }
}

func runFixSnapshot(t *testing.T, ruleName, source string) (string, int) {
  t.Helper()
  return runFixSnapshotFile(t, ruleName, "main.ts", source)
}

func runFixSnapshotFile(t *testing.T, ruleName, fileName, source string) (string, int) {
  t.Helper()
  root, filePath, findings := runRuleFindingsSnapshotFile(
    t,
    ruleName,
    fileName,
    source,
    nil,
  )
  if len(findings) == 0 {
    t.Fatalf("%s: expected at least one finding", ruleName)
  }
  fixed, err := applyFindingFixes(root, findings)
  if err != nil {
    t.Fatalf("%s: applyFindingFixes: %v", ruleName, err)
  }
  got, err := os.ReadFile(filePath)
  if err != nil {
    t.Fatalf("%s: ReadFile: %v", ruleName, err)
  }
  return string(got), fixed
}

// runRuleFindingsSnapshot runs one rule against a disk-backed source file.
// AST-only rules keep the parser-only fast path; type-aware rules receive a
// real Program and checker so fixer tests exercise the same binding identity
// as command, LSP, and CLI execution.
func runRuleFindingsSnapshot(
  t *testing.T,
  ruleName string,
  source string,
  options json.RawMessage,
) (string, string, []*Finding) {
  t.Helper()
  return runRuleFindingsSnapshotFile(t, ruleName, "main.ts", source, options)
}

// runRuleFindingsSnapshotFile selects the lightweight parser or the real
// Program/checker lifecycle from the configured engine's requirements. Both
// paths materialize the caller's exact filename and project directory so the
// returned findings can flow through the same disk-backed edit assertions.
func runRuleFindingsSnapshotFile(
  t *testing.T,
  ruleName string,
  fileName string,
  source string,
  options json.RawMessage,
) (string, string, []*Finding) {
  t.Helper()
  var engine *Engine
  if len(options) == 0 {
    engine = NewEngine(RuleConfig{ruleName: SeverityError})
  } else {
    engine = NewEngineWithResolver(InlineRuleResolver{
      Rules:   RuleConfig{ruleName: SeverityError},
      Options: RuleOptionsMap{ruleName: options},
    })
  }

  needsRuleChecker := engine.NeedsTypeChecker()
  if !needsRuleChecker {
    root := t.TempDir()
    engine.SetCurrentDirectory(root)
    filePath := filepath.Join(root, "src", fileName)
    writeFile(t, filePath, source)
    var file *shimast.SourceFile
    if strings.EqualFold(filepath.Ext(fileName), ".tsx") {
      file = parseTSXFile(t, filePath, source)
    } else {
      file = parseTSFile(t, filePath, source)
    }
    return root, filePath, engine.Run([]*shimast.SourceFile{file}, nil)
  }

  root := seedLintProjectFile(t, fileName, source)
  engine.SetCurrentDirectory(root)
  filePath := filepath.Join(root, "src", fileName)
  program, diagnostics, err := loadProgram(root, "tsconfig.json", loadProgramOptions{
    forceNoEmit:      true,
    needsRuleChecker: needsRuleChecker,
  })
  if program != nil {
    defer program.close()
  }
  if err != nil {
    t.Fatalf("%s: loadProgram: %v", ruleName, err)
  }
  if len(diagnostics) != 0 {
    t.Fatalf("%s: loadProgram diagnostics: %+v", ruleName, diagnostics)
  }
  if program == nil {
    t.Fatalf("%s: loadProgram returned no program", ruleName)
  }
  if program.checker == nil {
    t.Fatalf("%s: loadProgram returned no checker for a type-aware rule", ruleName)
  }
  return root, filePath, program.runLintCycle(engine)
}

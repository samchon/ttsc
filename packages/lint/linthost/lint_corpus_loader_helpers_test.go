// Loader for the classified lint fixture corpus under test/testdata/corpus.
//
// Every TypeScript source in the corpus declares exactly one role: a positive
// entry carrying `// expect: <rule> <error|warn>` annotations, a clean entry
// (`// @ttsc-corpus-clean: <rule>`) that must draw no finding from its rule, an
// audited `@ttsc-corpus-skip(<constraint>)` entry whose rule is proven by a
// named Go harness, or an `@ttsc-corpus-companion` file consumed by one entry's
// `src/` tree. The loader enforces that classification so an annotation typo cannot
// silently remove coverage, and it materializes each positive entry as a
// disposable project for TestLintFixtureCorpus.
//
// `go test` runs with the linthost package directory as its working directory,
// so the corpus is reached through the sibling `../test/testdata/corpus`
// directory of packages/lint.
package linthost

import (
  "encoding/json"
  "fmt"
  "os"
  "path"
  "path/filepath"
  "regexp"
  "sort"
  "strconv"
  "strings"
  "testing"
)

// corpusHarnessDirectory is where an audited skip's named Go harness must live.
const corpusHarnessDirectory = "packages/lint/linthost/"

// lintCorpusRoot is the committed corpus directory relative to the linthost
// package directory, where the Go tests execute.
var lintCorpusRoot = filepath.Join("..", "test", "testdata", "corpus")

type corpusExpectation struct {
  Rule     string
  Severity string
  Line     int
}

type corpusSkip struct {
  Constraint string
  Reason     string
}

// corpusFile is one classified TypeScript source in the corpus.
type corpusFile struct {
  RelativeFile string
  Source       string
  Expected     []corpusExpectation
  Clean        string
  Skip         *corpusSkip
  Companion    bool
}

// corpusEntry is one positive fixture ready to be materialized.
type corpusEntry struct {
  RelativeFile string
  Source       string
  // SourcePath uses canonical portable separators before native file access.
  SourcePath   string
  Rules        map[string]any
  Expected     []corpusExpectation
  Companions   map[string]string
  // Renamed reports an explicit `@ttsc-corpus-filename` directive.
  Renamed bool
  // Options names the rules that carry a `@ttsc-corpus-options` payload.
  Options map[string]bool
}

var (
  corpusTypeScriptSuffix        = regexp.MustCompile(`(\.d\.mts|\.d\.cts|\.d\.ts|\.tsx|\.mts|\.cts|\.ts)$`)
  corpusTypeScriptSuffixAnyCase = regexp.MustCompile(`(?i)(\.d\.mts|\.d\.cts|\.d\.ts|\.tsx|\.mts|\.cts|\.ts)$`)

  corpusLineMarker      = regexp.MustCompile(`^\s*//\s*expect\b`)
  corpusJSXMarker       = regexp.MustCompile(`^\s*\{\s*/\*\s*expect\b`)
  corpusLineExpectation = regexp.MustCompile(`^\s*//\s*expect:\s*(\w[\w/-]*)\s+(error|warn)\s*$`)
  corpusJSXExpectation  = regexp.MustCompile(`^\s*\{\s*/\*\s*expect:\s*(\w[\w/-]*)\s+(error|warn)\s*\*/\s*\}\s*$`)
  corpusSuppressor      = regexp.MustCompile(`^\s*//\s*@ts-(?:expect-error|ignore)\b`)

  corpusOptionsMarker    = regexp.MustCompile(`^\s*//\s*@ttsc-corpus-options(?:[\s:]|$)`)
  corpusOptionsDirective = regexp.MustCompile(`^\s*//\s*@ttsc-corpus-options\s*:\s*(\S+)\s+(\S.*?)\s*$`)

  corpusFilenameMarker    = regexp.MustCompile(`^\s*//\s*@ttsc-corpus-filename(?:[\s:]|$)`)
  corpusFilenameDirective = regexp.MustCompile(`^\s*//\s*@ttsc-corpus-filename\s*:\s*(.*?)\s*$`)

  corpusCleanMarker    = regexp.MustCompile(`^\s*//\s*@ttsc-corpus-clean\b`)
  corpusCleanDirective = regexp.MustCompile(`^\s*//\s*@ttsc-corpus-clean\s*:\s*([@\w/-]+)\s*$`)

  corpusSkipMarker    =regexp.MustCompile(`^\s*//\s*@ttsc-corpus-skip\b`)
  corpusSkipDirective = regexp.MustCompile(`^\s*//\s*@ttsc-corpus-skip(?:\(([^)]*)\))?\s*:\s*(.*?)\s*$`)

  corpusCompanionMarker    = regexp.MustCompile(`^\s*//\s*@ttsc-corpus-companion\b`)
  corpusCompanionDirective = regexp.MustCompile(`^\s*//\s*@ttsc-corpus-companion\s*$`)

  corpusRuleDirective  = regexp.MustCompile(`^\s*//\s*@ttsc-corpus-rule:\s*([@\w/-]+)\s*$`)
  corpusEntryDirective = regexp.MustCompile(`(?m)^\s*//\s*@ttsc-corpus-(?:filename|options|rule|clean)\b`)

  corpusHarnessPath     = regexp.MustCompile(`\bpackages/lint/linthost/[\w./-]+_test\.go\b`)
  corpusNotImplemented  = regexp.MustCompile(`(?i)not yet implemented`)
  corpusSkipConstraints = map[string]bool{"options": true, "filename": true, "project": true, "checker": true, "platform": true}
)

func corpusLines(source string) []string {
  lines := strings.Split(source, "\n")
  for i, line := range lines {
    lines[i] = strings.TrimSuffix(line, "\r")
  }
  return lines
}

// corpusMatchLines returns the line-anchored matches of pattern in source.
func corpusMatchLines(pattern *regexp.Regexp, source string) [][]string {
  var matches [][]string
  for _, line := range corpusLines(source) {
    if match := pattern.FindStringSubmatch(line); match != nil {
      matches = append(matches, match)
    }
  }
  return matches
}

func corpusTypeScriptSuffixOf(file string) string {
  match := corpusTypeScriptSuffix.FindStringSubmatch(file)
  if match == nil {
    return ""
  }
  return match[1]
}

func corpusIsNonCanonicalSuffix(file string) bool {
  return corpusTypeScriptSuffix.FindString(file) == "" && corpusTypeScriptSuffixAnyCase.MatchString(file)
}

func corpusParseExpectationMarker(line string, number int) (*corpusExpectation, error) {
  isLine := corpusLineMarker.MatchString(line)
  isJSX := corpusJSXMarker.MatchString(line)
  if !isLine && !isJSX {
    return nil, nil
  }
  pattern := corpusLineExpectation
  if isJSX {
    pattern = corpusJSXExpectation
  }
  match := pattern.FindStringSubmatch(line)
  if match == nil {
    return nil, fmt.Errorf("malformed lint expectation at line %d; expected `// expect: <rule> <error|warn>` or `{ /* expect: <rule> <error|warn> */ }`", number)
  }
  return &corpusExpectation{Rule: match[1], Severity: match[2]}, nil
}

// corpusParseExpectations reads standalone line or JSX-block expectation
// comments and resolves the line each one anchors to. Blank lines and stacked
// annotations between a marker and its target are skipped, and a
// `@ts-expect-error` / `@ts-ignore` suppressor is skipped unless the rule is
// typescript/ban-ts-comment, which reports that comment itself.
func corpusParseExpectations(source string) ([]corpusExpectation, error) {
  lines := corpusLines(source)
  var expected []corpusExpectation
  for i, line := range lines {
    marker, err := corpusParseExpectationMarker(line, i+1)
    if err != nil {
      return nil, err
    }
    if marker == nil {
      continue
    }
    target := i + 1
    for target < len(lines) {
      next := lines[target]
      stacked, err := corpusParseExpectationMarker(next, target+1)
      if err != nil {
        return nil, err
      }
      if strings.TrimSpace(next) == "" || stacked != nil ||
        (marker.Rule != "typescript/ban-ts-comment" && corpusSuppressor.MatchString(next)) {
        target++
        continue
      }
      break
    }
    if target >= len(lines) {
      return nil, fmt.Errorf("lint expectation at line %d has no following target", i+1)
    }
    marker.Line = target + 1
    expected = append(expected, *marker)
  }
  return expected, nil
}

func corpusParseCompanion(relativeFile, source string) (bool, error) {
  markers := len(corpusMatchLines(corpusCompanionMarker, source))
  directives := len(corpusMatchLines(corpusCompanionDirective, source))
  if directives != markers {
    return false, fmt.Errorf("%s: malformed `// @ttsc-corpus-companion` directive", relativeFile)
  }
  if directives > 1 {
    return false, fmt.Errorf("%s: a corpus source may declare at most one companion directive", relativeFile)
  }
  return directives == 1, nil
}

// corpusParseClean reads the single `@ttsc-corpus-clean: <rule>` directive that
// turns a source into a negative entry for that rule.
func corpusParseClean(relativeFile, source string) (string, error) {
  markers := len(corpusMatchLines(corpusCleanMarker, source))
  directives := corpusMatchLines(corpusCleanDirective, source)
  if len(directives) != markers {
    return "", fmt.Errorf("%s: malformed `// @ttsc-corpus-clean: <rule>` directive", relativeFile)
  }
  if len(directives) > 1 {
    return "", fmt.Errorf("%s: a corpus source may declare at most one clean directive", relativeFile)
  }
  if len(directives) == 0 {
    return "", nil
  }
  return directives[0][1], nil
}

func corpusParseSkip(relativeFile, source string) (*corpusSkip, error) {
  markers := len(corpusMatchLines(corpusSkipMarker, source))
  directives := corpusMatchLines(corpusSkipDirective, source)
  if len(directives) != markers {
    return nil, fmt.Errorf("%s: malformed `// @ttsc-corpus-skip(<constraint>): <reason>` directive", relativeFile)
  }
  if len(directives) > 1 {
    return nil, fmt.Errorf("%s: a lint fixture may declare at most one corpus-skip directive", relativeFile)
  }
  if len(directives) == 0 {
    return nil, nil
  }
  return &corpusSkip{Constraint: directives[0][1], Reason: directives[0][2]}, nil
}

// corpusSkippedRule names the single rule an audited skip stands in for.
func corpusSkippedRule(relativeFile, source string, expected []corpusExpectation) (string, error) {
  rules := map[string]bool{}
  for _, expectation := range expected {
    rules[expectation.Rule] = true
  }
  declared := corpusMatchLines(corpusRuleDirective, source)
  if len(declared) > 1 {
    return "", fmt.Errorf("%s: a corpus skip may declare at most one `// @ttsc-corpus-rule:` directive", relativeFile)
  }
  if len(declared) == 1 {
    rules[declared[0][1]] = true
  }
  if len(rules) != 1 {
    return "", fmt.Errorf("%s: a corpus skip must identify exactly one rule through an expectation or `// @ttsc-corpus-rule:`", relativeFile)
  }
  for rule := range rules {
    return rule, nil
  }
  return "", nil
}

func corpusValidateSkip(file corpusFile) (string, error) {
  skip := file.Skip
  if skip.Reason == "" {
    return "", fmt.Errorf("%s: a corpus-skip directive requires a non-empty reason", file.RelativeFile)
  }
  if corpusNotImplemented.MatchString(file.Source) {
    return "", fmt.Errorf(`%s: a public rule cannot skip the corpus as "not yet implemented"`, file.RelativeFile)
  }
  if !corpusSkipConstraints[skip.Constraint] {
    return "", fmt.Errorf("%s: unknown corpus constraint %s", file.RelativeFile, strconv.Quote(skip.Constraint))
  }
  harnesses := corpusHarnessPath.FindAllString(skip.Reason, -1)
  if len(harnesses) != 1 {
    return "", fmt.Errorf("%s: a corpus skip must reference exactly one positive Go harness under packages/lint/linthost/", file.RelativeFile)
  }
  cleaned := path.Clean(harnesses[0])
  if !strings.HasPrefix(cleaned, corpusHarnessDirectory) {
    return "", fmt.Errorf("%s: referenced harness escapes %s: %s", file.RelativeFile, corpusHarnessDirectory, harnesses[0])
  }
  // The harness is a file of the linthost package, which is the working
  // directory of its tests, so the pointer is verified rather than trusted.
  name := strings.TrimPrefix(cleaned, corpusHarnessDirectory)
  if strings.Contains(name, "/") {
    return "", fmt.Errorf("%s: referenced harness must be a file directly under %s: %s", file.RelativeFile, corpusHarnessDirectory, harnesses[0])
  }
  if info, err := os.Stat(name); err != nil || !info.Mode().IsRegular() {
    return "", fmt.Errorf("%s: referenced harness does not exist: %s", file.RelativeFile, harnesses[0])
  }
  return corpusSkippedRule(file.RelativeFile, file.Source, file.Expected)
}

// corpusWalk lists every regular file below dir as slash-separated relative
// paths in a deterministic order.
func corpusWalk(dir string) ([]string, error) {
  var files []string
  err := filepath.WalkDir(dir, func(location string, entry os.DirEntry, err error) error {
    if err != nil {
      return err
    }
    if entry.Type().IsRegular() {
      relative, err := filepath.Rel(dir, location)
      if err != nil {
        return err
      }
      files = append(files, filepath.ToSlash(relative))
    }
    return nil
  })
  sort.Strings(files)
  return files, err
}

// corpusReadFiles reads and classifies every TypeScript source below root.
func corpusReadFiles(root string) ([]corpusFile, error) {
  names, err := corpusWalk(root)
  if err != nil {
    return nil, err
  }
  var files []corpusFile
  for _, name := range names {
    if corpusIsNonCanonicalSuffix(name) {
      return nil, fmt.Errorf("%s: TypeScript source extension must use canonical lowercase spelling", name)
    }
    if corpusTypeScriptSuffixOf(name) == "" {
      continue
    }
    data, err := os.ReadFile(filepath.Join(root, filepath.FromSlash(name)))
    if err != nil {
      return nil, err
    }
    source := string(data)
    expected, err := corpusParseExpectations(source)
    if err != nil {
      return nil, fmt.Errorf("%s: %w", name, err)
    }
    clean, err := corpusParseClean(name, source)
    if err != nil {
      return nil, err
    }
    skip, err := corpusParseSkip(name, source)
    if err != nil {
      return nil, err
    }
    companion, err := corpusParseCompanion(name, source)
    if err != nil {
      return nil, err
    }
    files = append(files, corpusFile{RelativeFile: name, Source: source, Expected: expected, Clean: clean, Skip: skip, Companion: companion})
  }
  return files, nil
}

func corpusValidateCompanions(files []corpusFile) error {
  var entries []corpusFile
  for _, file := range files {
    if file.Companion {
      if len(file.Expected) != 0 {
        return fmt.Errorf("%s: a corpus companion cannot declare expectations", file.RelativeFile)
      }
      if file.Skip != nil {
        return fmt.Errorf("%s: a corpus companion cannot also be an audited skip", file.RelativeFile)
      }
      if file.Clean != "" {
        return fmt.Errorf("%s: a corpus companion cannot also be a clean entry", file.RelativeFile)
      }
      if corpusEntryDirective.MatchString(file.Source) {
        return fmt.Errorf("%s: a corpus companion cannot declare entry directives", file.RelativeFile)
      }
      continue
    }
    if file.Clean != "" && (len(file.Expected) != 0 || file.Skip != nil) {
      return fmt.Errorf("%s: a clean corpus entry cannot declare expectations or an audited skip", file.RelativeFile)
    }
    if len(file.Expected) == 0 && file.Clean == "" && file.Skip == nil {
      return fmt.Errorf("%s: a corpus source must declare an expectation, clean rule, audited skip, or @ttsc-corpus-companion", file.RelativeFile)
    }
    if file.Skip == nil {
      entries = append(entries, file)
    }
  }
  for _, companion := range files {
    if !companion.Companion {
      continue
    }
    owners := 0
    for _, entry := range entries {
      directory := path.Dir(entry.RelativeFile)
      if directory != "." && strings.HasPrefix(companion.RelativeFile, directory+"/src/") {
        owners++
      }
    }
    if owners != 1 {
      return fmt.Errorf("%s: a corpus companion must belong to exactly one positive entry whose case directory contains it under src/", companion.RelativeFile)
    }
  }
  return nil
}

// corpusValidateSkips validates every audited skip and allows at most one skip
// fixture per rule.
func corpusValidateSkips(files []corpusFile) error {
  used := map[string]bool{}
  for _, file := range files {
    if file.Skip == nil {
      continue
    }
    rule, err := corpusValidateSkip(file)
    if err != nil {
      return err
    }
    if used[rule] {
      return fmt.Errorf("%s: %s already has another corpus-skip fixture", file.RelativeFile, rule)
    }
    used[rule] = true
  }
  return nil
}

// corpusResolveSourcePath returns the project-relative path at which a fixture
// is materialized: its `@ttsc-corpus-filename` directive, or `src/main` plus its
// own TypeScript suffix so TSX keeps its JSX grammar. Explicit directives use
// the writer's case-preserving portable normalization before any native read.
func corpusResolveSourcePath(source, relativeFile string) (string, error) {
  markers := len(corpusMatchLines(corpusFilenameMarker, source))
  directives := corpusMatchLines(corpusFilenameDirective, source)
  if len(directives) != markers {
    return "", fmt.Errorf("%s: malformed `// @ttsc-corpus-filename: <path>` directive", relativeFile)
  }
  if len(directives) > 1 {
    return "", fmt.Errorf("%s: a lint fixture may declare at most one corpus-filename directive", relativeFile)
  }
  if len(directives) == 1 {
    if directives[0][1] == "" {
      return "", fmt.Errorf("%s: `// @ttsc-corpus-filename:` requires a path", relativeFile)
    }
    return corpusProjectPath(relativeFile, directives[0][1])
  }
  if corpusIsNonCanonicalSuffix(relativeFile) {
    return "", fmt.Errorf("%s: TypeScript source extension must use canonical lowercase spelling", relativeFile)
  }
  suffix := corpusTypeScriptSuffixOf(relativeFile)
  if suffix == "" {
    return "", fmt.Errorf("%s: unsupported TypeScript source extension", relativeFile)
  }
  return "src/main" + suffix, nil
}

// corpusApplyOptions upgrades the severity of each rule named by a
// `// @ttsc-corpus-options: <rule> <json>` directive to the `[severity,
// options]` tuple the lint config accepts. A directive naming a rule without an
// expectation or clean directive would configure nothing, so it is an error. It
// returns the set of rules that received options.
func corpusApplyOptions(relativeFile, source string, rules map[string]any) (map[string]bool, error) {
  markers := len(corpusMatchLines(corpusOptionsMarker, source))
  directives := corpusMatchLines(corpusOptionsDirective, source)
  if len(directives) != markers {
    return nil, fmt.Errorf("%s: malformed `// @ttsc-corpus-options: <rule> <json>` directive", relativeFile)
  }
  configured := map[string]bool{}
  for _, directive := range directives {
    rule, payload := directive[1], directive[2]
    current, ok := rules[rule]
    if !ok {
      return nil, fmt.Errorf("%s: @ttsc-corpus-options names %s, which has no expectation annotation", relativeFile, rule)
    }
    severity, ok := current.(string)
    if !ok {
      return nil, fmt.Errorf("%s: duplicate @ttsc-corpus-options directive for %s", relativeFile, rule)
    }
    var options any
    if err := json.Unmarshal([]byte(payload), &options); err != nil {
      return nil, fmt.Errorf("%s: @ttsc-corpus-options for %s carries invalid JSON: %s", relativeFile, rule, payload)
    }
    rules[rule] = []any{severity, options}
    configured[rule] = true
  }
  return configured, nil
}

// corpusProjectPath normalizes a project-relative target and rejects anything
// that could leave the project or the generated tsconfig's `src/` include.
func corpusProjectPath(relativeFile, target string) (string, error) {
  portable := strings.ReplaceAll(target, `\`, "/")
  cleaned := path.Clean(portable)
  if strings.TrimSpace(target) == "" || strings.HasPrefix(portable, "/") || filepath.VolumeName(target) != "" ||
    cleaned == "." || cleaned == ".." || strings.HasPrefix(cleaned, "../") || strings.HasSuffix(portable, "/") {
    return "", fmt.Errorf("%s: fixture path must be a project-root-relative file path: %s", relativeFile, target)
  }
  if !strings.HasPrefix(cleaned, "src/") {
    return "", fmt.Errorf("%s: fixture path must live under src/: %s", relativeFile, target)
  }
  return cleaned, nil
}

// corpusCollectCompanions gathers the marked companion files of the grouped
// case that owns relativeFile. A companion keeps its case-root-relative path,
// and only the case's own project-level `src/` subtree is consumed so a nested
// grouped case keeps its companions to itself.
func corpusCollectCompanions(root, relativeFile string) (map[string]string, error) {
  directory := path.Dir(relativeFile)
  companions := map[string]string{}
  if directory == "." {
    return companions, nil
  }
  caseRoot := filepath.Join(root, filepath.FromSlash(directory))
  names, err := corpusWalk(caseRoot)
  if err != nil {
    return nil, err
  }
  for _, name := range names {
    if !strings.HasPrefix(name, "src/") || corpusTypeScriptSuffixOf(name) == "" {
      continue
    }
    data, err := os.ReadFile(filepath.Join(caseRoot, filepath.FromSlash(name)))
    if err != nil {
      return nil, err
    }
    companion, err := corpusParseCompanion(directory+"/"+name, string(data))
    if err != nil {
      return nil, err
    }
    if companion {
      companions[name] = string(data)
    }
  }
  return companions, nil
}

// loadLintCorpus classifies the whole corpus under root and returns every
// positive entry, skipping audited skips.
func loadLintCorpus(root string) ([]corpusEntry, error) {
  files, err := corpusReadFiles(root)
  if err != nil {
    return nil, err
  }
  if err := corpusValidateCompanions(files); err != nil {
    return nil, err
  }
  if err := corpusValidateSkips(files); err != nil {
    return nil, err
  }
  var entries []corpusEntry
  for _, file := range files {
    if file.Companion || file.Skip != nil {
      continue
    }
    sourcePath, err := corpusResolveSourcePath(file.Source, file.RelativeFile)
    if err != nil {
      return nil, err
    }
    rules := map[string]any{}
    for _, expectation := range file.Expected {
      rules[expectation.Rule] = expectation.Severity
    }
    if file.Clean != "" {
      rules[file.Clean] = "error"
    }
    options, err := corpusApplyOptions(file.RelativeFile, file.Source, rules)
    if err != nil {
      return nil, err
    }
    companions, err := corpusCollectCompanions(root, file.RelativeFile)
    if err != nil {
      return nil, err
    }
    entries = append(entries, corpusEntry{
      RelativeFile: file.RelativeFile,
      Source:       file.Source,
      SourcePath:   sourcePath,
      Rules:        rules,
      Expected:     file.Expected,
      Companions:   companions,
      Renamed:      len(corpusMatchLines(corpusFilenameDirective, file.Source)) != 0,
      Options:      options,
    })
  }
  return entries, nil
}

// materializeCorpusProject writes the entry as a project at root: its source,
// its companions, the lint.config.json carrying its rules and a tsconfig whose
// JSX mode follows the TSX sources included under src/.
func materializeCorpusProject(root string, entry corpusEntry) error {
  main, err := corpusProjectPath(entry.RelativeFile, entry.SourcePath)
  if err != nil {
    return err
  }
  sources := map[string]string{main: entry.Source}
  keys := map[string]string{strings.ToLower(main): main}
  for name, source := range entry.Companions {
    target, err := corpusProjectPath(entry.RelativeFile, name)
    if err != nil {
      return err
    }
    if previous, collides := keys[strings.ToLower(target)]; collides {
      return fmt.Errorf("%s: fixture source paths collide after portable normalization: %s and %s", entry.RelativeFile, previous, name)
    }
    keys[strings.ToLower(target)] = target
    sources[target] = source
  }
  usesTSX := false
  for target, source := range sources {
    location := filepath.Join(root, filepath.FromSlash(target))
    if err := os.MkdirAll(filepath.Dir(location), 0o755); err != nil {
      return err
    }
    if err := os.WriteFile(location, []byte(source), 0o644); err != nil {
      return err
    }
    if corpusTypeScriptSuffixOf(target) == ".tsx" {
      usesTSX = true
    }
  }
  compilerOptions := map[string]any{
    "target":  "ES2022",
    "module":  "commonjs",
    "strict":  true,
    "noEmit":  true,
    "rootDir": "src",
    "plugins": []any{map[string]any{"transform": "@ttsc/lint"}},
  }
  if usesTSX {
    compilerOptions["jsx"] = "react-jsx"
  }
  tsconfig, err := json.MarshalIndent(map[string]any{"compilerOptions": compilerOptions, "include": []string{"src"}}, "", "  ")
  if err != nil {
    return err
  }
  config, err := json.MarshalIndent(map[string]any{"rules": entry.Rules}, "", "  ")
  if err != nil {
    return err
  }
  if err := os.WriteFile(filepath.Join(root, "tsconfig.json"), tsconfig, 0o644); err != nil {
    return err
  }
  return os.WriteFile(filepath.Join(root, "lint.config.json"), config, 0o644)
}

// corpusDiagnostic is one rendered `file:line:col - category TSnnnn: [rule]`
// banner reduced to the identity the corpus compares.
type corpusDiagnostic struct {
  File     string
  Rule     string
  Severity string
  Line     int
}

var (
  corpusANSI   = regexp.MustCompile("\\x1b\\[[0-9;]*[A-Za-z]")
  corpusBanner = regexp.MustCompile(`^(.+):([0-9]+):[0-9]+\s+-\s+(error|warning)\s+TS[0-9]+:\s*\[([^\]]+)\]\s*.*$`)
)

// corpusPortableFile spells a rendered or expected source path so POSIX and
// Windows separators, `./` prefixes and case folding identify one file.
func corpusPortableFile(file string) string {
  return strings.ToLower(path.Clean(strings.ReplaceAll(file, `\`, "/")))
}

// parseCorpusDiagnostics reads the rule banners out of rendered diagnostics,
// ignoring ANSI styling and every line that is not a banner.
func parseCorpusDiagnostics(rendered string) ([]corpusDiagnostic, error) {
  diagnostics := []corpusDiagnostic{}
  for _, line := range strings.Split(corpusANSI.ReplaceAllString(rendered, ""), "\n") {
    matched := corpusBanner.FindStringSubmatch(strings.TrimSuffix(line, "\r"))
    if matched == nil {
      continue
    }
    severity := "error"
    if matched[3] == "warning" {
      severity = "warn"
    }
    number, err := strconv.Atoi(matched[2])
    if err != nil {
      return nil, err
    }
    diagnostics = append(diagnostics, corpusDiagnostic{corpusPortableFile(matched[1]), matched[4], severity, number})
  }
  return diagnostics, nil
}

// expectedCorpusDiagnostics lists the diagnostics an entry's annotations
// demand, all attributed to its resolved main source file.
func expectedCorpusDiagnostics(entry corpusEntry) []corpusDiagnostic {
  expected := []corpusDiagnostic{}
  for _, expectation := range entry.Expected {
    expected = append(expected, corpusDiagnostic{corpusPortableFile(entry.SourcePath), expectation.Rule, expectation.Severity, expectation.Line})
  }
  return expected
}

// writeCorpusTree materializes an in-memory corpus under a fresh temporary root
// for the loader's own cases.
func writeCorpusTree(t *testing.T, files map[string]string) string {
  t.Helper()
  root := t.TempDir()
  for name, source := range files {
    location := filepath.Join(root, filepath.FromSlash(name))
    if err := os.MkdirAll(filepath.Dir(location), 0o755); err != nil {
      t.Fatal(err)
    }
    if err := os.WriteFile(location, []byte(source), 0o644); err != nil {
      t.Fatal(err)
    }
  }
  return root
}

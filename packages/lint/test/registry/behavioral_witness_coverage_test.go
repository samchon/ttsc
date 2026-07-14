package linthost

import (
  "encoding/json"
  "flag"
  "fmt"
  "io"
  "os"
  "path"
  "path/filepath"
  "runtime"
  "sort"
  "strings"
  "sync"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// behavioralWitnessKind describes the production prerequisite exercised by a
// positive rule test. The kind is reporting metadata, not an exemption: every
// witness still has to reach a real rule through Engine or the check command
// and observe that rule's own diagnostic before it is recorded.
type behavioralWitnessKind string

const (
  behavioralWitnessEngine   behavioralWitnessKind = "engine"
  behavioralWitnessOptions  behavioralWitnessKind = "options"
  behavioralWitnessFilename behavioralWitnessKind = "filename"
  behavioralWitnessProject  behavioralWitnessKind = "project"
  behavioralWitnessChecker  behavioralWitnessKind = "checker"
  behavioralWitnessPlatform behavioralWitnessKind = "platform"
)

type behavioralWitness struct {
  Rule    string
  Route   string
  Kind    behavioralWitnessKind
  Sources []string
}

var behavioralWitnessRegistry = struct {
  sync.Mutex
  candidates map[string]map[string]behavioralWitness
}{candidates: map[string]map[string]behavioralWitness{}}

// recordBehavioralWitness is called only after a positive assertion has
// verified a production finding. Multiple positive regression tests may exist
// for one rule; the audit publishes their lexicographically first test name as
// the single canonical coverage route so the contract remains deterministic.
func recordBehavioralWitness(t *testing.T, ruleName string, kind behavioralWitnessKind) {
  t.Helper()
  recordBehavioralWitnessRoute(behavioralWitness{
    Rule:    ruleName,
    Route:   t.Name(),
    Kind:    kind,
    Sources: behavioralWitnessSourceFiles(),
  })
}

func behavioralWitnessSourceFiles() []string {
  callers := make([]uintptr, 32)
  count := runtime.Callers(2, callers)
  frames := runtime.CallersFrames(callers[:count])
  source := ""
  for {
    frame, more := frames.Next()
    if strings.HasSuffix(frame.File, "_test.go") {
      // Keep the outermost test frame, not shared recorder/helper frames. A
      // manifest therefore has to name the test that owns the positive case.
      source = filepath.Base(frame.File)
    }
    if !more {
      break
    }
  }
  if source == "" {
    return nil
  }
  return []string{source}
}

func recordBehavioralWitnessRoute(candidate behavioralWitness) {
  behavioralWitnessRegistry.Lock()
  defer behavioralWitnessRegistry.Unlock()
  routes := behavioralWitnessRegistry.candidates[candidate.Rule]
  if routes == nil {
    routes = map[string]behavioralWitness{}
    behavioralWitnessRegistry.candidates[candidate.Rule] = routes
  }
  routes[candidate.Route] = candidate
}

func recordFindingBehavioralWitnesses(
  t *testing.T,
  findings []*Finding,
  kind behavioralWitnessKind,
) {
  t.Helper()
  recordFindingBehavioralWitnessesByRule(t, findings, func(string) behavioralWitnessKind {
    return kind
  })
}

func recordFindingBehavioralWitnessesByRule(
  t *testing.T,
  findings []*Finding,
  kindForRule func(string) behavioralWitnessKind,
) {
  t.Helper()
  recorded := map[string]struct{}{}
  for _, finding := range findings {
    if finding == nil || finding.Rule == "" {
      continue
    }
    if _, ok := recorded[finding.Rule]; ok {
      continue
    }
    recorded[finding.Rule] = struct{}{}
    recordBehavioralWitness(t, finding.Rule, kindForRule(finding.Rule))
  }
}

func recordedBehavioralWitnesses() map[string][]behavioralWitness {
  behavioralWitnessRegistry.Lock()
  defer behavioralWitnessRegistry.Unlock()
  out := make(map[string][]behavioralWitness, len(behavioralWitnessRegistry.candidates))
  for ruleName, routes := range behavioralWitnessRegistry.candidates {
    for _, witness := range routes {
      witness.Sources = append([]string(nil), witness.Sources...)
      out[ruleName] = append(out[ruleName], witness)
    }
  }
  return out
}

// verifyRecordedBehavioralWitnessCoverage runs after the package test suite.
// A rule can enter the canonical map only after a positive assertion executed,
// so registry parity can no longer be satisfied by an inert rule object.
func verifyRecordedBehavioralWitnessCoverage() error {
  candidates := recordedBehavioralWitnesses()
  public := registeredRuleSetForParity()
  _, err := auditBehavioralWitnesses(public, candidates)
  if err != nil {
    return err
  }
  if err := verifyRequiredBehavioralWitnessKinds(public, candidates); err != nil {
    return err
  }
  return verifyBehavioralWitnessExclusions(public, candidates)
}

func verifyRequiredBehavioralWitnessKinds(
  public map[string]struct{},
  candidates map[string][]behavioralWitness,
) error {
  seen := map[behavioralWitnessKind]struct{}{}
  for ruleName, routes := range candidates {
    if _, ok := public[ruleName]; !ok {
      continue
    }
    for _, candidate := range routes {
      seen[candidate.Kind] = struct{}{}
    }
  }
  required := []behavioralWitnessKind{
    behavioralWitnessEngine,
    behavioralWitnessOptions,
    behavioralWitnessFilename,
    behavioralWitnessProject,
    behavioralWitnessChecker,
    behavioralWitnessPlatform,
  }
  missing := make([]string, 0)
  for _, kind := range required {
    if _, ok := seen[kind]; !ok {
      missing = append(missing, string(kind))
    }
  }
  if len(missing) != 0 {
    return fmt.Errorf("behavioral witness audit did not exercise prerequisite kinds: %v", missing)
  }
  return nil
}

type behavioralWitnessExclusion struct {
  Rule       string                `json:"rule"`
  Constraint behavioralWitnessKind `json:"constraint"`
  Harness    string                `json:"harness"`
}

func verifyBehavioralWitnessExclusions(
  public map[string]struct{},
  candidates map[string][]behavioralWitness,
) error {
  entries, lintRoot, err := loadBehavioralWitnessExclusions()
  if err != nil {
    return err
  }
  testFiles, err := behavioralWitnessTestFileCounts(filepath.Join(lintRoot, "test"))
  if err != nil {
    return err
  }
  return auditBehavioralWitnessExclusions(public, candidates, entries, testFiles)
}

func loadBehavioralWitnessExclusions() (
  []behavioralWitnessExclusion,
  string,
  error,
) {
  _, thisFile, _, ok := runtime.Caller(0)
  if !ok {
    return nil, "", fmt.Errorf("cannot locate behavioral witness exclusion manifest")
  }
  manifestName := "behavioral_witness_exclusions.json"
  locations := []string{
    filepath.Join(filepath.Dir(thisFile), manifestName),
    filepath.Join(filepath.Dir(thisFile), "..", "test", "registry", manifestName),
  }
  var manifestPath string
  for _, location := range locations {
    if _, err := os.Stat(location); err == nil {
      manifestPath = location
      break
    }
  }
  if manifestPath == "" {
    return nil, "", fmt.Errorf("cannot find %s", manifestName)
  }
  file, err := os.Open(manifestPath)
  if err != nil {
    return nil, "", err
  }
  defer file.Close()
  decoder := json.NewDecoder(file)
  decoder.DisallowUnknownFields()
  entries := []behavioralWitnessExclusion{}
  if err := decoder.Decode(&entries); err != nil {
    return nil, "", fmt.Errorf("decode %s: %w", manifestPath, err)
  }
  if err := decoder.Decode(&struct{}{}); err != io.EOF {
    return nil, "", fmt.Errorf("decode %s: trailing JSON value", manifestPath)
  }
  lintRoot := filepath.Dir(filepath.Dir(filepath.Dir(manifestPath)))
  return entries, lintRoot, nil
}

func behavioralWitnessTestFileCounts(root string) (map[string]int, error) {
  counts := map[string]int{}
  err := filepath.Walk(root, func(filePath string, info os.FileInfo, err error) error {
    if err != nil {
      return err
    }
    if !info.IsDir() && strings.HasSuffix(info.Name(), "_test.go") {
      relative, err := filepath.Rel(root, filePath)
      if err != nil {
        return err
      }
      canonical := path.Join("packages/lint/test", filepath.ToSlash(relative))
      counts[canonical]++
      counts[info.Name()]++
    }
    return nil
  })
  if err != nil {
    return nil, fmt.Errorf("scan behavioral witness harnesses: %w", err)
  }
  return counts, nil
}

func auditBehavioralWitnessExclusions(
  public map[string]struct{},
  candidates map[string][]behavioralWitness,
  entries []behavioralWitnessExclusion,
  testFiles map[string]int,
) error {
  seen := map[string]struct{}{}
  for _, entry := range entries {
    if entry.Rule == "" || entry.Harness == "" ||
      !validBehavioralWitnessKind(entry.Constraint) ||
      entry.Constraint == behavioralWitnessEngine {
      return fmt.Errorf("invalid behavioral witness exclusion: %+v", entry)
    }
    if _, duplicate := seen[entry.Rule]; duplicate {
      return fmt.Errorf("duplicate behavioral witness exclusion for %s", entry.Rule)
    }
    seen[entry.Rule] = struct{}{}
    if _, ok := public[entry.Rule]; !ok {
      return fmt.Errorf("behavioral witness exclusion names non-public rule %s", entry.Rule)
    }
    if !strings.HasPrefix(entry.Harness, "packages/lint/test/") ||
      path.Clean(entry.Harness) != entry.Harness ||
      !strings.HasSuffix(entry.Harness, "_test.go") {
      return fmt.Errorf("invalid behavioral witness harness path for %s: %s", entry.Rule, entry.Harness)
    }
    harnessFile := path.Base(entry.Harness)
    if testFiles[entry.Harness] != 1 || testFiles[harnessFile] != 1 {
      return fmt.Errorf("behavioral witness harness must exist with a unique basename for %s: %s", entry.Rule, entry.Harness)
    }
    matched := false
    for _, candidate := range candidates[entry.Rule] {
      if candidate.Kind != entry.Constraint {
        continue
      }
      for _, source := range candidate.Sources {
        if source == harnessFile {
          matched = true
          break
        }
      }
      if matched {
        break
      }
    }
    if !matched {
      return fmt.Errorf(
        "corpus exclusion for %s does not reference a positive %s witness from %s",
        entry.Rule,
        entry.Constraint,
        entry.Harness,
      )
    }
  }
  return nil
}

// shouldVerifyRecordedBehavioralWitnessCoverage preserves focused test and
// test-listing workflows. The aggregate contract is evaluated only when the
// complete package suite ran; CI and scripts/test-go-lint.cjs use that path.
func shouldVerifyRecordedBehavioralWitnessCoverage() bool {
  for _, name := range []string{"test.run", "test.skip", "test.list", "test.fuzz"} {
    value := flag.Lookup(name)
    if value != nil && value.Value.String() != "" {
      return false
    }
  }
  short := flag.Lookup("test.short")
  if short != nil && short.Value.String() == "true" {
    return false
  }
  return true
}

// auditBehavioralWitnesses returns exactly one deterministic route for every
// public built-in. Test-only, demo, and formatter registrations never enter the
// public set because registeredRuleSetForParity applies the same boundary as
// the typed-key parity test.
func auditBehavioralWitnesses(
  public map[string]struct{},
  candidates map[string][]behavioralWitness,
) (map[string]behavioralWitness, error) {
  canonical := make(map[string]behavioralWitness, len(public))
  missing := make([]string, 0)
  stale := make([]string, 0)
  invalid := make([]string, 0)

  for ruleName := range public {
    routes := append([]behavioralWitness(nil), candidates[ruleName]...)
    if len(routes) == 0 {
      missing = append(missing, ruleName)
      continue
    }
    sort.Slice(routes, func(i, j int) bool {
      if routes[i].Route != routes[j].Route {
        return routes[i].Route < routes[j].Route
      }
      return routes[i].Kind < routes[j].Kind
    })
    valid := true
    for _, candidate := range routes {
      if candidate.Rule != ruleName || candidate.Route == "" ||
        !validBehavioralWitnessKind(candidate.Kind) ||
        !validBehavioralWitnessSources(candidate.Sources) {
        invalid = append(invalid, fmt.Sprintf("%s=%+v", ruleName, candidate))
        valid = false
      }
    }
    if valid {
      canonical[ruleName] = routes[0]
    }
  }
  for ruleName := range candidates {
    if _, ok := public[ruleName]; !ok && !isNonPublicRuleName(ruleName) {
      stale = append(stale, ruleName)
    }
  }
  sort.Strings(missing)
  sort.Strings(stale)
  sort.Strings(invalid)
  if len(missing) != 0 || len(stale) != 0 || len(invalid) != 0 {
    parts := make([]string, 0, 3)
    if len(missing) != 0 {
      parts = append(parts, fmt.Sprintf("public rules without a positive production witness: %v", missing))
    }
    if len(stale) != 0 {
      parts = append(parts, fmt.Sprintf("witnesses for non-public rules: %v", stale))
    }
    if len(invalid) != 0 {
      parts = append(parts, fmt.Sprintf("invalid witness records: %v", invalid))
    }
    return nil, fmt.Errorf("behavioral witness audit failed: %s", strings.Join(parts, "; "))
  }
  return canonical, nil
}

func validBehavioralWitnessKind(kind behavioralWitnessKind) bool {
  switch kind {
  case behavioralWitnessEngine,
    behavioralWitnessOptions,
    behavioralWitnessFilename,
    behavioralWitnessProject,
    behavioralWitnessChecker,
    behavioralWitnessPlatform:
    return true
  default:
    return false
  }
}

func behavioralWitnessKindForRule(ruleName string) behavioralWitnessKind {
  if rule := LookupRule(ruleName); ruleNeedsTypeChecker(rule) {
    return behavioralWitnessChecker
  }
  return behavioralWitnessEngine
}

func behavioralWitnessKindForOptions(
  ruleName string,
  options RuleOptionsMap,
) behavioralWitnessKind {
  if _, ok := options[ruleName]; ok {
    return behavioralWitnessOptions
  }
  return behavioralWitnessEngine
}

func validBehavioralWitnessSources(sources []string) bool {
  if len(sources) != 1 {
    return false
  }
  source := sources[0]
  return source != "" && filepath.Base(source) == source &&
    strings.HasSuffix(source, "_test.go")
}

func isNonPublicRuleName(ruleName string) bool {
  return strings.HasPrefix(ruleName, "format/") ||
    strings.HasPrefix(ruleName, "test/") ||
    strings.HasPrefix(ruleName, "demo/")
}

type inertBehavioralWitnessRule struct{}

func (inertBehavioralWitnessRule) Name() string {
  return "test/behavioral-witness-inert"
}

func (inertBehavioralWitnessRule) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindSourceFile}
}

func (inertBehavioralWitnessRule) Check(*Context, *shimast.Node) {}

// TestBehavioralWitnessAuditRejectsInertPublicRule is the regression sentinel.
// It runs an actual registered no-op rule through production Engine dispatch,
// then proves that the absence of a diagnostic leaves the synthetic public key
// uncovered.
func TestBehavioralWitnessAuditRejectsInertPublicRule(t *testing.T) {
  inert := inertBehavioralWitnessRule{}
  Register(inert)
  t.Cleanup(func() {
    delete(registered.rules, inert.Name())
  })
  file := parseTS(t, "const value = 1;\nvoid value;\n")
  findings := NewEngine(RuleConfig{inert.Name(): SeverityError}).Run(
    []*shimast.SourceFile{file},
    nil,
  )
  if len(findings) != 0 {
    t.Fatalf("inert fixture unexpectedly diagnosed: %+v", findings)
  }
  _, err := auditBehavioralWitnesses(
    map[string]struct{}{inert.Name(): {}},
    map[string][]behavioralWitness{},
  )
  if err == nil || !strings.Contains(err.Error(), inert.Name()) {
    t.Fatalf("inert public rule was not rejected: %v", err)
  }
}

// TestBehavioralWitnessAuditAcceptsProductionPrerequisiteKinds proves that a
// dedicated positive harness remains a first-class route for rules that cannot
// run in the flat corpus. The kinds do not fabricate findings; real tests call
// recordBehavioralWitness only after production dispatch returns a diagnostic.
func TestBehavioralWitnessAuditAcceptsProductionPrerequisiteKinds(t *testing.T) {
  kinds := []behavioralWitnessKind{
    behavioralWitnessOptions,
    behavioralWitnessFilename,
    behavioralWitnessProject,
    behavioralWitnessChecker,
    behavioralWitnessPlatform,
  }
  public := map[string]struct{}{}
  candidates := map[string][]behavioralWitness{}
  for index, kind := range kinds {
    ruleName := fmt.Sprintf("fixture/rule-%d", index)
    public[ruleName] = struct{}{}
    candidates[ruleName] = []behavioralWitness{{
      Rule:    ruleName,
      Route:   "Test" + string(kind),
      Kind:    kind,
      Sources: []string{"fixture_test.go"},
    }}
  }
  canonical, err := auditBehavioralWitnesses(public, candidates)
  if err != nil {
    t.Fatalf("valid prerequisite witness kinds were rejected: %v", err)
  }
  if len(canonical) != len(public) {
    t.Fatalf("canonical routes = %d, want %d: %+v", len(canonical), len(public), canonical)
  }
  public["fixture/engine"] = struct{}{}
  candidates["fixture/engine"] = []behavioralWitness{{
    Rule:    "fixture/engine",
    Route:   "Testengine",
    Kind:    behavioralWitnessEngine,
    Sources: []string{"fixture_test.go"},
  }}
  if err := verifyRequiredBehavioralWitnessKinds(public, candidates); err != nil {
    t.Fatalf("required prerequisite kinds were rejected: %v", err)
  }
}

func TestBehavioralWitnessAuditPublishesOneDeterministicRoutePerRule(t *testing.T) {
  public := map[string]struct{}{"fixture/rule": {}}
  candidates := map[string][]behavioralWitness{
    "fixture/rule": {
      {Rule: "fixture/rule", Route: "TestZulu", Kind: behavioralWitnessProject, Sources: []string{"zulu_test.go"}},
      {Rule: "fixture/rule", Route: "TestAlpha", Kind: behavioralWitnessEngine, Sources: []string{"alpha_test.go"}},
    },
  }
  canonical, err := auditBehavioralWitnesses(public, candidates)
  if err != nil {
    t.Fatalf("audit failed: %v", err)
  }
  if len(canonical) != 1 || canonical["fixture/rule"].Route != "TestAlpha" {
    t.Fatalf("canonical route was not deterministic: %+v", canonical)
  }
}

func TestBehavioralWitnessAuditRejectsInvalidNonCanonicalCandidate(t *testing.T) {
  public := map[string]struct{}{"fixture/rule": {}}
  candidates := map[string][]behavioralWitness{
    "fixture/rule": {
      {Rule: "fixture/rule", Route: "TestAlpha", Kind: behavioralWitnessEngine, Sources: []string{"alpha_test.go"}},
      {Rule: "fixture/other", Route: "TestZulu", Kind: behavioralWitnessEngine, Sources: []string{"zulu_test.go"}},
    },
  }
  _, err := auditBehavioralWitnesses(public, candidates)
  if err == nil || !strings.Contains(err.Error(), "fixture/other") {
    t.Fatalf("invalid non-canonical candidate was not rejected: %v", err)
  }
}

func TestRequiredBehavioralWitnessKindsIgnoreNonPublicCandidates(t *testing.T) {
  public := map[string]struct{}{
    "fixture/engine":   {},
    "fixture/options":  {},
    "fixture/filename": {},
    "fixture/project":  {},
    "fixture/checker":  {},
  }
  candidates := map[string][]behavioralWitness{}
  for ruleName, kind := range map[string]behavioralWitnessKind{
    "fixture/engine":   behavioralWitnessEngine,
    "fixture/options":  behavioralWitnessOptions,
    "fixture/filename": behavioralWitnessFilename,
    "fixture/project":  behavioralWitnessProject,
    "fixture/checker":  behavioralWitnessChecker,
    "test/platform":    behavioralWitnessPlatform,
  } {
    candidates[ruleName] = []behavioralWitness{{
      Rule:    ruleName,
      Route:   "Test" + string(kind),
      Kind:    kind,
      Sources: []string{"fixture_test.go"},
    }}
  }
  err := verifyRequiredBehavioralWitnessKinds(public, candidates)
  if err == nil || !strings.Contains(err.Error(), string(behavioralWitnessPlatform)) {
    t.Fatalf("non-public platform candidate satisfied the public kind audit: %v", err)
  }
}

func TestBehavioralWitnessKindForRuleRequiresTypeAwareRule(t *testing.T) {
  for _, test := range []struct {
    rule string
    want behavioralWitnessKind
  }{
    {rule: "no-debugger", want: behavioralWitnessEngine},
    {rule: "typescript/await-thenable", want: behavioralWitnessChecker},
  } {
    if LookupRule(test.rule) == nil {
      t.Fatalf("regression fixture rule is not registered: %s", test.rule)
    }
    if got := behavioralWitnessKindForRule(test.rule); got != test.want {
      t.Fatalf("behavioral witness kind for %s = %s, want %s", test.rule, got, test.want)
    }
  }
}

func TestBehavioralWitnessExclusionAuditBindsConstraintAndHarness(t *testing.T) {
  ruleName := "fixture/options-rule"
  harness := "packages/lint/test/rules/fixture/options_rule_test.go"
  public := map[string]struct{}{ruleName: {}}
  entries := []behavioralWitnessExclusion{{
    Rule:       ruleName,
    Constraint: behavioralWitnessOptions,
    Harness:    harness,
  }}
  testFiles := map[string]int{
    harness:                1,
    "options_rule_test.go": 1,
  }
  valid := map[string][]behavioralWitness{
    ruleName: {{
      Rule:    ruleName,
      Route:   "TestOptionsRule",
      Kind:    behavioralWitnessOptions,
      Sources: []string{"options_rule_test.go"},
    }},
  }
  if err := auditBehavioralWitnessExclusions(public, valid, entries, testFiles); err != nil {
    t.Fatalf("valid exclusion was rejected: %v", err)
  }

  wrongKind := map[string][]behavioralWitness{
    ruleName: {{
      Rule:    ruleName,
      Route:   "TestOptionsRule",
      Kind:    behavioralWitnessEngine,
      Sources: []string{"options_rule_test.go"},
    }},
  }
  if err := auditBehavioralWitnessExclusions(public, wrongKind, entries, testFiles); err == nil {
    t.Fatal("engine witness satisfied an options-dependent exclusion")
  }

  wrongHarness := map[string][]behavioralWitness{
    ruleName: {{
      Rule:    ruleName,
      Route:   "TestOtherRule",
      Kind:    behavioralWitnessOptions,
      Sources: []string{"other_rule_test.go"},
    }},
  }
  if err := auditBehavioralWitnessExclusions(public, wrongHarness, entries, testFiles); err == nil {
    t.Fatal("detached harness satisfied a corpus exclusion")
  }

  escaped := append([]behavioralWitnessExclusion(nil), entries...)
  escaped[0].Harness = "packages/lint/test/../outside_test.go"
  escapedCandidates := map[string][]behavioralWitness{
    ruleName: {{
      Rule:    ruleName,
      Route:   "TestOutsideRule",
      Kind:    behavioralWitnessOptions,
      Sources: []string{"outside_test.go"},
    }},
  }
  escapedTestFiles := map[string]int{
    escaped[0].Harness: 1,
    "outside_test.go":  1,
  }
  if err := auditBehavioralWitnessExclusions(
    public,
    escapedCandidates,
    escaped,
    escapedTestFiles,
  ); err == nil {
    t.Fatal("path-traversing harness satisfied a corpus exclusion")
  }
}

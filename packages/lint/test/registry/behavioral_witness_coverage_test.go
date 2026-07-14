package linthost

import (
  "flag"
  "fmt"
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
  Rule  string
  Route string
  Kind  behavioralWitnessKind
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
    Rule:  ruleName,
    Route: t.Name(),
    Kind:  kind,
  })
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
  recorded := map[string]struct{}{}
  for _, finding := range findings {
    if finding == nil || finding.Rule == "" {
      continue
    }
    if _, ok := recorded[finding.Rule]; ok {
      continue
    }
    recorded[finding.Rule] = struct{}{}
    recordBehavioralWitness(t, finding.Rule, kind)
  }
}

func recordedBehavioralWitnesses() map[string][]behavioralWitness {
  behavioralWitnessRegistry.Lock()
  defer behavioralWitnessRegistry.Unlock()
  out := make(map[string][]behavioralWitness, len(behavioralWitnessRegistry.candidates))
  for ruleName, routes := range behavioralWitnessRegistry.candidates {
    for _, witness := range routes {
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
  return verifyRequiredBehavioralWitnessKinds(public, candidates)
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
      if candidate.Rule != ruleName || candidate.Route == "" || !validBehavioralWitnessKind(candidate.Kind) {
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
      Rule:  ruleName,
      Route: "Test" + string(kind),
      Kind:  kind,
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
    Rule:  "fixture/engine",
    Route: "Testengine",
    Kind:  behavioralWitnessEngine,
  }}
  if err := verifyRequiredBehavioralWitnessKinds(public, candidates); err != nil {
    t.Fatalf("required prerequisite kinds were rejected: %v", err)
  }
}

func TestBehavioralWitnessAuditPublishesOneDeterministicRoutePerRule(t *testing.T) {
  public := map[string]struct{}{"fixture/rule": {}}
  candidates := map[string][]behavioralWitness{
    "fixture/rule": {
      {Rule: "fixture/rule", Route: "TestZulu", Kind: behavioralWitnessProject},
      {Rule: "fixture/rule", Route: "TestAlpha", Kind: behavioralWitnessEngine},
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
      {Rule: "fixture/rule", Route: "TestAlpha", Kind: behavioralWitnessEngine},
      {Rule: "fixture/other", Route: "TestZulu", Kind: behavioralWitnessEngine},
    },
  }
  _, err := auditBehavioralWitnesses(public, candidates)
  if err == nil || !strings.Contains(err.Error(), "fixture/other") {
    t.Fatalf("invalid non-canonical candidate was not rejected: %v", err)
  }
}

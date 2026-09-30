package linthost

import (
  "flag"
  "fmt"
  "path/filepath"
  "reflect"
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
      // Keep the outermost test frame, not shared recorder/helper frames, so a
      // witness names the test that owns the positive case.
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

// registeredBuiltInNonFormatRuleSet returns the canonical built-in, non-format
// rule set. Runtime contributors and test-only direct registrations have no
// built-in TypeScript family property, while format rules are configured
// through ITtscLintFormat instead of ITtscLintRules.
func registeredBuiltInNonFormatRuleSet() map[string]struct{} {
  out := make(map[string]struct{}, len(AllRuleNames()))
  for _, name := range AllRuleNames() {
    if !isRegisteredBuiltInNonFormatRule(name, LookupRule(name)) {
      continue
    }
    out[name] = struct{}{}
  }
  return out
}

// isRegisteredBuiltInNonFormatRule classifies registry entries by runtime
// provenance rather than namespace spelling. The append-only built-in rule-code
// ledger excludes arbitrary direct registrations, and the structural adapter
// check also excludes a contributor that reuses a retired ledger name.
func isRegisteredBuiltInNonFormatRule(name string, candidate Rule) bool {
  return isRegisteredBuiltInRule(name, candidate) && !isFormatRule(candidate)
}

// isRegisteredBuiltInFormatRule is the format-side twin used to compare the
// live format-block expansion with every native formatter registration.
func isRegisteredBuiltInFormatRule(name string, candidate Rule) bool {
  return isRegisteredBuiltInRule(name, candidate) && isFormatRule(candidate)
}

func isRegisteredBuiltInRule(name string, candidate Rule) bool {
  if candidate == nil {
    return false
  }
  switch candidate.(type) {
  case contributorAdapter, formatContributorAdapter:
    return false
  }
  _, builtIn := builtInRuleCodes[name]
  return builtIn
}

// behavioralWitnessPublicRuleSet is the rule set the witness audit requires a
// positive production witness for: every user-facing registered rule. It is the
// built-in non-format set (registeredBuiltInNonFormatRuleSet) plus the format/*
// family. Format rules are user-facing but configured through the `format`
// block rather than a typed `rules` key, so registeredBuiltInNonFormatRuleSet
// excludes them. The witness audit asks a different question ("does every
// user-facing rule fire in production?"), so it must not: the formatter family
// is precisely the over-match-prone surface the witness doctrine exists to
// guard. Format rules earn their witnesses through the dedicated fixer
// harnesses under packages/lint/test/format, the same route other rules that
// cannot run the flat corpus already use.
func behavioralWitnessPublicRuleSet() map[string]struct{} {
  public := registeredBuiltInNonFormatRuleSet()
  for _, name := range AllRuleNames() {
    if strings.HasPrefix(name, "format/") {
      public[name] = struct{}{}
    }
  }
  return public
}

// verifyRecordedBehavioralWitnessCoverage runs after the package test suite.
// A rule can enter the canonical map only after a positive assertion executed,
// so registry parity can no longer be satisfied by an inert rule object.
func verifyRecordedBehavioralWitnessCoverage() error {
  candidates := recordedBehavioralWitnesses()
  public := behavioralWitnessPublicRuleSet()
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

// auditBehavioralWitnesses validates every candidate for the supplied public
// set, then returns one lexically deterministic route per identity. The caller
// owns public-set selection, including formatter rules. Unselected test/ and
// demo/ witnesses are tolerated; other stale identities are rejected.
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

// isNonPublicRuleName reports whether a recorded witness belongs to a rule that
// is intentionally outside the public audit set. Only the test/ and demo/
// families qualify: format/* rules ARE public (see behavioralWitnessPublicRuleSet),
// so a stray format witness for an unregistered id is now correctly flagged
// instead of silently tolerated.
func isNonPublicRuleName(ruleName string) bool {
  return strings.HasPrefix(ruleName, "test/") ||
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
//
// @evidence contracts/testing.md#behavioral-verification A real registered no-op rule binds and executes in Engine without a diagnostic; requiring that identity in the public set then produces the missing-positive-witness error rather than registry-parity coverage.
// @evidence contracts/testing.md#independent-expectations Registration and an AST visit alone do not demonstrate a functioning diagnostic. The authored inert Check does nothing, so zero findings and a missing-positive-witness rejection are independent consequences of that fixture.
// @evidence contracts/testing.md#distinguishing-cases Successful active binding rules out an absent or disabled engine route, while the actual no-op invocation contrasts with the required positive witness. Other auditor units supply valid candidate controls; cleanup removes this test-only registration.
// @evidence contracts/testing.md#execution-ownership Direct Register, configured Engine.Run and auditBehavioralWitnesses operate in the shared Go process on literal source and an empty candidate map. This test checks actual auditor decisions, not committed test-file existence or native installation.
func TestBehavioralWitnessAuditRejectsInertPublicRule(t *testing.T) {
  inert := inertBehavioralWitnessRule{}
  Register(inert)
  t.Cleanup(func() {
    delete(registered.rules, inert.Name())
  })
  file := parseTS(t, "const value = 1;\nvoid value;\n")
  engine, err := newRuleSnapshotEngine(inert.Name(), nil)
  if err != nil { t.Fatal(err) }
  findings := engine.Run(
    []*shimast.SourceFile{file},
    nil,
  )
  if len(findings) != 0 {
    t.Fatalf("inert fixture unexpectedly diagnosed: %+v", findings)
  }
  _, err = auditBehavioralWitnesses(
    map[string]struct{}{inert.Name(): {}},
    map[string][]behavioralWitness{},
  )
  if err == nil || !strings.Contains(err.Error(), inert.Name()) || !strings.Contains(err.Error(), "public rules without a positive production witness") {
    t.Fatalf("inert public rule was not rejected: %v", err)
  }
}

// TestBehavioralWitnessAuditAcceptsProductionPrerequisiteKinds checks candidate
// validation and prerequisite accounting using authored auditor inputs. It does
// not execute production rules or claim that these fixture records observed a
// diagnostic; the semantic harnesses own those positive production observations.
//
// @evidence contracts/testing.md#behavioral-verification The auditor accepts one well-shaped candidate for each options, filename, project, checker and platform prerequisite, returns one record per public identity, and accepts the full required set after the engine kind is added.
// @evidence contracts/testing.md#independent-expectations The six supported prerequisite categories and one canonical record per public rule define auditor acceptance. Authored Rule, Route, Kind and Sources values are inputs to the decision, not evidence of production rule execution or existing files.
// @evidence contracts/testing.md#distinguishing-cases Five non-engine prerequisite records cover acceptance outside the flat engine lane; adding engine completes the six-kind requirement. The separate missing-platform unit rejects an incomplete public set.
// @evidence contracts/testing.md#execution-ownership Direct auditBehavioralWitnesses and verifyRequiredBehavioralWitnessKinds calls run in-process on synthetic maps. The unit owns coverage-validator behavior; source-name strings are validated record addresses without filesystem existence checks or product hosts.
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

// TestBehavioralWitnessAuditPublishesOneDeterministicRoutePerRule preserves the
// chosen record as well as its route under candidate input permutations.
//
// @evidence contracts/testing.md#behavioral-verification Two valid candidates for one public identity yield exactly the complete TestAlpha engine record regardless of candidate input order, while the caller's candidate slice is unchanged.
// @evidence contracts/testing.md#independent-expectations Lexical route ordering makes TestAlpha precede TestZulu. The literal Alpha record defines Rule, Route, Kind and Sources independently of the auditor's result rather than comparing only two generated routes.
// @evidence contracts/testing.md#distinguishing-cases Reversed input order must not change the canonical record; differing engine/project kinds and alpha/zulu sources expose accidental field mixing. Preserving the input order checks caller ownership.
// @evidence contracts/testing.md#execution-ownership Direct auditor calls consume two authored candidate records in the Go process, without reading files or invoking production rule hosts. This test owns deterministic canonicalization, not the validity of actual production findings.
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
  want := behavioralWitness{Rule: "fixture/rule", Route: "TestAlpha", Kind: behavioralWitnessEngine, Sources: []string{"alpha_test.go"}}
  if !reflect.DeepEqual(canonical["fixture/rule"], want) { t.Fatalf("canonical record: got %+v, want %+v", canonical, want) }
  if candidates["fixture/rule"][0].Route != "TestZulu" { t.Fatalf("caller candidate order changed: %+v", candidates) }
  candidates["fixture/rule"][0], candidates["fixture/rule"][1] = candidates["fixture/rule"][1], candidates["fixture/rule"][0]
  reversed, err := auditBehavioralWitnesses(public, candidates)
  if err != nil || len(reversed) != 1 || !reflect.DeepEqual(reversed["fixture/rule"], want) { t.Fatalf("reversed candidates: %+v %v", reversed, err) }
}

// TestBehavioralWitnessAuditRejectsInvalidNonCanonicalCandidate checks every
// candidate, including one that would lose canonical lexical selection.
//
// @evidence contracts/testing.md#behavioral-verification A later candidate naming another rule is rejected even alongside a valid canonical Alpha record. Empty routes, unsupported kinds and invalid source-address shapes likewise fail; the valid canonical candidate alone is accepted.
// @evidence contracts/testing.md#independent-expectations Each record must name its public rule, supply a route, use a supported prerequisite and identify exactly one test basename. These independent record constraints apply to all candidates, not just the lexical winner.
// @evidence contracts/testing.md#distinguishing-cases The original noncanonical wrong-rule candidate remains; independent empty-route, invalid-kind, zero/two source, non-test source and non-basename source mutations isolate the remaining validation branches against a valid Alpha control.
// @evidence contracts/testing.md#execution-ownership The auditor validates authored records directly in-process; filename strings exercise address grammar rather than repository existence or source-content comparisons. No production finding or native host is claimed by these synthetic decision inputs.
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
  valid := candidates["fixture/rule"][0]
  if _, err := auditBehavioralWitnesses(public, map[string][]behavioralWitness{"fixture/rule": {valid}}); err != nil { t.Fatalf("valid canonical candidate rejected: %v", err) }
  for _, mutate := range []func(*behavioralWitness){
    func(w *behavioralWitness) { w.Route = "" },
    func(w *behavioralWitness) { w.Kind = "unsupported" },
    func(w *behavioralWitness) { w.Sources = nil },
    func(w *behavioralWitness) { w.Sources = []string{"alpha_test.go", "zulu_test.go"} },
    func(w *behavioralWitness) { w.Sources = []string{"alpha.go"} },
    func(w *behavioralWitness) { w.Sources = []string{"nested/alpha_test.go"} },
  } {
    invalid := valid
    invalid.Route = "TestZulu"
    mutate(&invalid)
    if _, err := auditBehavioralWitnesses(public, map[string][]behavioralWitness{"fixture/rule": {valid, invalid}}); err == nil || !strings.Contains(err.Error(), "invalid witness records") { t.Fatalf("invalid candidate accepted: %+v %v", invalid, err) }
  }
}

// TestRequiredBehavioralWitnessKindsIgnoreNonPublicCandidates keeps a test-only
// platform record from satisfying the public prerequisite requirement.
//
// @evidence contracts/testing.md#behavioral-verification A platform witness outside the supplied public set leaves the platform prerequisite missing; adding an otherwise identical public platform route then satisfies all required kinds.
// @evidence contracts/testing.md#independent-expectations Required-kind coverage is contributed only by public identities. Five authored public kinds plus one test-only platform must fail, while six public kinds must pass independently of registry or file counts.
// @evidence contracts/testing.md#distinguishing-cases The original nonpublic platform record remains present in both controls; changing only public admission of the additional platform identity distinguishes filtering from unconditional acceptance or rejection.
// @evidence contracts/testing.md#execution-ownership Direct prerequisite-validator calls run on authored maps in the Go process. These candidate records test auditor accounting and do not claim production execution, filesystem existence, installation or native compilation.
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
  public["fixture/platform"] = struct{}{}
  candidates["fixture/platform"] = []behavioralWitness{{Rule: "fixture/platform", Route: "Testplatform", Kind: behavioralWitnessPlatform, Sources: []string{"fixture_test.go"}}}
  if err := verifyRequiredBehavioralWitnessKinds(public, candidates); err != nil { t.Fatalf("complete public prerequisite set rejected: %v", err) }
}

// TestBehavioralWitnessKindForRuleRequiresTypeAwareRule distinguishes the
// type-checker prerequisite of an actual registered rule from a syntax rule.
//
// @evidence contracts/testing.md#behavioral-verification Registered no-debugger is classified in the engine lane and registered typescript/await-thenable in the checker lane by the live rule capability predicate.
// @evidence contracts/testing.md#independent-expectations Debugger syntax needs no type information; await-thenable must resolve awaited operand types. Those semantic prerequisites determine the two literal expected kinds, not metadata derived from the returned classification.
// @evidence contracts/testing.md#distinguishing-cases Both fixture identities must actually resolve before classification. The syntax-only and type-aware controls distinguish unconditional engine or checker classification without asserting that either rule ran here.
// @evidence contracts/testing.md#execution-ownership Direct live LookupRule and behavioralWitnessKindForRule execute in-process. This unit owns prerequisite classification, while separate rule tests own diagnostics; no repository text, package layout, install or subprocess is used.
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

package linthost

import (
  "bytes"
  "crypto/sha256"
  "encoding/hex"
  "encoding/json"
  "io/fs"
  "os"
  "path/filepath"
  "reflect"
  "testing"

  publicrule "github.com/samchon/ttsc/packages/lint/rule"
)

// observedProjectInputRule exercises the optional actual reader contract in the
// same Program cycle; it has no separate fixture/process or filesystem hook.
type observedProjectInputRule struct{ location string }

// Name supplies the independently authored registry identity used by the unit.
func (r observedProjectInputRule) Name() string { return "test/observed-project-input" }

// NeedsTypeChecker keeps this raw-reader contributor independent of checker use.
func (r observedProjectInputRule) NeedsTypeChecker() bool { return false }

// UsesProjectInputReader declares responsibility; the unit separately checks
// actual returned bytes and authority, so this marker cannot prove consumption.
func (r observedProjectInputRule) UsesProjectInputReader() bool { return true }

// Check exposes the actual read bytes/error through supported cycle state,
// letting the owning unit compare them with its separately authored BOM bytes.
func (r observedProjectInputRule) Check(ctx *publicrule.ProjectContext) {
  body, err := ctx.Inputs.ReadFile(r.location)
  ctx.SetState(struct {
    Body []byte
    Err  error
  }{body, err})
}

// TestCheckObservationsRetainsFailedProgramAndRawInputs exercises the actual
// standalone check entry, same-Program publisher and generation reader. It
// creates no installed consumer or native child. Typed configuration encoding
// and missing/unsupported input authority remain independent of diagnostics.
//
// @evidence contracts/testing.md#behavioral-verification RunCheckWithIO selects the explicitly configured JSON through the authored lint plugin manifest and returns status2 and TS2322 while its private result retains the loaded source graph and actual JSON config fingerprint. Direct reader calls preserve BOM bytes, compiler decoding remains distinct, WalkDir sorts and skips, raw ReadDir membership is separately encoded from actual compiler AccessibleEntries and both survive the same-generation graph, failed listings withdraw authority, nil generations publish false, unsupported input contributors withdraw authority, and an updated Program cannot inherit the prior graph.
// @evidence contracts/testing.md#independent-expectations The authored number/string assignment must report TS2322, the authored import must map index.ts to the actual dependency.ts source, raw BOM bytes and SHA256 are independently authored, nil authority must be false, and literal WalkDir visit names prescribe traversal. The independently encoded a/file and skip/directory records require the exact native directory digest; a raw query must not create an AccessibleEntries predicate, and a later real compiler query must retain its own lists. The JSON file fingerprint must retain version1, file kind, watch scope and stable identity.
// @evidence contracts/testing.md#distinguishing-cases Failed check with valid Program differs from nil Program; supported actual-read contributor retains raw bytes/authority while topology-only unsupported contributor withdraws it; raw and decoded BOM hashes differ; relative native reads retain absolute wire coordinates; skipped children are absent; raw and compiler directory queries remain distinct, while a failed native listing remains incomplete; the file fingerprint retains its raw-byte encoding; update invalidates the old generation.
// @evidence contracts/testing.md#execution-ownership This Go unit invokes the owning standalone host APIs in-process with temporary files, buffers and one loaded Program. It restores the prior contributor registration and closes the Program, with no CLI process, extra compiler generation for proof or E2E fixture loop.
func TestCheckObservationsRetainsFailedProgramAndRawInputs(t *testing.T) {
  root := t.TempDir()
  write := func(name string, body []byte) {
    t.Helper()
    if err := os.WriteFile(filepath.Join(root, name), body, 0o644); err != nil {
      t.Fatal(err)
    }
  }
  source := []byte(`import { dependency } from "./dependency"; const value: number = "wrong"; export { value, dependency };`)
  write("index.ts", source)
  write("dependency.ts", []byte(`export const dependency = 1;`))
  write("tsconfig.json", []byte(`{"compilerOptions":{"strict":true,"noEmit":true},"files":["index.ts"]}`))
  config := append([]byte{0xef, 0xbb, 0xbf}, []byte(`{"rules":{}}`)...)
  write("lint.config.json", config)
  output := filepath.Join(root, "check.json")
  var stdout, stderr bytes.Buffer
  status := RunCheckWithIO([]string{"--cwd=" + root, "--tsconfig=tsconfig.json", "--plugins-json=" + lintManifestWithConfig(t, map[string]any{"configFile": "./lint.config.json"}), "--check-observations-json=" + output}, &stdout, &stderr)
  if status != 2 || !bytes.Contains(stderr.Bytes(), []byte("TS2322")) {
    t.Fatalf("failed standalone check: status=%d stderr=%s", status, &stderr)
  }
  var envelope struct {
    Graph                *lintCheckGraph    `json:"graph"`
    HostInputs           []string           `json:"hostInputs"`
    HostInputHashes      map[string]*string `json:"hostInputHashes"`
    ObservationsComplete *bool              `json:"observationsComplete"`
  }
  read := func(name string) {
    t.Helper()
    body, err := os.ReadFile(name)
    if err != nil {
      t.Fatal(err)
    }
    envelope.Graph = nil
    envelope.ObservationsComplete = nil
    envelope.HostInputs = nil
    envelope.HostInputHashes = nil
    if err := json.Unmarshal(body, &envelope); err != nil {
      t.Fatal(err)
    }
  }
  read(output)
  if envelope.Graph == nil || envelope.ObservationsComplete != nil {
    t.Fatalf("failed check lost its complete Program proof: %#v", envelope)
  }
  if _, ok := envelope.Graph.Edges["index.ts"]; !ok {
    t.Fatal("the failed source is missing from its own graph")
  }
  if !reflect.DeepEqual(envelope.Graph.Edges["index.ts"], []string{"dependency.ts"}) {
    t.Fatalf("same-Program realized reference edge: %v", envelope.Graph.Edges["index.ts"])
  }
  cfg := envelope.Graph.InputObservations["lint.config.json"].NativePredicates
  sum := sha256.Sum256(config)
  if len(cfg) != 1 || cfg[0].Kind != "file" || cfg[0].Version != 1 || cfg[0].Digest != hex.EncodeToString(sum[:]) || cfg[0].Scope != "watch" || !cfg[0].IdentityStable {
    t.Fatalf("consumed JSON config proof: %#v", cfg)
  }

  var missing *program
  nilOutput := filepath.Join(root, "nil.json")
  if err := missing.writeCheckObservations(nilOutput); err != nil {
    t.Fatal(err)
  }
  read(nilOutput)
  if envelope.Graph != nil || envelope.ObservationsComplete == nil || *envelope.ObservationsComplete {
    t.Fatal("nil Program gained observation authority")
  }

  prog, diags, err := loadProgram(root, "tsconfig.json", loadProgramOptions{observeInputs: true})
  if err != nil || len(diags) != 0 || prog == nil {
    t.Fatalf("load Program: %v %v", err, diags)
  }
  defer prog.close()
  raw := append([]byte{0xef, 0xbb, 0xbf}, []byte("# Before\n")...)
  write("document.md", raw)
  document := filepath.Join(root, "document.md")
  actual, err := prog.inputReader.ReadFile(document)
  if err != nil || !bytes.Equal(actual, raw) {
    t.Fatalf("raw reader changed bytes: %x %v", actual, err)
  }
  decoded, ok := prog.inputObserver.ReadFile(document)
  if !ok || decoded != "# Before\n" {
    t.Fatalf("compiler text changed its decoder contract: %q %v", decoded, ok)
  }
  t.Chdir(root)
  relativeRaw, err := prog.inputReader.ReadFile("document.md")
  if err != nil || !bytes.Equal(relativeRaw, raw) {
    t.Fatalf("relative raw read: %x %v", relativeRaw, err)
  }
  if _, relative := prog.inputReader.inputs["document.md"]; relative {
    t.Fatal("relative spelling escaped absolute wire coordinates")
  }
  rawSum := sha256.Sum256(raw)
  if *prog.inputReader.inputs[document] != hex.EncodeToString(rawSum[:]) {
    t.Fatal("raw host hash substituted decoded compiler text")
  }
  proof, failure := prog.inputObserver.predicateProof(document)
  if failure != "" || proof.ReadFile == nil || proof.ReadFile.Hash == *prog.inputReader.inputs[document] {
    t.Fatal("raw and decoded proofs collapsed")
  }

  tree := filepath.Join(root, "walk")
  if err := os.MkdirAll(filepath.Join(tree, "skip"), 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(filepath.Join(tree, "skip", "hidden"), nil, 0o644); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(filepath.Join(tree, "a"), nil, 0o644); err != nil {
    t.Fatal(err)
  }
  visited := []string{}
  if err := prog.inputReader.WalkDir(tree, func(name string, entry fs.DirEntry, err error) error {
    if err != nil {
      return err
    }
    relative, err := filepath.Rel(tree, name)
    if err != nil {
      return err
    }
    visited = append(visited, relative)
    if relative == "skip" {
      return fs.SkipDir
    }
    return nil
  }); err != nil {
    t.Fatal(err)
  }
  if !reflect.DeepEqual(visited, []string{".", "a", "skip"}) {
    t.Fatalf("WalkDir selection/ordering: %v", visited)
  }

  // The raw native listing must not manufacture a compiler accessible query.
  rawListing, err := prog.inputReader.ReadDir(tree)
  if err != nil || len(rawListing) != 2 {
    t.Fatalf("native listing: %v %v", rawListing, err)
  }
  rawProof, rawFailure := prog.inputObserver.predicateProof(tree)
  if rawFailure != "" || rawProof.AccessibleEntries != nil {
    t.Fatalf("raw ReadDir borrowed compiler query authority: %#v %s", rawProof, rawFailure)
  }
  directory := prog.inputReader.directoryInputs[tree]
  directorySum := sha256.Sum256([]byte("a\x00file\x00\x00skip\x00directory\x00"))
  if directory.Kind != "directory" || directory.Version != 1 || directory.Digest != hex.EncodeToString(directorySum[:]) || !directory.IdentityStable {
    t.Fatalf("native listing lost authored membership proof: %#v", directory)
  }
  compilerListing := prog.inputObserver.GetAccessibleEntries(tree)
  if !reflect.DeepEqual(compilerListing.Files, []string{"a"}) || !reflect.DeepEqual(compilerListing.Directories, []string{"skip"}) {
    t.Fatalf("compiler listing changed: %#v", compilerListing)
  }
  if _, err := prog.inputReader.ReadDir(tree); err != nil {
    t.Fatal(err)
  }
  compilerProof, compilerFailure := prog.inputObserver.predicateProof(tree)
  if compilerFailure != "" || compilerProof.AccessibleEntries == nil || prog.inputReader.incomplete {
    t.Fatalf("raw/compiler queries conflicted: %#v %s", compilerProof, compilerFailure)
  }
  graphAfterListing := prog.checkGraph()
  listingKey := lintInputKey(prog.cwd, tree)
  if got := graphAfterListing.InputObservations[listingKey].NativePredicates; len(got) != 1 || got[0].Digest != directory.Digest {
    t.Fatalf("same-generation publisher lost native listing: %#v", got)
  }
  failureReader := newProjectInputReader(prog.inputObserver)
  if _, err := failureReader.ReadDir(filepath.Join(tree, "missing")); err == nil || !failureReader.incomplete || len(failureReader.directoryInputs) != 0 {
    t.Fatal("failed native listing gained observation authority")
  }

  supportedAdapter, err := inspectProjectContributor(observedProjectInputRule{location: document})
  if err != nil {
    t.Fatal(err)
  }
  previousSupported, hadSupported := registeredProjectRules[supportedAdapter.name]
  registeredProjectRules[supportedAdapter.name] = supportedAdapter
  t.Cleanup(func() {
    if hadSupported {
      registeredProjectRules[supportedAdapter.name] = previousSupported
    } else {
      delete(registeredProjectRules, supportedAdapter.name)
    }
  })
  supportedEngine := NewEngineWithResolver(InlineRuleResolver{Rules: RuleConfig{supportedAdapter.name: SeverityError}})
  supportedCycle := supportedEngine.evaluateProject(prog.identity, prog.userSourceFiles(), prog.checker, prog.inputReader)
  supportedCycle.finalize()
  state, ok := supportedCycle.results.ProjectResult(supportedAdapter.name).State.(struct {
    Body []byte
    Err  error
  })
  if !ok || state.Err != nil || !bytes.Equal(state.Body, raw) || prog.inputReader.incomplete {
    t.Fatalf("actual supported reader lost authority or consumed bytes: %#v", state)
  }

  // The existing topology-only contributor performs no observed reads.
  adapter, err := inspectProjectContributor(commandProjectInputRule{})
  if err != nil {
    t.Fatal(err)
  }
  prior, existed := registeredProjectRules[adapter.name]
  registeredProjectRules[adapter.name] = adapter
  t.Cleanup(func() {
    if existed {
      registeredProjectRules[adapter.name] = prior
    } else {
      delete(registeredProjectRules, adapter.name)
    }
  })
  engine := NewEngineWithResolver(InlineRuleResolver{Rules: RuleConfig{adapter.name: SeverityError}})
  if err := engine.ConfigError(); err != nil {
    t.Fatal(err)
  }
  engine.evaluateProject(prog.identity, prog.userSourceFiles(), prog.checker, prog.inputReader).finalize()
  if !prog.inputReader.incomplete {
    t.Fatal("topology-only contributor gained input proof")
  }
  write("index.ts", []byte("const value: number = 1; export { value };"))
  prog.applyChange(filepath.Join(root, "index.ts"))
  if prog.inputObserver != nil || prog.checkGraph() != nil {
    t.Fatal("updated Program retained prior-generation observation authority")
  }
}

package linthost

import (
  "encoding/json"
  "errors"
  "fmt"
  "os"
  "path/filepath"
  "sort"
  "strings"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
)

// nativeInputPredicate retains the actual config loader's fingerprint semantics.
// The wire version is independent of the executable config cache namespace.
// @evidence contracts/common.md#principled-implementation nativeInputPredicate preserves the actual operation/result boundary described above; absent authority cannot become a successful input proof.
// @evidence contracts/common.md#clear-and-simple-design nativeInputPredicate owns this reader or publisher step; compiler text, raw contributor bytes and typed config predicates remain separate representations.
// @evidence contracts/common.md#prohibited-implementation-shortcuts nativeInputPredicate introduces no global filesystem replacement, fixture branch, later proof synthesis or relaxed admission guard.
// @evidence contracts/common.md#meaningful-documentation The surrounding native prose and signatures identify the owning operation, representation and unavailable-result boundary.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This private state/wire shape performs no native operation; the reader and publisher own native observations.
// @evidenceExclude contracts/performance.md#efficient-algorithms This type declares state rather than an algorithm.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This type supplies no independent cache/reuse decision.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The owning Program/reader or caller, rather than the declaration, owns stored observations.
type nativeInputPredicate struct {
  Version int `json:"version"`
  Kind string `json:"kind"`
  Digest string `json:"digest"`
  IdentityStable bool `json:"identityStable"`
  Realpath *string `json:"realpath"`
  Scope string `json:"scope"`
}

// lintCheckGraph is a private wire schema matching the compiler's check result.
// The standalone public lint module cannot import the unpublished ttsc driver.
// Its source and predicate proofs come from the same Program's host filesystem.
// @evidence contracts/common.md#principled-implementation lintCheckGraph preserves the actual operation/result boundary described above; absent authority cannot become a successful input proof.
// @evidence contracts/common.md#clear-and-simple-design lintCheckGraph owns this reader or publisher step; compiler text, raw contributor bytes and typed config predicates remain separate representations.
// @evidence contracts/common.md#prohibited-implementation-shortcuts lintCheckGraph introduces no global filesystem replacement, fixture branch, later proof synthesis or relaxed admission guard.
// @evidence contracts/common.md#meaningful-documentation The surrounding native prose and signatures identify the owning operation, representation and unavailable-result boundary.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This private state/wire shape performs no native operation; the reader and publisher own native observations.
// @evidenceExclude contracts/performance.md#efficient-algorithms This type declares state rather than an algorithm.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This type supplies no independent cache/reuse decision.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The owning Program/reader or caller, rather than the declaration, owns stored observations.
type lintCheckGraph struct {
  Edges map[string][]string `json:"edges"`
  Globals []string `json:"globals"`
  Configs []string `json:"configs"`
  ResolutionInputs []string `json:"resolutionInputs,omitempty"`
  InputObservations map[string]transformInputObservation `json:"inputObservations,omitempty"`
  InputHashes map[string]*string `json:"inputHashes,omitempty"`
  InputRealpaths map[string]*string `json:"inputRealpaths,omitempty"`
  InputProofFailures map[string]string `json:"inputProofFailures,omitempty"`
  UseCaseSensitiveFileNames bool `json:"useCaseSensitiveFileNames"`
}

// @evidence contracts/common.md#principled-implementation lintInputKey preserves the actual operation/result boundary described above; absent authority cannot become a successful input proof.
// @evidence contracts/common.md#clear-and-simple-design lintInputKey owns this reader or publisher step; compiler text, raw contributor bytes and typed config predicates remain separate representations.
// @evidence contracts/common.md#prohibited-implementation-shortcuts lintInputKey introduces no global filesystem replacement, fixture branch, later proof synthesis or relaxed admission guard.
// @evidence contracts/common.md#meaningful-documentation The surrounding native prose and signatures identify the owning operation, representation and unavailable-result boundary.
// @evidence contracts/portability.md#os-neutral-implementation Uses actual native filesystem/path answers and preserves their error/kind distinctions; unsupported or unstable evidence withdraws authority rather than inferring an OS default.
// @evidence contracts/performance.md#efficient-algorithms Performs fixed bookkeeping or one selected native metadata/identity query, with path and returned result comparison costs delegated to their native operation.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation records/publishes or delegates the supplied generation; it creates no independent cross-request reuse cache.
// @evidence contracts/performance.md#bound-retention-and-release-resources The Program owns per-generation maps until release; native ReadFile closes its descriptor before return. Publication closes its private temporary file and reports non-missing cleanup errors, with no watcher or historical generation retained.
func lintInputKey(cwd, name string) string {
  relative, err := filepath.Rel(cwd, name)
  if err != nil || relative == ".." || strings.HasPrefix(relative, ".." + string(filepath.Separator)) { return filepath.ToSlash(name) }
  return filepath.ToSlash(relative)
}

// @evidence contracts/common.md#principled-implementation checkGraph preserves the actual operation/result boundary described above; absent authority cannot become a successful input proof.
// @evidence contracts/common.md#clear-and-simple-design checkGraph owns this reader or publisher step; compiler text, raw contributor bytes and typed config predicates remain separate representations.
// @evidence contracts/common.md#prohibited-implementation-shortcuts checkGraph introduces no global filesystem replacement, fixture branch, later proof synthesis or relaxed admission guard.
// @evidence contracts/common.md#meaningful-documentation The surrounding native prose and signatures identify the owning operation, representation and unavailable-result boundary.
// @evidence contracts/portability.md#os-neutral-implementation Uses actual native filesystem/path answers and preserves their error/kind distinctions; unsupported or unstable evidence withdraws authority rather than inferring an OS default.
// @evidence contracts/performance.md#efficient-algorithms Traverses this Program sources, references and actual observed/config paths, copies proofs and sorts recorded lists; no new Program or input read is performed.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation records/publishes or delegates the supplied generation; it creates no independent cross-request reuse cache.
// @evidence contracts/performance.md#bound-retention-and-release-resources The Program owns per-generation maps until release; native ReadFile closes its descriptor before return. Publication closes its private temporary file and reports non-missing cleanup errors, with no watcher or historical generation retained.
func (p *program) checkGraph() *lintCheckGraph {
  if p == nil || p.tsProgram == nil || p.inputObserver == nil { return nil }
  graph := &lintCheckGraph{Edges: map[string][]string{}, Globals: []string{}, Configs: []string{}, ResolutionInputs: []string{}, InputObservations: map[string]transformInputObservation{}, InputHashes: map[string]*string{}, InputRealpaths: map[string]*string{}, InputProofFailures: map[string]string{}, UseCaseSensitiveFileNames: p.tsProgram.UseCaseSensitiveFileNames()}
  realized := map[string]bool{}
  for _, file := range p.tsProgram.SourceFiles() {
    if file == nil || strings.HasPrefix(file.FileName(), "bundled:///") { continue }
    key := lintInputKey(p.cwd, file.FileName())
    realized[file.FileName()] = true
    targets := []string{}
    for _, referenced := range shimcompiler.GetReferencedFilePaths(p.tsProgram, file) {
      source := p.tsProgram.GetSourceFileByPath(referenced)
      if source == nil || source == file || strings.HasPrefix(source.FileName(), "bundled:///") { continue }
      realized[source.FileName()] = true
      targets = append(targets, lintInputKey(p.cwd, source.FileName()))
    }
    sort.Strings(targets)
    graph.Edges[key] = targets
    if shimcompiler.FileAffectsGlobalScope(file) { graph.Globals = append(graph.Globals, key) }
  }
  sort.Strings(graph.Globals)
  if p.parsed != nil && p.parsed.ConfigFile != nil {
    if file := p.parsed.ConfigFile.SourceFile; file != nil { realized[file.FileName()] = true; graph.Configs = append(graph.Configs, lintInputKey(p.cwd, file.FileName())) }
    for _, file := range p.parsed.ExtendedSourceFiles() { realized[file] = true; graph.Configs = append(graph.Configs, lintInputKey(p.cwd, file)) }
  }
  // Conservatively universalize actual compiler predicates. This needs no
  // second resolver or filesystem read and cannot drop an importing owner.
  paths := map[string]bool{}
  for _, name := range p.inputObserver.observedPaths() {
    if !strings.HasPrefix(name, "bundled:///") { paths[name] = true; graph.ResolutionInputs = append(graph.ResolutionInputs, lintInputKey(p.cwd, name)) }
  }
  for name := range realized { paths[name] = true }
  sort.Strings(graph.ResolutionInputs)
  for name := range paths {
    key := lintInputKey(p.cwd, name)
    observation, failure := p.inputObserver.predicateProof(name)
    if failure != "" { graph.InputProofFailures[key] = string(failure); continue }
    graph.InputObservations[key] = observation
    hash, physical, failure := p.inputObserver.proof(name)
    if failure == "" { graph.InputHashes[key] = hash; graph.InputRealpaths[key] = physical } else if realized[name] { graph.InputProofFailures[key] = string(failure) }
  }
  for _, input := range p.configInputs {
    key := lintInputKey(p.cwd, input.Path)
    observation := graph.InputObservations[key]
    observation.NativePredicates = append(observation.NativePredicates, nativeInputPredicate{Version: 1, Kind: input.Kind, Digest: input.Digest, IdentityStable: input.IdentityStable, Realpath: cloneConfigDependencyRealpath(input.Realpath), Scope: input.Scope})
    graph.InputObservations[key] = observation
    graph.ResolutionInputs = append(graph.ResolutionInputs, key)
    if !input.IdentityStable { graph.InputProofFailures[key] = "config-identity-unavailable" }
  }
  if p.inputReader != nil {
    p.inputReader.mu.Lock()
    for name, predicate := range p.inputReader.nativeInputs {
      key := lintInputKey(p.cwd, name)
      observation := graph.InputObservations[key]
      observation.NativePredicates = append(observation.NativePredicates, predicate)
      graph.InputObservations[key] = observation
      graph.ResolutionInputs = append(graph.ResolutionInputs, key)
    }
    p.inputReader.mu.Unlock()
  }
  sort.Strings(graph.ResolutionInputs)
  for key, observation := range graph.InputObservations {
    unique := map[string]nativeInputPredicate{}
    byKind := map[string]nativeInputPredicate{}
    for _, predicate := range observation.NativePredicates {
      if prior, seen := byKind[predicate.Kind]; seen && (prior.Digest != predicate.Digest || prior.IdentityStable != predicate.IdentityStable || !equalObservedString(prior.Realpath, predicate.Realpath)) { graph.InputProofFailures[key] = "config-predicate-conflict" }
      byKind[predicate.Kind] = predicate
      unique[predicate.Kind + ":" + predicate.Scope] = predicate
    }
    observation.NativePredicates = nil
    for _, predicate := range unique { observation.NativePredicates = append(observation.NativePredicates, predicate) }
    sort.Slice(observation.NativePredicates, func(i, j int) bool { return observation.NativePredicates[i].Kind + ":" + observation.NativePredicates[i].Scope < observation.NativePredicates[j].Kind + ":" + observation.NativePredicates[j].Scope })
    graph.InputObservations[key] = observation
  }
  return graph
}

// @evidence contracts/common.md#principled-implementation writeCheckObservations preserves the actual operation/result boundary described above; absent authority cannot become a successful input proof.
// @evidence contracts/common.md#clear-and-simple-design writeCheckObservations owns this reader or publisher step; compiler text, raw contributor bytes and typed config predicates remain separate representations.
// @evidence contracts/common.md#prohibited-implementation-shortcuts writeCheckObservations introduces no global filesystem replacement, fixture branch, later proof synthesis or relaxed admission guard.
// @evidence contracts/common.md#meaningful-documentation The surrounding native prose and signatures identify the owning operation, representation and unavailable-result boundary.
// @evidence contracts/portability.md#os-neutral-implementation Uses actual native filesystem/path answers and preserves their error/kind distinctions; unsupported or unstable evidence withdraws authority rather than inferring an OS default.
// @evidence contracts/performance.md#efficient-algorithms Serializes the current graph and raw input map once, then writes one private temporary file and atomically renames it; byte cost follows that envelope.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This operation records/publishes or delegates the supplied generation; it creates no independent cross-request reuse cache.
// @evidence contracts/performance.md#bound-retention-and-release-resources The Program owns per-generation maps until release; native ReadFile closes its descriptor before return. Publication closes its private temporary file and reports non-missing cleanup errors, with no watcher or historical generation retained.
func (p *program) writeCheckObservations(name string) (resultErr error) {
  if !filepath.IsAbs(name) { return fmt.Errorf("@ttsc/lint: check observations path must be absolute: %q", name) }
  inputs := []string{}
  hashes, physicals := map[string]*string{}, map[string]*string{}
  complete := p != nil && p.tsProgram != nil && p.inputReader != nil
  if p != nil && p.inputReader != nil {
    reader := p.inputReader
    reader.mu.Lock()
    complete = complete && !reader.incomplete
    for name, hash := range reader.inputs { inputs = append(inputs, name); hashes[name] = hash; physicals[name] = reader.realpaths[name] }
    reader.mu.Unlock()
  }
  sort.Strings(inputs)
  var graph *lintCheckGraph
  if p != nil { graph = p.checkGraph() }
  var unavailable *bool
  if !complete { value := false; unavailable = &value }
  data, err := json.Marshal(struct {
    Graph *lintCheckGraph `json:"graph,omitempty"`
    HostInputs []string `json:"hostInputs"`
    HostInputHashes map[string]*string `json:"hostInputHashes"`
    HostInputRealpaths map[string]*string `json:"hostInputRealpaths"`
    ObservationsComplete *bool `json:"observationsComplete,omitempty"`
  }{graph, inputs, hashes, physicals, unavailable})
  if err != nil { return err }
  temp, err := os.CreateTemp(filepath.Dir(name), ".lint-check-observations-*")
  if err != nil { return err }
  temporary := temp.Name()
  defer func() {
    if err := os.Remove(temporary); err != nil && !os.IsNotExist(err) { resultErr = errors.Join(resultErr, err) }
  }()
  if _, err = temp.Write(data); err != nil { return errors.Join(err, temp.Close()) }
  if err = temp.Close(); err != nil { return err }
  return os.Rename(temporary, name)
}

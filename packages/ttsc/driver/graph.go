package driver

import (
  "path/filepath"
  "sort"
  "strings"

  "github.com/microsoft/typescript-go/shim/ast"
  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimtspath "github.com/microsoft/typescript-go/shim/tspath"
)

// bundledScheme prefixes the virtual paths of the TypeScript-Go standard
// library files embedded in the binary. They are not filesystem inputs — they
// change only with the compiler itself — so the reference graph excludes them.
const bundledScheme = "bundled:///"

// TransformGraph is the host-owned reference-graph section of a transform
// envelope (`graph` in the stdout JSON). It reports the loaded compiler
// program's references, global contributors, configuration ancestry and
// resolver observations. Consumers choose graph inputs alongside independent
// plugin and host inputs; this graph alone does not certify every dependency
// of an arbitrary plugin's transformed output or continued filesystem freshness:
//
//   - Edges maps each file to its direct resolved references — imports,
//     re-exports, `/// <reference>` targets, type reference directives, and
//     ambient-module declaration files, type-only edges included. A leaf file
//     has an empty list so the node and its compiler-time input proof remain
//     explicit. Consumers that need a flat per-file graph list compute the
//     reachability closure themselves.
//   - Globals lists the files that contribute to the global scope (ambient
//     declaration files, script files, global augmentations, `typeRoots`
//     entries). A change to any of them can affect every file.
//   - Configs lists the project tsconfig followed by its `extends` ancestry.
//   - Candidates maps each importing file to the resolution probes that precede
//     or otherwise participate in its selected module and type-reference
//     results. They are a separate class from resolved edges: a predicate or
//     package manifest changing can change an unchanged reference's meaning.
//   - ResolutionInputs lists automatic type discovery and resolution inputs
//     whose state can affect every source file, including type-root directory
//     membership.
//   - InputObservations preserves the independent filesystem predicates the
//     compiler actually asked. InputHashes and InputRealpaths retain the legacy
//     collapsed content/identity projection for older consumers.
//   - InputProofFailures gives a stable reason when a realized member lacks
//     proof or a replayed resolver predicate changed.
//   - UseCaseSensitiveFileNames is the case policy the compiler matched the
//     project's root specs and compared paths with, so a host deciding the
//     same membership uses the compiler's policy rather than a guess from the
//     platform.
//
// Keys and values use the same convention as the envelope's `typescript`
// map: project-relative slash paths, falling back to slash-normalized
// absolute paths outside the project root (see TransformOutputKey).
//
// @evidence contracts/common.md#principled-implementation Resolved references, globals, resolver predicates, and proof failures retain distinct meanings in the envelope.
// @evidence contracts/common.md#clear-and-simple-design Each field carries one input class or observation projection under the shared key convention.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Compiler observations and explicit failures replace guessed dependencies or assumed validity.
// @evidence contracts/common.md#meaningful-documentation Native prose defines the input classes, leaf semantics, case policy, and key convention following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation The reported compiler case policy is distinct from slash-normalized protocol keys and native physical identities carried by observations/InputRealpaths. TransformOutputKey preserves cwd-relative or outside-root/cross-volume absolute coordinates; neither protocol spelling nor absent proof establishes physical identity or capabilities from an OS name.
// @evidenceExclude contracts/performance.md#efficient-algorithms Graph construction owns traversal; this type describes the result.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This schema carries proof without coordinating artifact reuse.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The caller-owned value owns no resident cache or resource.
type TransformGraph struct {
  Edges                     map[string][]string                  `json:"edges"`
  Globals                   []string                             `json:"globals"`
  Configs                   []string                             `json:"configs"`
  Candidates                map[string][]string                  `json:"candidates,omitempty"`
  ResolutionInputs          []string                             `json:"resolutionInputs,omitempty"`
  InputObservations         map[string]TransformInputObservation `json:"inputObservations,omitempty"`
  InputHashes               map[string]*string                   `json:"inputHashes,omitempty"`
  InputRealpaths            map[string]*string                   `json:"inputRealpaths,omitempty"`
  InputProofFailures        map[string]string                    `json:"inputProofFailures,omitempty"`
  UseCaseSensitiveFileNames bool                                 `json:"useCaseSensitiveFileNames"`
}

// NewTransformGraph computes the reference graph of a loaded program, keyed
// relative to cwd exactly like the transform envelope's `typescript` map.
// Hosts stamp the result into their stdout envelope's `graph` field;
// `cmd/ttsc api-transform` and the linked-plugin utility host both do.
// Returns nil only for a nil or unloaded program.
//
// @evidence contracts/common.md#principled-implementation Compiler references, global scope, config ancestry, and replayed predicates form one generation's dependency proof.
// @evidence contracts/common.md#clear-and-simple-design Reference collection, resolution replay, and proof attachment share one output-key owner.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Unobserved or contradictory inputs remain failures rather than later filesystem snapshots substituted for compiler reads.
// @evidence contracts/common.md#meaningful-documentation Native prose specifies envelope integration and unloaded-program behavior following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation Keys use native filepath conversion and compiler case policy; physical identity comes from observed realpaths.
// @evidence contracts/performance.md#efficient-algorithms Direct adjacency avoids computing every transitive closure. Construction scans resident sources/references, converts path text and sorts per-source targets, globals and resolver inputs; a distinct-input set selects proof attachment, whose rich and legacy projections can perform two observer lookups. Resolver task sorting, native replay reads/metadata/enumeration and observation merging remain part of this call's delegated cost; no work or byte ceiling is imposed here.
// @evidence contracts/performance.md#reuse-equivalent-work Final proof projection reuses the current Program observer, including its exact physical-target read for a lexical alias; it does not replace missing compiler evidence with a new read. Resolver replay separately performs native queries and merges contradictions into that generation. No prior graph or later filesystem generation is reused by this constructor.
// @evidence contracts/performance.md#bound-retention-and-release-resources Temporary adjacency/input/proof maps grow with resident references, distinct paths and reported predicate bytes. Graph arrays/maps transfer to the caller, while replay observations merge into the caller-owned current Program observer. This call owns no resident historical graph cache or native handle, and supplies no population/byte ceiling or caller-lifetime disposal policy.
func NewTransformGraph(prog *Program, cwd string) *TransformGraph {
  if prog == nil || prog.TSProgram == nil {
    return nil
  }
  resolution := ObserveProgramResolutions(prog, cwd)
  graph := &TransformGraph{
    Edges:                     map[string][]string{},
    Globals:                   []string{},
    Configs:                   []string{},
    Candidates:                resolution.Candidates,
    ResolutionInputs:          resolution.Universal,
    UseCaseSensitiveFileNames: prog.TSProgram.UseCaseSensitiveFileNames(),
  }
  for _, file := range prog.TSProgram.SourceFiles() {
    fileName := file.FileName()
    if strings.HasPrefix(fileName, bundledScheme) {
      continue
    }
    key := TransformOutputKey(cwd, fileName)
    if shimcompiler.FileAffectsGlobalScope(file) {
      graph.Globals = append(graph.Globals, key)
    }
    // Keep leaf modules as empty adjacency-list entries. Besides making the
    // graph's node universe explicit, this lets attachInputProof bind every
    // source file to the bytes TypeScript-Go actually read. Omitting a leaf
    // would let an A-B-A edit during compilation pair B's output with identical
    // pre/post project snapshots for A.
    graph.Edges[key] = referenceTargets(prog, cwd, file)
  }
  sort.Strings(graph.Globals)
  graph.Configs = configChain(prog, cwd)
  resolution.ApplyUniversalResolutionFailure(graph.Edges)
  if len(resolution.Failures) != 0 {
    graph.InputProofFailures = resolution.Failures
  }
  graph.attachInputProof(prog, cwd)
  return graph
}

// attachInputProof pairs every graph path with the state the compiler
// filesystem actually returned while constructing the resident Program. A
// missing entry means proof was incomplete or contradictory; persistent hosts
// then keep the fresh result but decline cross-build reuse.
func (graph *TransformGraph) attachInputProof(prog *Program, cwd string) {
  if prog == nil || prog.inputObserver == nil {
    return
  }
  inputs := map[string]struct{}{}
  realized := map[string]struct{}{}
  addRealized := func(input string) {
    inputs[input] = struct{}{}
    realized[input] = struct{}{}
  }
  for source, targets := range graph.Edges {
    addRealized(source)
    for _, target := range targets {
      addRealized(target)
    }
  }
  for _, input := range graph.Globals {
    addRealized(input)
  }
  for _, input := range graph.Configs {
    addRealized(input)
  }
  for source, candidates := range graph.Candidates {
    addRealized(source)
    for _, candidate := range candidates {
      inputs[candidate] = struct{}{}
    }
  }
  for _, input := range graph.ResolutionInputs {
    inputs[input] = struct{}{}
  }
  hashes := map[string]*string{}
  realpaths := map[string]*string{}
  observations := map[string]TransformInputObservation{}
  failures := graph.InputProofFailures
  if failures == nil {
    failures = map[string]string{}
  }
  for input := range inputs {
    file := filepath.FromSlash(input)
    if !filepath.IsAbs(file) {
      file = filepath.Join(cwd, file)
    }
    observation, predicateFailure := prog.inputObserver.predicateProof(file)
    if predicateFailure == "" {
      observations[input] = observation
    }
    var hash, realpath *string
    legacyFailure := predicateFailure
    if predicateFailure == "" {
      hash, realpath, legacyFailure = prog.inputObserver.proof(file)
    }
    if legacyFailure != "" {
      // A resolver input can have a complete predicate proof that the legacy
      // path-kind projection cannot represent, such as a successful file check
      // whose content was never requested. The rich proof remains sufficient
      // for that input; only a predicate failure, or any realized-input
      // failure, makes the generation inadmissible.
      _, isRealized := realized[input]
      if isRealized || (predicateFailure != "" && predicateFailure != inputProofUnobserved) {
        failures[input] = string(legacyFailure)
      }
      continue
    }
    hashes[input] = hash
    realpaths[input] = realpath
  }
  if len(hashes) != 0 {
    graph.InputHashes = hashes
    graph.InputRealpaths = realpaths
  }
  if len(observations) != 0 {
    graph.InputObservations = observations
  }
  if len(failures) != 0 {
    graph.InputProofFailures = failures
  }
}

// referenceTargets resolves one file's direct reference set to sorted envelope
// keys, dropping bundled library files and the file itself.
func referenceTargets(prog *Program, cwd string, file *ast.SourceFile) []string {
  paths := shimcompiler.GetReferencedFilePaths(prog.TSProgram, file)
  targets := make([]string, 0, len(paths))
  for _, referencedPath := range paths {
    // Referenced paths are case-canonicalized tspath.Path values; recover the
    // resident source and its real spelling from the Program. The incremental
    // helper can retain a raw extensionless project-reference directive even
    // when no corresponding source became resident. That spelling is a
    // resolver candidate, not a realized graph edge, and has no compiler-time
    // content proof.
    resolved := prog.TSProgram.GetSourceFileByPath(shimtspath.Path(referencedPath))
    if resolved == nil || resolved == file || strings.HasPrefix(resolved.FileName(), bundledScheme) {
      continue
    }
    targets = append(targets, TransformOutputKey(cwd, resolved.FileName()))
  }
  sort.Strings(targets)
  return targets
}

// configChain returns the project tsconfig followed by its `extends` ancestry
// as envelope keys. An inferred (config-less) program yields an empty list.
func configChain(prog *Program, cwd string) []string {
  configs := []string{}
  parsed := prog.ParsedConfig
  if parsed == nil || parsed.ConfigFile == nil {
    return configs
  }
  if source := parsed.ConfigFile.SourceFile; source != nil {
    configs = append(configs, TransformOutputKey(cwd, source.FileName()))
  }
  for _, extended := range parsed.ExtendedSourceFiles() {
    configs = append(configs, TransformOutputKey(cwd, extended))
  }
  return configs
}

// TransformOutputKey converts an absolute fileName to the key used by the
// transform and compile envelopes: a slash-separated path relative to cwd,
// falling back to the slash-normalized absolute path when the file lives
// outside the project root. Every envelope section (`typescript`, `graph`,
// `dependencies` producers) must share this one implementation so a consumer
// can join sections by key.
//
// @evidence contracts/common.md#principled-implementation One key convention keeps source, dependency, and graph sections joinable across project boundaries.
// @evidence contracts/common.md#clear-and-simple-design Native relative-path calculation and one escape predicate choose serialization.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Structural traversal and cross-volume checks replace guessed string-prefix roots.
// @evidence contracts/common.md#meaningful-documentation Native prose states absolute input and outside-root behavior following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation filepath.Rel handles volumes and separators; ToSlash supplies envelope spelling.
// @evidence contracts/performance.md#efficient-algorithms Native filepath.Rel normalization, volume/segment comparisons, escape-prefix checks and ToSlash output copying scale with cwd/fileName/relative path text. Delegation does not make this conversion constant work; the relative result is preferred when structurally within cwd, with no filesystem traversal or repeated collection scan.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This conversion owns no repeated-work coordinator.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Only the caller-owned result is retained.
func TransformOutputKey(cwd, fileName string) string {
  rel, err := filepath.Rel(cwd, fileName)
  if err != nil || isOutsideRelativePath(rel) {
    return filepath.ToSlash(fileName)
  }
  return filepath.ToSlash(rel)
}

// isOutsideRelativePath reports whether rel escapes the project root (starts
// with ".." or is exactly "..").
func isOutsideRelativePath(rel string) bool {
  return rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator))
}

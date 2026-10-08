package evidence

import (
  "io/fs"
  "sort"
  "strconv"
  "strings"
)

// markdownCapture owns the first Markdown observations of one Check. Its
// inventories retain the first consumed bytes' interpretation and address;
// walking another population never rereads an already captured address.
// Different file selections may require another walk, while equal selections
// replay the original walk, including failed observations and pruning.
//
// The host keeps the witness of each actual operation. This capture neither
// certifies freshness nor restores withdrawn authority. An edit after an
// observation belongs to a later Check; downstream reusable delivery still
// validates the original witnesses. Hints projects the same captured snapshot.
//
// @evidence contracts/common.md#principled-implementation Check-local maps preserve first observations, with base and artifact-address keys keeping declared citation spaces separate. Walk keys describe ordered file-glob semantics rather than symbol or severity policy.
// @evidence contracts/common.md#clear-and-simple-design One owner shares base resolution, traversal and parsed inventories; existing loaders still own selection, diagnostics and health.
// @evidence contracts/common.md#prohibited-implementation-shortcuts All initial operations use the existing reader. Replays retain actual failed observations and do not replace consumed witnesses with later metadata or hashes.
// @evidence contracts/common.md#meaningful-documentation The comment states ownership, failure retention, the timing limit and the independent downstream proof obligation.
// @evidence contracts/portability.md#os-neutral-implementation Native paths and fs.DirEntry values come from the reader. Artifact-address identity remains distinct from physical file identity; no case policy or symlink capability is inferred from an OS name.
// @evidence contracts/performance.md#efficient-algorithms Capturing visits the selected traversal and parses each addressed file once. Replay visits the recorded entries and projects diagnostics without raw file reads or parsing; additional glob selections may require another traversal. Key construction and sorting depend on population and glob text sizes.
// @evidence contracts/performance.md#reuse-equivalent-work Activation and evaluation share the first captured inventory only within one Check and reader. Equal file selections share their recorded traversal; symbols and severity are applied anew by the loader. The next Check constructs a new owner.
// @evidence contracts/performance.md#bound-retention-and-release-resources Check owns the maps, parsed inventories and traversal records until evaluation ends; a clean Corpus retains only inventories needed for Hints. Storage grows with addressed files, parsed bytes, selected traversal entries and distinct file-selection sets; no descriptor or task is retained.
type markdownCapture struct {
  bases map[string]markdownCapturedBase
  walks map[string]markdownCapturedWalk
  inventories map[string]map[string]markdownCapturedInventory
  walkFailures map[string]error
  walkErrors map[string]map[string]error
}

type markdownCapturedBase struct {
  from string
  problem string
}

type markdownCapturedWalk struct {
  entries []markdownWalkObservation
  err error
}

type markdownWalkObservation struct {
  path string
  entry fs.DirEntry
  err error
}

type markdownCapturedInventory struct {
  inventory *artifactInventory
  err error
}

// resolve retains the first base resolution, including an unusable root.
// Base.Absolute is the existing declared address-space identity, so physical
// aliases are not collapsed by this capture.
func (capture *markdownCapture) resolve(base populationBase) (string, string) {
  if prior, ok := capture.bases[base.Absolute]; ok {
    return prior.from, prior.problem
  }
  observation := markdownCapturedBase{problem: baseDirectoryProblem(base, artifactMarkdown)}
  if observation.problem == "" {
    var resolved bool
    observation.from, resolved = resolvedBaseDirectory(base)
    if !resolved {
      observation.problem = unresolvedBaseProblem(base, artifactMarkdown)
    }
  }
  if capture.bases == nil { capture.bases = map[string]markdownCapturedBase{} }
  capture.bases[base.Absolute] = observation
  return observation.from, observation.problem
}

// walk replays only a traversal with the same file-selection semantics. The
// loader's traversal decisions depend on those globs, not its symbol/severity
// projection. A new selection delegates discovery to the ordinary reader.
func (capture *markdownCapture) walk(base populationBase, from string, config graphConfig, visit fs.WalkDirFunc) error {
  key := markdownWalkKey(base, config)
  if prior, ok := capture.walks[key]; ok {
    for _, observation := range prior.entries {
      if err := visit(observation.path, observation.entry, observation.err); err != nil && err != fs.SkipDir {
        return err
      }
    }
    return prior.err
  }
  if err := capture.walkFailures[base.Absolute]; err != nil { return err }
  observation := markdownCapturedWalk{}
  observedErrors := map[string]bool{}
  observation.err = base.inputs.WalkDir(from, func(path string, entry fs.DirEntry, err error) error {
    if prior := capture.walkErrors[base.Absolute][path]; prior != nil {
      err = prior
    } else if err != nil {
      if capture.walkErrors == nil { capture.walkErrors = map[string]map[string]error{} }
      if capture.walkErrors[base.Absolute] == nil { capture.walkErrors[base.Absolute] = map[string]error{} }
      capture.walkErrors[base.Absolute][path] = err
    }
    if err != nil { observedErrors[path] = true }
    observation.entries = append(observation.entries, markdownWalkObservation{path: path, entry: entry, err: err})
    return visit(path, entry, err)
  })
  // Broader discovery can omit an earlier failed entry after a deletion or
  // pruning change. Its first failure still belongs to this snapshot; replay
  // it through the new phase's relevance, severity and population-health gate.
  if observation.err == nil {
    for path, err := range capture.walkErrors[base.Absolute] {
      if observedErrors[path] { continue }
      observation.entries = append(observation.entries, markdownWalkObservation{path: path, err: err})
      if result := visit(path, nil, err); result != nil && result != fs.SkipDir {
        observation.err = result
        break
      }
    }
  }
  if observation.err != nil {
    if capture.walkFailures == nil { capture.walkFailures = map[string]error{} }
    capture.walkFailures[base.Absolute] = observation.err
  }
  if capture.walks == nil { capture.walks = map[string]markdownCapturedWalk{} }
  capture.walks[key] = observation
  return observation.err
}

// read retains successful parses and failed reads alike. The first actual
// reader invocation supplies the only consumed-byte witness for this address;
// the capture never retries a failure in another phase of the same Check.
func (capture *markdownCapture) read(address artifactAddress, current string) (*artifactInventory, error) {
  if prior, ok := capture.inventories[address.Base.Absolute][address.Relative]; ok {
    return prior.inventory, prior.err
  }
  content, err := address.Base.inputs.ReadFile(current)
  var inventory *artifactInventory
  if err == nil {
    inventory, _ = scanMarkdownInventory(address, string(content))
  } else {
    inventory = &artifactInventory{Path: address.Display, Type: artifactMarkdown, LoadFailed: true}
  }
  if capture.inventories == nil { capture.inventories = map[string]map[string]markdownCapturedInventory{} }
  if capture.inventories[address.Base.Absolute] == nil { capture.inventories[address.Base.Absolute] = map[string]markdownCapturedInventory{} }
  capture.inventories[address.Base.Absolute][address.Relative] = markdownCapturedInventory{inventory: inventory, err: err}
  return inventory, err
}

// markdownWalkKey canonicalizes the union of ordered glob sets for one base.
// Each set keeps include/exclude order; sorting and deduplicating whole sets
// reflects that different populations are combined by union during traversal.
func markdownWalkKey(base populationBase, config graphConfig) string {
  sets := map[string]bool{}
  add := func(candidate populationBase, files globSet) {
    if candidate.Absolute != base.Absolute { return }
    patterns := make([]string, 0, len(files.Patterns))
    for _, pattern := range files.Patterns {
      value := strings.Join(pattern.Segments, "/")
      if pattern.Exclude { value = "1:" + value } else { value = "0:" + value }
      patterns = append(patterns, value)
    }
    var key strings.Builder
    for _, pattern := range patterns {
      key.WriteString(strconv.Itoa(len(pattern)))
      key.WriteByte(':')
      key.WriteString(pattern)
    }
    sets[key.String()] = true
  }
  for _, claim := range config.Claims {
    if claim.Type == artifactMarkdown { add(claim.Base, claim.Files) }
    for _, reference := range claim.References {
      if reference.Type == artifactMarkdown { add(reference.Base, reference.Files) }
    }
  }
  keys := make([]string, 0, len(sets))
  for key := range sets { keys = append(keys, key) }
  sort.Strings(keys)
  var key strings.Builder
  for _, part := range append([]string{base.Absolute}, keys...) {
    key.WriteString(strconv.Itoa(len(part)))
    key.WriteByte(':')
    key.WriteString(part)
  }
  return key.String()
}

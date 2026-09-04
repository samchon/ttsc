package driver

import (
  "sort"
  "strings"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimtsoptions "github.com/microsoft/typescript-go/shim/tsoptions"
  shimtspath "github.com/microsoft/typescript-go/shim/tspath"
)

// ProgramResolutionInput is one exact lexical filesystem input consulted by
// TypeScript-Go while resolving a resident Program.
type ProgramResolutionInput struct {
  // DirectoryEntries is true when the compiler enumerated this directory, so
  // membership changes as well as kind and identity must invalidate it.
  DirectoryEntries bool
  // IdentityOnly is true only for a selected lexical alias whose contents are
  // already owned by the resolved graph target. A link retarget must still
  // invalidate it, while an edit to the selected bytes is not counted twice.
  IdentityOnly bool
  Path         string
}

// ProgramResolutionObservation is the deterministic result of replaying every
// resident module and type-reference resolution through TypeScript-Go itself.
type ProgramResolutionObservation struct {
  // Candidates maps each source to every exact resolver input other than its
  // identically spelled selected graph target.
  Candidates map[string][]string
  // Failures marks source files whose replay no longer matched the resident
  // resolution. A universal failure is expanded to every graph source later.
  Failures map[string]string
  // Inputs is the flat form used by resident non-envelope hosts.
  Inputs []ProgramResolutionInput
  // Universal contains automatic type discovery and resolution inputs whose
  // state can affect every source file.
  Universal        []string
  universalFailure bool
}

// ObserveProgramResolutions replays the pinned TypeScript-Go resolver over a
// fresh observation transaction per source resolution set. This preserves the
// compiler's exact ordering and complete semantics without maintaining a
// second resolver in ttsc. Replay observations are merged into the original
// compiler transaction, so a state change between construction and replay
// becomes a proof failure.
func ObserveProgramResolutions(prog *Program, cwd string) ProgramResolutionObservation {
  output := ProgramResolutionObservation{
    Candidates: map[string][]string{},
    Failures:   map[string]string{},
  }
  if prog == nil || prog.TSProgram == nil || prog.FS == nil || prog.inputObserver == nil {
    return output
  }
  caseSensitive := prog.FS.UseCaseSensitiveFileNames()
  tasks := shimcompiler.ProgramResolutionTasks(prog.TSProgram)
  sort.Slice(tasks, func(left, right int) bool {
    a, b := tasks[left], tasks[right]
    if a.Universal != b.Universal {
      return !a.Universal
    }
    if a.SourceFile != b.SourceFile {
      return a.SourceFile < b.SourceFile
    }
    if a.ContainingFile != b.ContainingFile {
      return a.ContainingFile < b.ContainingFile
    }
    if a.Kind != b.Kind {
      return a.Kind < b.Kind
    }
    if a.Name != b.Name {
      return a.Name < b.Name
    }
    return a.Mode < b.Mode
  })

  if !prog.TSProgram.Options().NoResolve.IsTrue() {
    observeProgramPathReferences(prog, cwd, caseSensitive, &output)
  }

  // Automatic type discovery is a separate compiler operation that enumerates
  // each effective type root before the individual directive resolutions.
  // Replaying it records directory membership itself, so adding a new @types
  // package invalidates a resident program without an importer edit.
  automatic := newInputObservationFS(prog.FS)
  shimcompiler.ReplayAutomaticTypeDirectiveDiscovery(prog.TSProgram, automatic)
  output.Universal = appendResolutionPaths(output.Universal, cwd, automatic, nil, caseSensitive, &output.Inputs)
  prog.inputObserver.mergeFrom(automatic)

  for first := 0; first < len(tasks); {
    last := first + 1
    for last < len(tasks) && sameResolutionTaskOwner(tasks[first], tasks[last]) {
      last++
    }
    group := tasks[first:last]
    replay := newInputObservationFS(prog.FS)
    matches := shimcompiler.ReplayProgramResolutions(group, replay)
    selected := make([]string, 0, len(group))
    for _, task := range group {
      // A resolved target is already content-owned only when it became a
      // Program source. noResolve, allowJs, depth, and diagnostic gates can
      // leave a successful resolution outside the graph; retain those targets
      // as resolver inputs instead of silently dropping them.
      if task.TargetFile != "" {
        selected = append(selected, task.TargetFile)
      }
    }
    owner := group[0]
    if owner.Universal {
      output.Universal = appendResolutionPaths(output.Universal, cwd, replay, selected, caseSensitive, &output.Inputs)
      if !matches {
        output.universalFailure = true
      }
    } else if owner.SourceFile != "" {
      source := TransformOutputKey(cwd, owner.SourceFile)
      output.Candidates[source] = appendResolutionPaths(output.Candidates[source], cwd, replay, selected, caseSensitive, &output.Inputs)
      if !matches {
        output.Failures[source] = string(inputProofResolutionChanged)
      }
    }
    prog.inputObserver.mergeFrom(replay)
    first = last
  }
  for source, candidates := range output.Candidates {
    compacted := compactStringsInOrder(candidates)
    if len(compacted) == 0 {
      delete(output.Candidates, source)
    } else {
      sort.Strings(compacted)
      output.Candidates[source] = compacted
    }
  }
  output.Universal = compactStringsInOrder(output.Universal)
  sort.Strings(output.Universal)
  output.Inputs = compactResolutionInputs(output.Inputs)
  return output
}

func sameResolutionTaskOwner(left, right shimcompiler.ProgramResolutionTask) bool {
  return left.Universal == right.Universal && left.SourceFile == right.SourceFile && (left.Universal || left.ContainingFile == right.ContainingFile)
}

// observeProgramPathReferences replays the file predicates for triple-slash
// path references. These use the compiler's supported-extension list directly
// rather than the module resolver cache covered by ProgramResolutionTasks.
func observeProgramPathReferences(prog *Program, cwd string, caseSensitive bool, output *ProgramResolutionObservation) {
  supported := shimtsoptions.GetSupportedExtensions(prog.TSProgram.Options(), nil)
  supported = shimtsoptions.GetSupportedExtensionsWithJsonIfResolveJsonModule(prog.TSProgram.Options(), supported)
  for _, source := range prog.TSProgram.SourceFiles() {
    if source == nil || source.FileName() == "" || strings.HasPrefix(source.FileName(), bundledScheme) {
      continue
    }
    sourceKey := TransformOutputKey(cwd, source.FileName())
    for _, reference := range source.ReferencedFiles {
      replay := newInputObservationFS(prog.FS)
      selected := []string(nil)
      for _, candidate := range pathReferenceCandidates(source.FileName(), reference.FileName, prog.TSProgram.Options().AllowNonTsExtensions.IsTrue(), supported, caseSensitive) {
        if replay.FileExists(candidate) {
          if resident := prog.TSProgram.GetSourceFileForResolvedModule(candidate); resident != nil {
            selected = []string{resident.FileName()}
          }
          break
        }
        // TypeScript-Go's project-reference host can make an unbuilt output
        // declaration exist by checking its mapped source. Replay both
        // predicates so a later output appearance or source disappearance
        // invalidates the same resolution without turning either spelling into
        // a realized graph edge.
        outputPath := shimtspath.ToPath(candidate, prog.TSProgram.GetCurrentDirectory(), caseSensitive)
        redirect := prog.TSProgram.GetProjectReferenceFromOutputDts(outputPath)
        if redirect == nil || !replay.FileExists(redirect.Source) {
          continue
        }
        if resident := prog.TSProgram.GetSourceFile(redirect.Source); resident != nil {
          selected = []string{resident.FileName()}
        }
        break
      }
      output.Candidates[sourceKey] = appendResolutionPaths(output.Candidates[sourceKey], cwd, replay, selected, caseSensitive, &output.Inputs)
      prog.inputObserver.mergeFrom(replay)
    }
  }
}

func pathReferenceCandidates(containingFile, reference string, allowNonTsExtensions bool, supported [][]string, caseSensitive bool) []string {
  base := reference
  if !shimtspath.IsRootedDiskPath(base) {
    base = shimtspath.CombinePaths(shimtspath.GetDirectoryPath(containingFile), base)
  }
  base = shimtspath.NormalizePath(base)
  if shimtspath.HasExtension(base) {
    canonicalBase := shimtspath.GetCanonicalFileName(base, caseSensitive)
    if allowNonTsExtensions || supportedFileExtension(canonicalBase, supported) {
      return []string{base}
    }
    return nil
  }
  if allowNonTsExtensions {
    return []string{base}
  }
  candidates := []string{}
  if len(supported) != 0 {
    for _, extension := range supported[0] {
      candidates = append(candidates, base+extension)
    }
  }
  return candidates
}

func supportedFileExtension(file string, supported [][]string) bool {
  for _, extensions := range supported {
    if shimtspath.FileExtensionIsOneOf(file, extensions) {
      return true
    }
  }
  return false
}

// ApplyUniversalResolutionFailure marks every source because automatic type
// discovery contributes to one global Program rather than to one importer.
func (observation ProgramResolutionObservation) ApplyUniversalResolutionFailure(sources map[string][]string) {
  if !observation.universalFailure {
    return
  }
  for source := range sources {
    observation.Failures[source] = string(inputProofResolutionChanged)
  }
}

func appendResolutionPaths(
  target []string,
  cwd string,
  observer *inputObservationFS,
  selected []string,
  caseSensitive bool,
  flat *[]ProgramResolutionInput,
) []string {
  for _, candidate := range observer.observedPaths() {
    selectedPath := slicesContainResolutionPath(selected, candidate, caseSensitive)
    identityOnly := selectedPath && observedResolutionPathHasDistinctIdentity(observer, candidate, caseSensitive)
    if selectedPath && !identityOnly {
      continue
    }
    if !identityOnly {
      for _, target := range selected {
        if observedResolutionAlias(observer, candidate, target, caseSensitive) {
          identityOnly = true
          break
        }
      }
    }
    *flat = append(*flat, ProgramResolutionInput{
      DirectoryEntries: observer.observedAccessibleEntries(candidate),
      IdentityOnly:     identityOnly,
      Path:             candidate,
    })
    target = append(target, TransformOutputKey(cwd, candidate))
  }
  return target
}

func observedResolutionPathHasDistinctIdentity(observer *inputObservationFS, candidate string, caseSensitive bool) bool {
  if observer == nil || candidate == "" {
    return false
  }
  observation, failure := observer.predicateProof(candidate)
  return failure == "" && observation.Realpath != nil && observation.Realpath.OK && !sameResolutionPath(observation.Realpath.Path, candidate, caseSensitive)
}

func slicesContainResolutionPath(paths []string, candidate string, caseSensitive bool) bool {
  for _, path := range paths {
    if sameResolutionPath(candidate, path, caseSensitive) {
      return true
    }
  }
  return false
}

func sameResolutionPath(left, right string, caseSensitive bool) bool {
  if left == "" || right == "" {
    return false
  }
  return shimtspath.GetCanonicalFileName(shimtspath.NormalizePath(left), caseSensitive) == shimtspath.GetCanonicalFileName(shimtspath.NormalizePath(right), caseSensitive)
}

func observedResolutionAlias(observer *inputObservationFS, candidate, target string, caseSensitive bool) bool {
  if observer == nil || candidate == "" || target == "" {
    return false
  }
  observation, failure := observer.predicateProof(candidate)
  return failure == "" && observation.Realpath != nil && observation.Realpath.OK && sameResolutionPath(observation.Realpath.Path, target, caseSensitive)
}

func compactResolutionInputs(inputs []ProgramResolutionInput) []ProgramResolutionInput {
  byPath := make(map[string]ProgramResolutionInput, len(inputs))
  for _, input := range inputs {
    if strings.TrimSpace(input.Path) == "" {
      continue
    }
    if previous, found := byPath[input.Path]; found {
      input.DirectoryEntries = previous.DirectoryEntries || input.DirectoryEntries
      input.IdentityOnly = previous.IdentityOnly && input.IdentityOnly
    }
    byPath[input.Path] = input
  }
  paths := make([]string, 0, len(byPath))
  for path := range byPath {
    paths = append(paths, path)
  }
  sort.Strings(paths)
  output := make([]ProgramResolutionInput, 0, len(paths))
  for _, path := range paths {
    output = append(output, byPath[path])
  }
  return output
}

func compactStringsInOrder(input []string) []string {
  output := make([]string, 0, len(input))
  seen := map[string]struct{}{}
  for _, value := range input {
    if strings.TrimSpace(value) == "" {
      continue
    }
    if _, exists := seen[value]; exists {
      continue
    }
    seen[value] = struct{}{}
    output = append(output, value)
  }
  return output
}

package driver

import (
  "sort"
  "strings"

  "github.com/microsoft/typescript-go/shim/ast"
  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimtsoptions "github.com/microsoft/typescript-go/shim/tsoptions"
  shimtspath "github.com/microsoft/typescript-go/shim/tspath"
)

// ProgramResolutionInput is one reported lexical filesystem input from
// TypeScript-Go resolution replay for a resident Program. The observer retains
// the first cleaned spelling per compiler-normalized case key, not every raw
// spelling passed to filesystem methods.
//
// @evidence contracts/common.md#principled-implementation Enumeration and identity-only flags distinguish directory membership from alias identity whose bytes are already owned by a graph target.
// @evidence contracts/common.md#clear-and-simple-design One lexical path carries the two independent invalidation qualifications.
// @evidence contracts/common.md#prohibited-implementation-shortcuts A selected alias is not dropped merely because another spelling owns its content.
// @evidence contracts/common.md#meaningful-documentation Native member prose explains membership and identity-only invalidation following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation Path carries the observer's first native cleaned spelling per compiler-normalized case key, distinct from successful realpath identity. Flags qualify directory enumeration and selected-target alias responsibility; they do not establish OS-default case policy or preserve every raw alias spelling.
// @evidenceExclude contracts/performance.md#efficient-algorithms Resolution replay owns observation collection; this type describes one input.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This data value coordinates no shared work.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The input value owns no resource or resident cache.
type ProgramResolutionInput struct {
  // DirectoryEntries is true when the compiler enumerated this directory, so
  // membership changes as well as kind and identity must invalidate it.
  DirectoryEntries bool

  // IdentityOnly is true only for a selected lexical alias whose contents are
  // already owned by the resolved graph target. A link retarget must still
  // invalidate it, while an edit to the selected bytes is not counted twice.
  IdentityOnly bool

  // Path is the first cleaned spelling retained for its compiler observation key.
  Path string
}

// ProgramResolutionObservation reports resident module/type-reference replay
// and automatic type discovery through TypeScript-Go. Ordering/compaction are
// deterministic for the supplied tasks and observed inputs, not a promise that
// concurrent filesystem changes produce the same observations.
//
// @evidence contracts/common.md#principled-implementation Source candidates, universal inputs, and replay mismatches remain distinct so automatic type discovery can invalidate every source correctly.
// @evidence contracts/common.md#clear-and-simple-design One result exposes envelope and flat-host views of the same replay transaction.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Replay mismatches remain proof failures rather than a presumed matching resolver result.
// @evidence contracts/common.md#meaningful-documentation Native field prose explains candidate, universal, flat, and failure scopes following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation The observation retains exact native resolver inputs, with envelope serialization performed by the shared output-key owner.
// @evidenceExclude contracts/performance.md#efficient-algorithms ObserveProgramResolutions owns replay and sorting; the type is its result.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This result supplies proof to consumers without coordinating artifact reuse.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The result is caller-owned and acquires no resource or resident cache.
type ProgramResolutionObservation struct {
  // Candidates maps each source to reported resolver spellings. A selected
  // resident target is omitted when compiler-normalized equality already owns
  // it; a separately observed physical alias remains an identity input.
  Candidates map[string][]string

  // Failures marks source files whose replay no longer matched the resident
  // resolution. A universal failure is expanded to every graph source later.
  Failures map[string]string

  // Inputs is the flat form used by resident non-envelope hosts.
  Inputs []ProgramResolutionInput

  // Universal contains automatic type discovery and resolution inputs whose
  // state can affect every source file.
  Universal []string

  universalFailure bool
}

// ObserveProgramResolutions replays cached module/type-reference tasks and
// automatic type discovery through the pinned TypeScript-Go compiler, with a
// fresh observation transaction per resolution-owner group. Triple-slash path
// references separately use ttsc's candidate procedure with compiler-supported
// extensions and project-reference redirects. Replay observations merge into
// the original compiler transaction; observed contradictions or mismatched
// cached resolutions become proof failures, not an atomic filesystem snapshot.
//
// @evidence contracts/common.md#principled-implementation The pinned compiler replays module/type discovery semantics, and merged observations make intervening filesystem changes explicit proof failures.
// @evidence contracts/common.md#clear-and-simple-design Deterministic task grouping separates source-owned and universal observations; shared helpers normalize and compact output.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Cached module/type-reference results are compared by native compiler replay; path references use explicit supported-extension/redirect predicates rather than claiming to be that same module resolver. Successful targets outside the resident graph remain inputs because only loaded source targets qualify for graph-content ownership.
// @evidence contracts/common.md#meaningful-documentation Native prose explains transaction scope, compiler ownership, and change detection following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation Compiler path/case operations and the actual FS case capability govern alias equality, supported extensions, and envelope keys.
// @evidence contracts/performance.md#efficient-algorithms Task extraction/sorting and adjacent-owner grouping avoid one replay per individual task. Native module/type discovery, path-reference candidate probes and predicate bytes remain delegated costs; each observed path scans its group's selected targets for canonical/physical alias comparison before final map/set compaction and path sorting. Costs include task/reference/candidate/selected-target populations, path comparisons and filesystem reads/enumeration; no work or byte ceiling is supplied.
// @evidence contracts/performance.md#reuse-equivalent-work One observation transaction serves each resolution-owner group; selected graph targets retain content ownership while alias identity is kept without duplicating content responsibility.
// @evidence contracts/performance.md#bound-retention-and-release-resources Temporary tasks, per-group observers and final input maps/slices grow with resolutions, native predicates, names and path bytes. Replay observations merge into the caller-owned current Program observer and the output transfers to its caller. No previous-generation observation cache is owned here, but neither merged/current data nor returned bytes have a population cap or disposal policy imposed by this function.
func ObserveProgramResolutions(prog *Program, cwd string) ProgramResolutionObservation {
  output := ProgramResolutionObservation{
    Candidates: map[string][]string{},
    Failures:   map[string]string{},
  }
  if prog == nil || prog.TSProgram == nil || prog.FS == nil || prog.inputObserver == nil {
    return output
  }
  caseSensitivity := prog.FS.CaseSensitivity()
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
    observeProgramPathReferences(prog, cwd, caseSensitivity, &output)
  }

  // Automatic type discovery is a separate compiler operation that enumerates
  // each effective type root before the individual directive resolutions.
  // Replaying it records directory membership itself, so adding a new @types
  // package invalidates a resident program without an importer edit.
  automatic := newInputObservationFS(prog.FS)
  shimcompiler.ReplayAutomaticTypeDirectiveDiscovery(prog.TSProgram, automatic)
  output.Universal = appendResolutionPaths(output.Universal, cwd, automatic, nil, caseSensitivity, &output.Inputs)
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
        selected = append(selected, task.TargetFile.AsString())
      }
    }
    owner := group[0]
    if owner.Universal {
      output.Universal = appendResolutionPaths(output.Universal, cwd, replay, selected, caseSensitivity, &output.Inputs)
      if !matches {
        output.universalFailure = true
      }
    } else if owner.SourceFile != "" {
      source := TransformOutputKey(cwd, owner.SourceFile.AsString())
      output.Candidates[source] = appendResolutionPaths(output.Candidates[source], cwd, replay, selected, caseSensitivity, &output.Inputs)
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
func observeProgramPathReferences(prog *Program, cwd string, caseSensitivity shimtspath.CaseSensitivity, output *ProgramResolutionObservation) {
  supported := shimtsoptions.GetSupportedExtensions(prog.TSProgram.Options(), nil)
  supported = shimtsoptions.GetSupportedExtensionsWithJsonIfResolveJsonModule(prog.TSProgram.Options(), supported)
  for _, source := range prog.TSProgram.SourceFiles() {
    if source == nil || source.FileName() == "" || strings.HasPrefix(source.FileName().AsString(), bundledScheme) {
      continue
    }
    sourceKey := TransformOutputKey(cwd, source.FileName().AsString())
    for _, reference := range source.ReferencedFiles {
      replay := newInputObservationFS(prog.FS)
      selected := []string(nil)
      for _, candidate := range pathReferenceCandidates(source.FileName().AsString(), reference.FileName, prog.TSProgram.Options().AllowNonTsExtensions.IsTrue(), supported, caseSensitivity) {
        candidateFile, rooted := shimtspath.TryRootedFilePathFromAbsolute(candidate)
        if !rooted {
          continue
        }
        if replay.FileExists(candidateFile) {
          if resident := residentSourceWithRedirect(prog.TSProgram, candidateFile); resident != nil {
            selected = []string{resident.FileName().AsString()}
          }
          break
        }
        // TypeScript-Go's project-reference host can make an unbuilt output
        // declaration exist by checking its mapped source. Replay both
        // predicates so a later output appearance or source disappearance
        // invalidates the same resolution without turning either spelling into
        // a realized graph edge.
        redirect := prog.TSProgram.GetProjectReferenceFromOutputDts(prog.TSProgram.PathKeyForFileName(candidateFile))
        if redirect == nil || !replay.FileExists(redirect.Source) {
          continue
        }
        if resident := prog.TSProgram.GetSourceFile(redirect.Source); resident != nil {
          selected = []string{resident.FileName().AsString()}
        }
        break
      }
      output.Candidates[sourceKey] = appendResolutionPaths(output.Candidates[sourceKey], cwd, replay, selected, caseSensitivity, &output.Inputs)
      prog.inputObserver.mergeFrom(replay)
    }
  }
}

// residentSourceWithRedirect is the Program's lookup of a resolved file: the
// resident source at that name, else the source its project-reference
// redirect loaded in its place.
func residentSourceWithRedirect(program *shimcompiler.Program, file shimtspath.RootedFilePath) *ast.SourceFile {
  if resident := program.GetSourceFile(file); resident != nil {
    return resident
  }
  if redirect := program.GetParseFileRedirect(file); redirect != "" {
    return program.GetSourceFile(redirect)
  }
  return nil
}

func pathReferenceCandidates(containingFile, reference string, allowNonTsExtensions bool, supported [][]string, caseSensitivity shimtspath.CaseSensitivity) []string {
  base := reference
  if !shimtspath.IsRootedDiskPath(base) {
    base = shimtspath.CombinePaths(shimtspath.GetDirectoryPath(containingFile), base)
  }
  base = shimtspath.NormalizePath(base)
  if shimtspath.HasExtension(base) {
    canonicalBase := caseSensitivity.Canonicalize(base)
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
//
// @evidence contracts/common.md#principled-implementation Universal type-discovery failure qualifies every realized graph source rather than only one importer.
// @evidence contracts/common.md#clear-and-simple-design One failure guard precedes a single source-map iteration.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Unchanged source text cannot hide a changed automatic type environment.
// @evidence contracts/common.md#meaningful-documentation Native prose states the global invalidation reason following the documentation skill.
// @evidenceExclude contracts/portability.md#os-neutral-implementation This method marks existing envelope keys and performs no native operation.
// @evidence contracts/performance.md#efficient-algorithms A false universal-failure guard visits no sources. Otherwise one pass assigns each realized source's reason, including map hashing/comparison work for its key text; no target lists or transitive graph closures are traversed.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The method propagates an existing failure and coordinates no shared computation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources It modifies the caller-owned observation without acquiring an independent cache or resource.
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
  caseSensitivity shimtspath.CaseSensitivity,
  flat *[]ProgramResolutionInput,
) []string {
  for _, candidate := range observer.observedPaths() {
    selectedPath := slicesContainResolutionPath(selected, candidate, caseSensitivity)
    identityOnly := selectedPath && observedResolutionPathHasDistinctIdentity(observer, candidate, caseSensitivity)
    if selectedPath && !identityOnly {
      continue
    }
    if !identityOnly {
      for _, target := range selected {
        if observedResolutionAlias(observer, candidate, target, caseSensitivity) {
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

func observedResolutionPathHasDistinctIdentity(observer *inputObservationFS, candidate string, caseSensitivity shimtspath.CaseSensitivity) bool {
  if observer == nil || candidate == "" {
    return false
  }
  observation, failure := observer.predicateProof(candidate)
  return failure == "" && observation.Realpath != nil && observation.Realpath.OK && !sameResolutionPath(observation.Realpath.Path, candidate, caseSensitivity)
}

func slicesContainResolutionPath(paths []string, candidate string, caseSensitivity shimtspath.CaseSensitivity) bool {
  for _, path := range paths {
    if sameResolutionPath(candidate, path, caseSensitivity) {
      return true
    }
  }
  return false
}

func sameResolutionPath(left, right string, caseSensitivity shimtspath.CaseSensitivity) bool {
  if left == "" || right == "" {
    return false
  }
  return caseSensitivity.Canonicalize(shimtspath.NormalizePath(left)) == caseSensitivity.Canonicalize(shimtspath.NormalizePath(right))
}

func observedResolutionAlias(observer *inputObservationFS, candidate, target string, caseSensitivity shimtspath.CaseSensitivity) bool {
  if observer == nil || candidate == "" || target == "" {
    return false
  }
  observation, failure := observer.predicateProof(candidate)
  return failure == "" && observation.Realpath != nil && observation.Realpath.OK && sameResolutionPath(observation.Realpath.Path, target, caseSensitivity)
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

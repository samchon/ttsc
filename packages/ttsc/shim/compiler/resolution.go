// gen_shims:hand-maintained

package compiler

import (
  "strings"
  "time"

  "github.com/microsoft/typescript-go/internal/ast"
  "github.com/microsoft/typescript-go/internal/collections"
  "github.com/microsoft/typescript-go/internal/core"
  "github.com/microsoft/typescript-go/internal/module"
  "github.com/microsoft/typescript-go/internal/symlinks"
  "github.com/microsoft/typescript-go/internal/tsoptions"
  "github.com/microsoft/typescript-go/internal/tspath"
  "github.com/microsoft/typescript-go/internal/vfs"
  "github.com/microsoft/typescript-go/internal/vfs/cachedvfs"
)

// ProgramResolutionKind distinguishes module and type-reference resolution.
//
// @evidence contracts/common.md#principled-implementation The two discriminants select the compiler's distinct module-name and type-directive algorithms, retaining their different result semantics.
// @evidence contracts/common.md#clear-and-simple-design One small enum selects the replay operation without encoding the distinction in task names or separate task containers.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The constants identify actual resolver operations rather than expected results or consumer-specific behavior.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies both resolution categories before the acknowledgment block.
// @evidenceExclude contracts/portability.md#os-neutral-implementation The enum selects a semantic operation and carries no native path or platform capability.
// @evidenceExclude contracts/performance.md#efficient-algorithms The discriminant representation does not own resolution processing.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The enum does not coordinate shared computation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The enum owns no retained state or running resource.
type ProgramResolutionKind uint8

const (
  ProgramResolutionKindModule ProgramResolutionKind = iota
  ProgramResolutionKindTypeReference
)

// ProgramResolutionTask is one resolution already performed by a resident
// Program. Exported fields let a host explicitly sort and group tasks; the
// record itself imposes no order. The
// unexported fields retain the exact compiler context needed for replay.
// Keep tasks with their originating Program options and project-reference
// metadata unchanged; ReplayProgramResolutions accepts one coherent source's
// task group, not arbitrary tasks from different programs.
//
// @evidence contracts/common.md#principled-implementation The record retains name, resolution mode, lexical containing path, expected target and originating options/project redirects, preserving the inputs needed to compare compiler resolution rather than only resolved filenames.
// @evidence contracts/common.md#clear-and-simple-design Public ordering/provenance fields are distinct from private replay context, allowing hosts to group tasks without manufacturing the compiler state used for semantic replay.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Expected results preserve actual package and symlink identities; task construction does not synthesize answers for consumer names.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs state resident-program provenance and coherent-group ownership; documented public fields have blank source lines between them.
// @evidence contracts/portability.md#os-neutral-implementation Lexical containing and resolved filenames remain distinct from loaded source/target filenames and canonical cache keys, preserving casing and project-reference spelling needed by native resolution.
// @evidenceExclude contracts/performance.md#efficient-algorithms This task record represents work selected by its producer, not the resolution algorithm owner.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The task type does not independently validate or coordinate reuse.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Retention of task arrays and referenced Program metadata belongs to producer and caller operations, not independently to the record declaration.
type ProgramResolutionTask struct {
  // ContainingFile is recovered source/config context when available, otherwise
  // the resident canonical cache-key spelling used for replay.
  ContainingFile string

  // Kind selects module or type-reference resolution.
  Kind ProgramResolutionKind

  // Mode carries the compiler's import-versus-require resolution mode.
  Mode core.ResolutionMode

  // Name is the original module or type-directive specifier.
  Name string

  // ResolvedFile is the resident resolver's target spelling, or empty if unresolved.
  ResolvedFile string

  // SourceFile names the loaded containing source, or is empty when none was
  // found, including automatic directives.
  SourceFile string

  // TargetFile names the loaded target after project-reference substitution, if available.
  TargetFile string

  // Universal marks automatic directives whose containing context is synthetic.
  Universal bool

  compilerOptions     *core.CompilerOptions
  currentDirectory    string
  expected            programResolutionResult
  projectReferences   *projectReferenceResolutionContext
  redirectedReference module.ResolvedProjectReference
}

// ProgramResolutionTasks returns every cached module and type-reference
// resolution, including unresolved entries and automatic type directives.
// A nil Program returns nil. Returned tasks retain Program option and redirect
// pointers; the caller owns their storage and must preserve that context.
// Enumeration order follows compiler maps and is not sorted. TargetFile is
// populated only when the target resolves to a loaded source. Extraction may
// initialize referenced configs' input/output maps and query a native realpath
// for a preserved symlink redirect; it does not replay module resolution.
//
// @evidence contracts/common.md#principled-implementation Enumerating the resident compiler's module and type-directive caches retains both successes and failures; containing paths recover loaded-source or semantic-config spelling, and expected results include package, target and link identity.
// @evidence contracts/common.md#clear-and-simple-design One append closure shares task construction across both compiler cache traversals, while private helpers own source-redirect and project-reference context reconstruction.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The inferred-types filename is the compiler's automatic-directive context, and recovering its lexical directory addresses actual case-canonical cache keys without relaxing result comparison.
// @evidence contracts/common.md#meaningful-documentation Native prose states cache coverage, nil behavior and retained Program-pointer lifetime; task fields document the lexical-versus-loaded path distinctions.
// @evidence contracts/portability.md#os-neutral-implementation Compiler canonical cache keys are not replayed as lexical filenames: source/config context restores spelling, and redirects use actual filesystem Realpath plus Program case policy rather than OS guesses.
// @evidence contracts/performance.md#efficient-algorithms Two cache traversals append one task per resolution and share one reference-context snapshot. Additional work includes reference-graph traversal, source/output map scans and first-use output-path construction, path hashing/canonicalization and selected native Realpath queries for symlink context. Map/string backing and referenced config/source population matter beyond just the returned task count; extraction does not independently replay imports.
// @evidence contracts/performance.md#reuse-equivalent-work Cached resident resolutions and one shared project-reference context are reused across tasks from the same Program, preserving their option and redirect identity rather than sharing across changed programs.
// @evidence contracts/performance.md#bound-retention-and-release-resources The returned task slice retains option, expected-result strings and redirect metadata, plus a shared context's directory set and output-to-reference map when present. These pointers can keep parsed project/config/source graphs reachable beyond the shallow map size. First-use input/output maps remain owned by referenced configs; invocation-local traversal/snapshot containers add no independent historical registry or running task, and callers bound how long they retain the result.
func ProgramResolutionTasks(program *Program) []ProgramResolutionTask {
  if program == nil {
    return nil
  }
  projectReferences := newProjectReferenceResolutionContext(program)
  tasks := []ProgramResolutionTask{}
  appendTask := func(kind ProgramResolutionKind, name string, mode core.ResolutionMode, filePath tspath.Path, expected programResolutionResult) {
    containingFile := string(filePath)
    sourceFile := ""
    targetFile := ""
    var redirectedReference module.ResolvedProjectReference
    if source := program.GetSourceFileByPath(filePath); source != nil {
      sourceFile = source.FileName()
      redirectedReference, containingFile = programResolutionContext(program, source)
    } else if kind == ProgramResolutionKindTypeReference && strings.HasSuffix(containingFile, module.InferredTypesContainingFile) {
      // filePath is a cache key, lowercased on case-insensitive filesystems,
      // not the lexical filename used by the resolver. Automatic types have
      // no SourceFile to recover that spelling from. Mirror upstream
      // fileLoader.addAutomaticTypeDirectiveTasks: the semantic config owns
      // their containing directory, falling back to cwd for configless hosts.
      // Secondary lookup (package subpaths and relative types) preserves this
      // spelling in resolvedFileName or a symlink's originalPath. Replaying a
      // lowercased key would falsely reject unchanged programs. Restore
      // the input context here; keep the strict result comparison below so
      // actual target, package and link changes still invalidate the program.
      containingDirectory := program.GetCurrentDirectory()
      if configFile := program.Options().ConfigFilePath; configFile != "" {
        containingDirectory = tspath.GetDirectoryPath(configFile)
      }
      containingFile = tspath.CombinePaths(containingDirectory, module.InferredTypesContainingFile)
    }
    if target := program.GetSourceFileForResolvedModule(expected.resolvedFileName); target != nil {
      targetFile = target.FileName()
    }
    tasks = append(tasks, ProgramResolutionTask{
      ContainingFile:      containingFile,
      Kind:                kind,
      Mode:                mode,
      Name:                name,
      ResolvedFile:        expected.resolvedFileName,
      SourceFile:          sourceFile,
      TargetFile:          targetFile,
      Universal:           strings.HasSuffix(containingFile, module.InferredTypesContainingFile),
      compilerOptions:     program.Options(),
      currentDirectory:    program.GetCurrentDirectory(),
      expected:            expected,
      projectReferences:   projectReferences,
      redirectedReference: redirectedReference,
    })
  }
  program.ForEachResolvedModule(func(resolution *module.ResolvedModule, name string, mode core.ResolutionMode, filePath tspath.Path) {
    appendTask(ProgramResolutionKindModule, name, mode, filePath, moduleResolutionResult(resolution))
  }, nil)
  program.ForEachResolvedTypeReferenceDirective(func(resolution *module.ResolvedTypeReferenceDirective, name string, mode core.ResolutionMode, filePath tspath.Path) {
    appendTask(ProgramResolutionKindTypeReference, name, mode, filePath, typeReferenceResolutionResult(resolution))
  }, nil)
  return tasks
}

// programResolutionContext mirrors projectReferenceFileMapper's containing
// file substitution using the public Program maps. The selected source path is
// part of resolution semantics, not merely diagnostic provenance.
func programResolutionContext(program *Program, source ast.HasFileName) (module.ResolvedProjectReference, string) {
  if redirected := program.GetProjectReferenceFromSource(source.Path()); redirected != nil {
    return redirected.Resolved, redirected.Source
  }
  if redirected := program.GetProjectReferenceFromOutputDts(source.Path()); redirected != nil {
    return redirected.Resolved, redirected.Source
  }
  redirect := program.GetRedirectForResolution(source)
  if redirect == nil {
    return nil, source.FileName()
  }
  // The remaining redirect form is a preserved node_modules symlink whose
  // physical declaration belongs to a project reference. Resolve the same
  // physical key the compiler mapper used and retain the original source name.
  realpath := program.Host().FS().Realpath(source.FileName())
  path := tspath.ToPath(realpath, program.GetCurrentDirectory(), program.UseCaseSensitiveFileNames())
  if redirected := program.GetProjectReferenceFromOutputDts(path); redirected != nil {
    return redirected.Resolved, redirected.Source
  }
  // A concurrent retarget can make the public lookup disappear after the
  // resident redirect was cached. Keep the redirect so replay necessarily
  // disagrees with the resident result or its observed identity proof fails.
  return redirect, source.FileName()
}

// ReplayProgramResolutions resolves one source's tasks with one fresh upstream
// resolver and reports whether every result still matches the resident Program.
// Tasks must share compiler options, current directory and project-reference
// context. An empty group, nil filesystem or missing options returns false.
// Every supported task is submitted even after a mismatch; group-local caches
// can satisfy equivalent lookups without repeating native reads. Equality is
// over the projected result fields, not a complete filesystem snapshot proof.
//
// @evidence contracts/common.md#principled-implementation A fresh upstream resolver replays each kind with its original name, mode, lexical containing file and redirect, then compares the complete projected result including unresolved, package and symlink identity; tasks require one coherent originating context.
// @evidence contracts/common.md#clear-and-simple-design One resolver and project-reference filesystem view belong to a group, while result projection centralizes equality and the loop continues submitting tasks after a mismatch instead of stopping at the first changed result.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Virtual declaration existence follows actual project-reference source mappings; unsupported resolver write operations panic rather than silently fabricating effects, and full result equality is not weakened to hide changed identities.
// @evidence contracts/common.md#meaningful-documentation Native prose explains coherent-group premises, invalid-input refusal and why replay continues after a mismatch, with separate descriptive and acknowledgment sections.
// @evidence contracts/portability.md#os-neutral-implementation The supplied filesystem determines case sensitivity, existence and realpaths; the virtual declaration view uses canonical compiler paths and tracks native symlinks while preserving lexical resolver inputs.
// @evidence contracts/performance.md#efficient-algorithms Each supported task makes one resolver call and compares projected string/scalar fields, with group-local caches sharing eligible lookups. Actual resolver work includes ancestor/package probing, manifest bytes and path processing; tracing can bypass result-cache hits. Virtual declaration and known-link fallback scans can multiply directory/link population across existence queries, with native source-existence and realpath work in addition to map membership.
// @evidence contracts/performance.md#reuse-equivalent-work One fresh resolver and cached virtual filesystem share equivalent lookups within a coherent group; a new replay filesystem prevents prior observation results from hiding changed native inputs.
// @evidence contracts/performance.md#bound-retention-and-release-resources Fresh resolver and optional virtual/cached filesystem state retain entries, manifest buffers, projected results and known links for the synchronous group. This adapter keeps no historical registry or spawned task after return, making otherwise-unreferenced local state eligible for collection without promising immediate reclamation. Borrowed task/config graphs and observations retained by the supplied filesystem stay under their owners, with no fixed population or byte cap imposed here.
func ReplayProgramResolutions(tasks []ProgramResolutionTask, filesystem vfs.FS) bool {
  if len(tasks) == 0 || filesystem == nil || tasks[0].compilerOptions == nil {
    return false
  }
  first := tasks[0]
  host := resolutionHost{
    filesystem:       first.projectReferences.filesystem(filesystem),
    currentDirectory: first.currentDirectory,
  }
  resolver := module.NewResolver(host, first.compilerOptions, "", "")
  matches := true
  for _, task := range tasks {
    var actual programResolutionResult
    switch task.Kind {
    case ProgramResolutionKindModule:
      resolution, _ := resolver.ResolveModuleName(task.Name, task.ContainingFile, task.Mode, task.redirectedReference)
      actual = moduleResolutionResult(resolution)
    case ProgramResolutionKindTypeReference:
      resolution, _ := resolver.ResolveTypeReferenceDirective(task.Name, task.ContainingFile, task.Mode, task.redirectedReference)
      actual = typeReferenceResolutionResult(resolution)
    default:
      matches = false
      continue
    }
    if actual != task.expected {
      matches = false
    }
  }
  return matches
}

// projectReferenceResolutionContext snapshots the immutable metadata needed to
// recreate fileLoader's project-reference declaration view for every replay
// filesystem. A referenced output declaration may be absent on disk while its
// source exists; the resolver must see the virtual declaration before Program
// substitutes that source into the loaded graph.
type projectReferenceResolutionContext struct {
  currentDirectory            string
  dtsDirectories              collections.Set[tspath.Path]
  outputDtsToProjectReference map[tspath.Path]*tsoptions.SourceOutputAndProjectReference
}

func newProjectReferenceResolutionContext(program *Program) *projectReferenceResolutionContext {
  if program == nil {
    return nil
  }
  outputDtsToProjectReference := map[tspath.Path]*tsoptions.SourceOutputAndProjectReference{}
  dtsDirectories := collections.Set[tspath.Path]{}
  useSourceOfProjectReference := false
  program.RangeResolvedProjectReference(func(_ tspath.Path, config *tsoptions.ParsedCommandLine, _ *tsoptions.ParsedCommandLine, _ int) bool {
    if config == nil {
      return true
    }
    config.ParseInputOutputNames()
    for path := range config.SourceToProjectReference() {
      useSourceOfProjectReference = useSourceOfProjectReference || program.IsSourceFromProjectReference(path)
    }
    for path, reference := range config.OutputDtsToProjectReference() {
      outputDtsToProjectReference[path] = reference
    }
    declarationDirectory := config.CompilerOptions().DeclarationDir
    if declarationDirectory == "" {
      declarationDirectory = config.CompilerOptions().OutDir
    }
    if declarationDirectory != "" {
      dtsDirectories.Add(tspath.ToPath(declarationDirectory, program.GetCurrentDirectory(), program.UseCaseSensitiveFileNames()))
    }
    return true
  })
  if !useSourceOfProjectReference || len(outputDtsToProjectReference) == 0 {
    return nil
  }
  return &projectReferenceResolutionContext{
    currentDirectory:            program.GetCurrentDirectory(),
    dtsDirectories:              dtsDirectories,
    outputDtsToProjectReference: outputDtsToProjectReference,
  }
}

func (context *projectReferenceResolutionContext) filesystem(filesystem vfs.FS) vfs.FS {
  if context == nil || filesystem == nil {
    return filesystem
  }
  return cachedvfs.From(&projectReferenceResolutionFS{
    filesystem:                  filesystem,
    currentDirectory:            context.currentDirectory,
    dtsDirectories:              context.dtsDirectories,
    knownSymlinks:               symlinks.KnownSymlinks{},
    outputDtsToProjectReference: context.outputDtsToProjectReference,
  })
}

// projectReferenceResolutionFS mirrors TypeScript-Go's
// projectReferenceDtsFakingVfs over the caller's observation filesystem.
type projectReferenceResolutionFS struct {
  filesystem                  vfs.FS
  currentDirectory            string
  dtsDirectories              collections.Set[tspath.Path]
  knownSymlinks               symlinks.KnownSymlinks
  outputDtsToProjectReference map[tspath.Path]*tsoptions.SourceOutputAndProjectReference
}

var _ vfs.FS = (*projectReferenceResolutionFS)(nil)

func (fs *projectReferenceResolutionFS) UseCaseSensitiveFileNames() bool {
  return fs.filesystem.UseCaseSensitiveFileNames()
}

func (fs *projectReferenceResolutionFS) FileExists(path string) bool {
  if fs.filesystem.FileExists(path) {
    return true
  }
  if !tspath.IsDeclarationFileName(path) {
    return false
  }
  return fs.fileOrDirectoryExistsUsingSource(path, true)
}

func (fs *projectReferenceResolutionFS) ReadFile(path string) (string, bool) {
  return fs.filesystem.ReadFile(path)
}

func (fs *projectReferenceResolutionFS) WriteFile(string, string) error {
  panic("should not be called by resolver")
}

func (fs *projectReferenceResolutionFS) AppendFile(string, string) error {
  panic("should not be called by resolver")
}

func (fs *projectReferenceResolutionFS) Remove(string) error {
  panic("should not be called by resolver")
}

func (fs *projectReferenceResolutionFS) Chtimes(string, time.Time, time.Time) error {
  panic("should not be called by resolver")
}

func (fs *projectReferenceResolutionFS) DirectoryExists(path string) bool {
  if fs.filesystem.DirectoryExists(path) {
    fs.handleDirectoryCouldBeSymlink(path)
    return true
  }
  return fs.fileOrDirectoryExistsUsingSource(path, false)
}

func (fs *projectReferenceResolutionFS) GetAccessibleEntries(string) vfs.Entries {
  panic("should not be called by resolver")
}

func (fs *projectReferenceResolutionFS) Stat(string) vfs.FileInfo {
  panic("should not be called by resolver")
}

func (fs *projectReferenceResolutionFS) WalkDir(string, vfs.WalkDirFunc) error {
  panic("should not be called by resolver")
}

func (fs *projectReferenceResolutionFS) Realpath(path string) string {
  if result, ok := fs.knownSymlinks.Files().Load(fs.toPath(path)); ok {
    return result
  }
  return fs.filesystem.Realpath(path)
}

func (fs *projectReferenceResolutionFS) toPath(path string) tspath.Path {
  return tspath.ToPath(path, fs.currentDirectory, fs.UseCaseSensitiveFileNames())
}

func (fs *projectReferenceResolutionFS) handleDirectoryCouldBeSymlink(directory string) {
  if tspath.ContainsIgnoredPath(directory) || !strings.Contains(directory, "/node_modules/") {
    return
  }
  directoryPath := tspath.Path(tspath.EnsureTrailingDirectorySeparator(string(fs.toPath(directory))))
  if _, ok := fs.knownSymlinks.Directories().Load(directoryPath); ok {
    return
  }
  realDirectory := fs.Realpath(directory)
  if realDirectory == directory {
    return
  }
  realPath := tspath.Path(tspath.EnsureTrailingDirectorySeparator(string(fs.toPath(realDirectory))))
  if realPath == directoryPath {
    return
  }
  fs.knownSymlinks.SetDirectory(directory, directoryPath, &symlinks.KnownDirectoryLink{
    Real:     tspath.EnsureTrailingDirectorySeparator(realDirectory),
    RealPath: realPath,
  })
}

func (fs *projectReferenceResolutionFS) fileOrDirectoryExistsUsingSource(fileOrDirectory string, isFile bool) bool {
  existence := fs.directoryExistsIfProjectReferenceDeclarationDirectory
  if isFile {
    existence = fs.fileExistsIfProjectReferenceDeclaration
  }
  result := existence(fileOrDirectory)
  if result != core.TSUnknown {
    return result == core.TSTrue
  }
  knownDirectoryLinks := fs.knownSymlinks.Directories()
  if knownDirectoryLinks.Size() == 0 {
    return false
  }
  fileOrDirectoryPath := fs.toPath(fileOrDirectory)
  if !strings.Contains(string(fileOrDirectoryPath), "/node_modules/") {
    return false
  }
  if isFile {
    if _, ok := fs.knownSymlinks.Files().Load(fileOrDirectoryPath); ok {
      return true
    }
  }
  exists := false
  knownDirectoryLinks.Range(func(directoryPath tspath.Path, knownDirectoryLink *symlinks.KnownDirectoryLink) bool {
    relative, hasPrefix := strings.CutPrefix(string(fileOrDirectoryPath), string(directoryPath))
    if !hasPrefix {
      return true
    }
    if exists = existence(string(knownDirectoryLink.RealPath) + relative).IsTrue(); !exists {
      return true
    }
    if isFile {
      absolutePath := tspath.GetNormalizedAbsolutePath(fileOrDirectory, fs.currentDirectory)
      fs.knownSymlinks.SetFile(
        absolutePath,
        fileOrDirectoryPath,
        knownDirectoryLink.Real+absolutePath[len(directoryPath):],
      )
    }
    return false
  })
  return exists
}

func (fs *projectReferenceResolutionFS) fileExistsIfProjectReferenceDeclaration(file string) core.Tristate {
  reference := fs.outputDtsToProjectReference[fs.toPath(file)]
  if reference == nil {
    return core.TSUnknown
  }
  return core.IfElse(fs.filesystem.FileExists(reference.Source), core.TSTrue, core.TSFalse)
}

func (fs *projectReferenceResolutionFS) directoryExistsIfProjectReferenceDeclarationDirectory(directory string) core.Tristate {
  directoryPath := fs.toPath(directory)
  directoryPathWithSeparator := directoryPath + "/"
  for declarationDirectoryPath := range fs.dtsDirectories.Keys() {
    if directoryPath == declarationDirectoryPath || strings.HasPrefix(string(declarationDirectoryPath), string(directoryPathWithSeparator)) || strings.HasPrefix(string(directoryPath), string(declarationDirectoryPath)+"/") {
      return core.TSTrue
    }
  }
  return core.TSUnknown
}

// ReplayAutomaticTypeDirectiveDiscovery repeats the compiler's exact wildcard
// type-root enumeration over filesystem so a host can observe its inputs.
// Nil program, filesystem or compiler options performs no discovery.
// Explicit non-wildcard types can return without filesystem enumeration.
// Wildcard discovery also reads package manifests to omit typings-null packages;
// this function discards the returned names, not filesystem observation state.
// Default wildcard roots require a config path or nonempty resident cwd, as
// required by the upstream effective-root helper.
//
// @evidence contracts/common.md#principled-implementation The compiler's automatic-type directive enumeration receives the resident options and current directory over the observation filesystem, reproducing wildcard discovery inputs rather than inferring them from only previously resolved targets.
// @evidence contracts/common.md#clear-and-simple-design A minimal resolution host exposes filesystem and cwd directly to the owning discovery helper; enumeration results need not be retained because observation is the required effect.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Replay preserves real enumeration effects through a supported host instead of injecting assumed type-package names or patching the compiler's cache.
// @evidence contracts/common.md#meaningful-documentation Native prose states wildcard discovery's observation purpose and nil-input no-op behavior, with separate tags.
// @evidence contracts/portability.md#os-neutral-implementation Discovery obtains directories and entries from the caller's filesystem and resident cwd through the compiler host, without inferring type-root availability or casing from the OS.
// @evidenceExclude contracts/performance.md#efficient-algorithms Upstream owns effective-root construction, directory enumeration, package-manifest reads/parsing, wildcard substitution and name deduplication. Costs include ancestor/path text, entries, manifest bytes and selected type-name population; this direct adapter chooses no separate discovery algorithm and discards only the returned names.
// @evidence contracts/performance.md#reuse-equivalent-work Enumeration itself is the input-observation effect, so a resident list cannot replace traversal on a new filesystem observation; callers may share the resulting observation proof only when its filesystem snapshot is equivalent.
// @evidence contracts/performance.md#bound-retention-and-release-resources Upstream discovery can allocate root/name lists, package buffers and parsed manifest state during the synchronous call. The result is discarded here, while compiler options and any filesystem caches or collected observation entries remain under their existing owners. This adapter keeps no independent historical name registry or running task and imposes no bound on caller-owned observation retention.
func ReplayAutomaticTypeDirectiveDiscovery(program *Program, filesystem vfs.FS) {
  if program == nil || filesystem == nil || program.Options() == nil {
    return
  }
  module.GetAutomaticTypeDirectiveNames(program.Options(), resolutionHost{
    filesystem:       filesystem,
    currentDirectory: program.GetCurrentDirectory(),
  })
}

type resolutionHost struct {
  filesystem       vfs.FS
  currentDirectory string
}

func (host resolutionHost) FS() vfs.FS { return host.filesystem }

func (host resolutionHost) GetCurrentDirectory() string { return host.currentDirectory }

type programResolutionResult struct {
  alternateResult          string
  extension                string
  isExternalLibraryImport  bool
  originalPath             string
  packageName              string
  packagePeerDependencies  string
  packageSubModuleName     string
  packageVersion           string
  primary                  bool
  resolvedFileName         string
  resolvedUsingTsExtension bool
}

func moduleResolutionResult(resolution *module.ResolvedModule) programResolutionResult {
  if resolution == nil {
    return programResolutionResult{}
  }
  return programResolutionResult{
    alternateResult:          resolution.AlternateResult,
    extension:                resolution.Extension,
    isExternalLibraryImport:  resolution.IsExternalLibraryImport,
    originalPath:             resolution.OriginalPath,
    packageName:              resolution.PackageId.Name,
    packagePeerDependencies:  resolution.PackageId.PeerDependencies,
    packageSubModuleName:     resolution.PackageId.SubModuleName,
    packageVersion:           resolution.PackageId.Version,
    resolvedFileName:         resolution.ResolvedFileName,
    resolvedUsingTsExtension: resolution.ResolvedUsingTsExtension,
  }
}

func typeReferenceResolutionResult(resolution *module.ResolvedTypeReferenceDirective) programResolutionResult {
  if resolution == nil {
    return programResolutionResult{}
  }
  return programResolutionResult{
    isExternalLibraryImport: resolution.IsExternalLibraryImport,
    originalPath:            resolution.OriginalPath,
    packageName:             resolution.PackageId.Name,
    packagePeerDependencies: resolution.PackageId.PeerDependencies,
    packageSubModuleName:    resolution.PackageId.SubModuleName,
    packageVersion:          resolution.PackageId.Version,
    primary:                 resolution.Primary,
    resolvedFileName:        resolution.ResolvedFileName,
  }
}

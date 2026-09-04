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
type ProgramResolutionKind uint8

const (
  ProgramResolutionKindModule ProgramResolutionKind = iota
  ProgramResolutionKindTypeReference
)

// ProgramResolutionTask is one resolution already performed by a resident
// Program. The exported fields provide deterministic host ordering while the
// unexported fields retain the exact compiler context needed for replay.
type ProgramResolutionTask struct {
  ContainingFile string
  Kind           ProgramResolutionKind
  Mode           core.ResolutionMode
  Name           string
  ResolvedFile   string
  SourceFile     string
  TargetFile     string
  Universal      bool

  compilerOptions     *core.CompilerOptions
  currentDirectory    string
  expected            programResolutionResult
  projectReferences   *projectReferenceResolutionContext
  redirectedReference module.ResolvedProjectReference
}

// ProgramResolutionTasks returns every cached module and type-reference
// resolution, including unresolved entries and automatic type directives.
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

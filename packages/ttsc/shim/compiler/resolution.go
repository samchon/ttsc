// gen_shims:hand-maintained

package compiler

import (
  "strings"

  "github.com/microsoft/typescript-go/internal/ast"
  "github.com/microsoft/typescript-go/internal/core"
  "github.com/microsoft/typescript-go/internal/module"
  "github.com/microsoft/typescript-go/internal/tspath"
  "github.com/microsoft/typescript-go/internal/vfs"
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
  Universal      bool

  compilerOptions     *core.CompilerOptions
  currentDirectory    string
  expected            programResolutionResult
  redirectedReference module.ResolvedProjectReference
}

// ProgramResolutionTasks returns every cached module and type-reference
// resolution, including unresolved entries and automatic type directives.
func ProgramResolutionTasks(program *Program) []ProgramResolutionTask {
  if program == nil {
    return nil
  }
  tasks := []ProgramResolutionTask{}
  appendTask := func(kind ProgramResolutionKind, name string, mode core.ResolutionMode, filePath tspath.Path, expected programResolutionResult) {
    containingFile := string(filePath)
    sourceFile := ""
    var redirectedReference module.ResolvedProjectReference
    if source := program.GetSourceFileByPath(filePath); source != nil {
      sourceFile = source.FileName()
      redirectedReference, containingFile = programResolutionContext(program, source)
    }
    tasks = append(tasks, ProgramResolutionTask{
      ContainingFile:      containingFile,
      Kind:                kind,
      Mode:                mode,
      Name:                name,
      ResolvedFile:        expected.resolvedFileName,
      SourceFile:          sourceFile,
      Universal:           strings.HasSuffix(containingFile, module.InferredTypesContainingFile),
      compilerOptions:     program.Options(),
      currentDirectory:    program.GetCurrentDirectory(),
      expected:            expected,
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
  host := resolutionHost{filesystem: filesystem, currentDirectory: first.currentDirectory}
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

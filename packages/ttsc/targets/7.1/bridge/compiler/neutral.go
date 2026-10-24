package compiler

import (
  "context"
  "errors"
  "path/filepath"
  "sort"
  "sync"

  innerast "github.com/microsoft/TypeScript/tsc/internal/ast"
  innercompiler "github.com/microsoft/TypeScript/tsc/internal/compiler"
  "github.com/microsoft/TypeScript/tsc/internal/contentmapper"
  innercore "github.com/microsoft/TypeScript/tsc/internal/core"
  innerlocale "github.com/microsoft/TypeScript/tsc/internal/locale"
  inneroutputpaths "github.com/microsoft/TypeScript/tsc/internal/outputpaths"
  innertsoptions "github.com/microsoft/TypeScript/tsc/internal/tsoptions"
  innertspath "github.com/microsoft/TypeScript/tsc/internal/tspath"
  innervfs "github.com/microsoft/TypeScript/tsc/internal/vfs"
)

// Version-neutral compiler operations.
//
// The TypeScript 7.0 and 7.1 compilers construct hosts, update Programs and
// report path identity through different signatures. Code that must compile on
// both compiler targets calls these functions, which the 7.0 shim declares
// with identical signatures. Here each makes the 7.1 call.

// NewHost returns a compiler host over fs that finds the bundled library files
// at defaultLibraryPath. TypeScript 7.0 hosts carry currentDirectory as the
// Program's working directory; TypeScript 7.1 takes it from the parsed config,
// so here it is unused.
//
// @evidence contracts/common.md#principled-implementation Calls NewCompilerHost with the filesystem and library path and no config cache, trace or content-mapper project; 7.1 hosts carry no working directory.
// @evidence contracts/common.md#clear-and-simple-design One constructor call keeps the target difference inside the shim.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No host behavior is reimplemented here.
// @evidence contracts/common.md#meaningful-documentation Native prose states each target's use of currentDirectory.
// @evidence contracts/portability.md#os-neutral-implementation The supplied FS owns every native operation the host later makes; construction performs none.
// @evidenceExclude contracts/performance.md#efficient-algorithms Construction assigns fields and chooses no algorithm.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call returns a fresh host; callers share one by holding it.
// @evidence contracts/performance.md#bound-retention-and-release-resources The host retains fs and the library path for the caller's lifetime and owns no handle.
func NewHost(currentDirectory innertspath.RootedDirectoryPath, fs innervfs.FS, defaultLibraryPath innertspath.RootedDirectoryPath) innercompiler.CompilerHost {
  return innercompiler.NewCompilerHost(fs, defaultLibraryPath, nil, nil, nil)
}

// ProjectHosts builds the compiler hosts of the Programs one parsed project
// produces and owns what those hosts share. On TypeScript 7.1 that is the
// project's content mappers: when the config declares `contentMappers` and the
// command line passed `--runExternalCode`, every host transforms content-mapped
// files through one mapper project, and Close stops the mapper processes. A nil
// ProjectHosts builds plain hosts. TypeScript 7.0 has no content mappers.
//
// @evidence contracts/common.md#principled-implementation Mirrors tsc's own setup: a content-mapper host and its ProjectSpec project exist only under runExternalCode with configured mappers, and the project is handed to every compiler host.
// @evidence contracts/common.md#clear-and-simple-design One value pairs host construction with the release of the mapper state the hosts share, so incremental hosts keep the project the first host used.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The compiler's own runExternalCode gate and mapper resolution decide whether mappers run; no ttsc authorization or mapping policy is added.
// @evidence contracts/common.md#meaningful-documentation Native prose states when mappers run, the nil meaning and the 7.0 difference.
// @evidence contracts/portability.md#os-neutral-implementation Mapper processes start through spawnContentMapper's os/exec boundary in each mapper package's directory; the supplied FS owns every file read.
// @evidenceExclude contracts/performance.md#efficient-algorithms This declaration chooses no algorithm; its fields retain shared mapper state and resolved manifest names.
// @evidence contracts/performance.md#reuse-equivalent-work Every host built from one ProjectHosts shares one mapper project, so an incremental generation reuses the processes the first generation started.
// @evidence contracts/performance.md#bound-retention-and-release-resources The mapper project and host, and with them every spawned mapper process, live until Close; Close releases them once.
type ProjectHosts struct {
  mappers   contentmapper.Host
  project   contentmapper.Project
  closeOnce sync.Once
  closeErr  error
  manifests []string
}

// NewProjectHosts returns the hosts of Programs built from config. It starts
// no process: mapper processes start when a host first reads a mapped file.
//
// @evidence contracts/common.md#principled-implementation Opens the content-mapper host and project exactly as tsc's NewContentMapperHost and getContentMapperProject do, from the config's resolved mappers and effective options.
// @evidence contracts/common.md#clear-and-simple-design One gate returns either a nil value or a value holding the mapper project.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Mapper resolution and its diagnostics stay with the config parser; this function adds none.
// @evidence contracts/common.md#meaningful-documentation Native prose states that construction starts no process.
// @evidence contracts/portability.md#os-neutral-implementation Native filepath.Join constructs manifest paths in resolved package directories; mapper processes start later through spawnContentMapper.
// @evidence contracts/performance.md#efficient-algorithms Construction checks the gate and copies each configured mapper package directory into a manifest path. Cost and returned path storage follow mapper count and path text.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call opens its own mapper state; callers share it by holding the value.
// @evidence contracts/performance.md#bound-retention-and-release-resources The returned value owns the mapper host and project until Close.
func NewProjectHosts(config *innertsoptions.ParsedCommandLine) *ProjectHosts {
  if config == nil || !config.CompilerOptions().RunExternalCode.IsTrue() || len(config.ContentMappers()) == 0 {
    return nil
  }
  diagnosticLocale, _ := innerlocale.Parse(config.CompilerOptions().Locale)
  mappers := contentmapper.NewHost(context.Background(), contentmapper.SpawnerFunc(spawnContentMapper), diagnosticLocale)
  manifests := make([]string, 0, len(config.ContentMappers()))
  for _, mapper := range config.ContentMappers() {
    if mapper.PackageDirectory != "" {
      manifests = append(manifests, filepath.Join(string(mapper.PackageDirectory), "package.json"))
    }
  }
  return &ProjectHosts{
    manifests: manifests,
    mappers:   mappers,
    project: mappers.Project(contentmapper.ProjectSpec{
      ConfigFileName:  config.ConfigName(),
      Mappers:         config.ContentMappers(),
      CompilerOptions: config.CompilerOptions(),
    }),
  }
}

// Dependencies returns mapper manifests and upstream-declared dynamic inputs.
// WatchedFiles can open dynamic project configuration; its error is returned
// alongside manifests so callers keep recovery inputs without claiming success.
//
// @evidence contracts/common.md#principled-implementation Uses the pinned upstream Project.WatchedFiles declaration and resolved mapper package directories; it does not infer reads from mapper code.
// @evidence contracts/common.md#clear-and-simple-design One projection transfers the project-owned dependency population without changing the mapper protocol.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Upstream errors remain errors and manifests remain available for recovery; no post-compile hash is invented.
// @evidence contracts/common.md#meaningful-documentation Native prose documents lazy opening, declaration scope and partial error results.
// @evidence contracts/portability.md#os-neutral-implementation Native filepath.Join anchors manifests in resolved package directories; upstream watched paths retain their absolute native spelling.
// @evidence contracts/performance.md#efficient-algorithms Copies declared input names and sorts them; upstream WatchedFiles can open dynamic mapper projects and perform protocol IO.
// @evidence contracts/performance.md#reuse-equivalent-work Upstream project state shares opened configuration; each returned slice is independently owned.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned names escape to the caller; ProjectHosts still owns mapper lifetime through Close.
func (h *ProjectHosts) Dependencies() ([]string, error) {
  if h == nil {
    return nil, nil
  }
  inputs := append([]string(nil), h.manifests...)
  watched, err := h.project.WatchedFiles()
  for _, file := range watched {
    inputs = append(inputs, string(file))
  }
  sort.Strings(inputs)
  return inputs, err
}

// Host returns a compiler host over fs, like NewHost, that transforms
// content-mapped files through this project's mappers.
//
// @evidence contracts/common.md#principled-implementation Calls NewCompilerHost with the shared mapper project, the argument tsc passes for the same project.
// @evidence contracts/common.md#clear-and-simple-design A nil receiver reduces to NewHost, so callers need no separate plain-host branch.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Content-mapped file loading stays the compiler host's.
// @evidence contracts/common.md#meaningful-documentation Native prose states the relation to NewHost.
// @evidence contracts/portability.md#os-neutral-implementation The supplied FS owns every native read the host makes.
// @evidenceExclude contracts/performance.md#efficient-algorithms Construction assigns fields.
// @evidence contracts/performance.md#reuse-equivalent-work Every returned host shares one mapper project.
// @evidence contracts/performance.md#bound-retention-and-release-resources The host borrows the project; Close on the ProjectHosts releases it.
func (h *ProjectHosts) Host(currentDirectory innertspath.RootedDirectoryPath, fs innervfs.FS, defaultLibraryPath innertspath.RootedDirectoryPath) innercompiler.CompilerHost {
  if h == nil {
    return NewHost(currentDirectory, fs, defaultLibraryPath)
  }
  return innercompiler.NewCompilerHost(fs, defaultLibraryPath, nil, nil, h.project)
}

// Close closes the mapper project and stops every mapper process. Later calls
// return the first result.
//
// @evidence contracts/common.md#principled-implementation Closes the project before its host, the order tsc releases them in.
// @evidence contracts/common.md#clear-and-simple-design sync.Once makes release idempotent for every owner that closes it.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Both close errors are returned rather than dropped.
// @evidence contracts/common.md#meaningful-documentation Native prose states repeated-call behavior.
// @evidence contracts/portability.md#os-neutral-implementation Stopping a mapper closes its pipes and kills its process through os/exec.
// @evidenceExclude contracts/performance.md#efficient-algorithms Release closes two handles.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Release coordinates no shared computation.
// @evidence contracts/performance.md#bound-retention-and-release-resources After Close no mapper process of this project remains; hosts built from it can no longer transform mapped files.
func (h *ProjectHosts) Close() error {
  if h == nil {
    return nil
  }
  h.closeOnce.Do(func() {
    h.closeErr = errors.Join(h.project.Close(), h.mappers.Close())
  })
  return h.closeErr
}

// UpdateProgram returns a Program in which only the file keyed by changed was
// edited, the changed file as host parsed it, and whether the old Program's
// data was reused. A nil Program means the update could not be made.
//
// @evidence contracts/common.md#principled-implementation Calls Program.UpdateProgram with the Program's own checker pool and module resolver.
// @evidence contracts/common.md#clear-and-simple-design One method call keeps the target difference inside the shim.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Reuse decisions remain the compiler's.
// @evidence contracts/common.md#meaningful-documentation Native prose states the three results and the nil meaning.
// @evidenceExclude contracts/portability.md#os-neutral-implementation The host owns any filesystem read; this call adds none.
// @evidence contracts/performance.md#efficient-algorithms The compiler reparses only the changed file and reuses the rest when it can.
// @evidence contracts/performance.md#reuse-equivalent-work The compiler decides reuse of the old Program's files and data.
// @evidence contracts/performance.md#bound-retention-and-release-resources The new Program may share data with the old one; the caller owns releasing the old Program's checkers.
func UpdateProgram(program *innercompiler.Program, changed innertspath.PathKey, host innercompiler.CompilerHost) (*innercompiler.Program, *innerast.SourceFile, bool) {
  return program.UpdateProgram(changed, host, nil, nil)
}

// ProgramCaseSensitivity reports the case policy the Program compares file
// names with.
//
// @evidence contracts/common.md#principled-implementation Returns Program.CaseSensitivity.
// @evidence contracts/common.md#clear-and-simple-design One method call keeps the target difference inside the shim.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The policy is the Program's own, not probed again.
// @evidence contracts/common.md#meaningful-documentation Native prose names what the policy governs.
// @evidenceExclude contracts/portability.md#os-neutral-implementation The Program answers from its stored policy without a native call.
// @evidenceExclude contracts/performance.md#efficient-algorithms A stored value is returned.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The function coordinates no shared work.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The function retains nothing.
func ProgramCaseSensitivity(program *innercompiler.Program) innertspath.CaseSensitivity {
  return program.CaseSensitivity()
}

// ProgramPathKey returns the key the Program files fileName under, which is
// the canonical form of its absolute path.
//
// @evidence contracts/common.md#principled-implementation Returns Program.PathKeyForFileName, the key the Program indexes its files by.
// @evidence contracts/common.md#clear-and-simple-design One method call keeps the target difference inside the shim.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No path canonicalization is reimplemented here.
// @evidence contracts/common.md#meaningful-documentation Native prose states the canonical-key meaning.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Key derivation manipulates path text only.
// @evidenceExclude contracts/performance.md#efficient-algorithms The compiler owns the canonicalization.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The function coordinates no shared work.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The function retains nothing beyond the returned key.
func ProgramPathKey(program *innercompiler.Program, fileName innertspath.RootedFilePath) innertspath.PathKey {
  return program.PathKeyForFileName(fileName)
}

// SourceFilesToEmit returns the program files a whole-program emit writes.
//
// @evidence contracts/common.md#principled-implementation Calls 7.1's GetSourceFilesToEmit with no target files and no forced declaration or JavaScript emit, the emitter's whole-program file set.
// @evidence contracts/common.md#clear-and-simple-design One call per target keeps compiler signature differences out of every emit caller.
// @evidence contracts/common.md#prohibited-implementation-shortcuts File selection remains the compiler's.
// @evidence contracts/common.md#meaningful-documentation Native prose states the whole-program scope.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Selection reads Program state and performs no native operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms The compiler owns the file scan.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The function coordinates no shared work.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned slice is caller-owned.
func SourceFilesToEmit(host innercompiler.SourceFileMayBeEmittedHost) []*innerast.SourceFile {
  return GetSourceFilesToEmit(host, nil, false, false)
}

// OutputPathsFor returns the emitter's output paths for one source file
// without forcing declaration paths.
//
// @evidence contracts/common.md#principled-implementation Calls 7.1's GetOutputPathsFor with an empty ForceEmitPaths, the paths the emitter writes.
// @evidence contracts/common.md#clear-and-simple-design One call per target keeps compiler signature differences out of every emit caller.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Path derivation remains the compiler's.
// @evidence contracts/common.md#meaningful-documentation Native prose states the unforced mode.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Path derivation manipulates path text only.
// @evidenceExclude contracts/performance.md#efficient-algorithms The compiler owns the derivation.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The function coordinates no shared work.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned paths are caller-owned.
func OutputPathsFor(source *innerast.SourceFile, options *innercore.CompilerOptions, host inneroutputpaths.OutputPathsHost) *inneroutputpaths.OutputPaths {
  return GetOutputPathsFor(source, options, host, ForceEmitPaths{})
}

// TargetedEmitOptions returns EmitOptions that emit target alone through
// writeFile, or the whole program when target is nil.
//
// @evidence contracts/common.md#principled-implementation Sets 7.1's TargetSourceFiles list to the single target, or leaves it nil for a whole-program emit.
// @evidence contracts/common.md#clear-and-simple-design One constructor per target keeps EmitOptions field differences out of every emit caller.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Emit scope remains the compiler's interpretation of the field.
// @evidence contracts/common.md#meaningful-documentation Native prose states the nil meaning.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Construction performs no native operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms Construction assigns two fields.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The function coordinates no shared work.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned value is caller-owned.
func TargetedEmitOptions(target *innerast.SourceFile, writeFile innercompiler.WriteFile) innercompiler.EmitOptions {
  var targets []*innerast.SourceFile
  if target != nil {
    targets = []*innerast.SourceFile{target}
  }
  return innercompiler.EmitOptions{TargetSourceFiles: targets, WriteFile: writeFile}
}

// EmitsWholeProgram reports whether options name no target file.
//
// @evidence contracts/common.md#principled-implementation Reads 7.1's TargetSourceFiles list.
// @evidence contracts/common.md#clear-and-simple-design One predicate per target keeps EmitOptions field differences out of every emit caller.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The predicate reads the field the compiler reads.
// @evidence contracts/common.md#meaningful-documentation Native prose states the predicate.
// @evidenceExclude contracts/portability.md#os-neutral-implementation The predicate performs no native operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms The predicate reads one field.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The function coordinates no shared work.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The function retains nothing.
func EmitsWholeProgram(options innercompiler.EmitOptions) bool {
  return options.TargetSourceFiles == nil
}

// NewProgramOptions returns the options of a Program over config built through
// host. useSourceOfProjectReference reads a referenced project's sources rather
// than its declaration outputs. Every other option keeps the compiler default.
//
// @evidence contracts/common.md#principled-implementation Fills 7.1's ProgramConfig and ProgramHosts groups.
// @evidence contracts/common.md#clear-and-simple-design One constructor per target keeps ProgramOptions' layout difference out of every Program caller.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The returned options leave every other field at the compiler's default.
// @evidence contracts/common.md#meaningful-documentation Native prose names the three fields set and the defaults.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Construction performs no native operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms Construction assigns three fields.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The function coordinates no shared work.
// @evidence contracts/performance.md#bound-retention-and-release-resources The returned options reference the caller's config and host without copying them.
func NewProgramOptions(config *innertsoptions.ParsedCommandLine, host innercompiler.CompilerHost, useSourceOfProjectReference bool) innercompiler.ProgramOptions {
  return innercompiler.ProgramOptions{
    ProgramConfig: innercompiler.ProgramConfig{Config: config, UseSourceOfProjectReference: useSourceOfProjectReference},
    ProgramHosts:  innercompiler.ProgramHosts{Host: host},
  }
}

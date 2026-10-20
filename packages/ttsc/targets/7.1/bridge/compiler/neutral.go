package compiler

import (
  innerast "github.com/microsoft/TypeScript/tsc/internal/ast"
  innercompiler "github.com/microsoft/TypeScript/tsc/internal/compiler"
  innercore "github.com/microsoft/TypeScript/tsc/internal/core"
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

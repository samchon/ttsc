package tsoptions

import (
  innertsoptions "github.com/microsoft/TypeScript/tsc/internal/tsoptions"
  innertspath "github.com/microsoft/TypeScript/tsc/internal/tspath"
  innervfs "github.com/microsoft/TypeScript/tsc/internal/vfs"
)

// Version-neutral command-line and config parsing entry points.
//
// TypeScript 7.0 parses through a host that carries the working directory,
// while TypeScript 7.1 takes the filesystem and directory separately and asks
// its config host whether a content-mapper package may run. Code that must
// compile on both compiler targets calls these functions, which the 7.0 shim
// declares with identical signatures.

// NewParseConfigHost returns the config-parsing host over fs. TypeScript 7.0
// resolves relative paths against currentDirectory; TypeScript 7.1 resolves
// them against the config file and leaves content-mapper authorization to the
// runExternalCode option, so here currentDirectory is unused.
//
// @evidence contracts/common.md#principled-implementation Returns NewDefaultParseConfigHost, the compiler's host that defers content-mapper authorization to runExternalCode.
// @evidence contracts/common.md#clear-and-simple-design One constructor call keeps the target difference inside the shim.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No authorization policy is added here.
// @evidence contracts/common.md#meaningful-documentation Native prose states each target's use of currentDirectory.
// @evidence contracts/portability.md#os-neutral-implementation The supplied FS owns every native operation; the host adds none.
// @evidenceExclude contracts/performance.md#efficient-algorithms Construction assigns one field.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call returns a fresh host.
// @evidence contracts/performance.md#bound-retention-and-release-resources The host retains fs for the caller's lifetime and owns no handle.
func NewParseConfigHost(fs innervfs.FS, currentDirectory innertspath.RootedDirectoryPath) innertsoptions.ParseConfigHost {
  return innertsoptions.NewDefaultParseConfigHost(fs)
}

// ParseCommandLineAt parses tsc arguments, resolving relative values against
// currentDirectory, the directory the arguments were given in.
//
// @evidence contracts/common.md#principled-implementation Calls ParseCommandLine with the filesystem and argument base.
// @evidence contracts/common.md#clear-and-simple-design One parser call keeps the target difference inside the shim.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Argument parsing remains the compiler's.
// @evidence contracts/common.md#meaningful-documentation Native prose states which directory relative values use.
// @evidence contracts/portability.md#os-neutral-implementation Response-file reads go through the supplied FS.
// @evidenceExclude contracts/performance.md#efficient-algorithms The compiler owns the argument scan.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The function coordinates no shared work.
// @evidence contracts/performance.md#bound-retention-and-release-resources The returned command line is caller-owned.
func ParseCommandLineAt(args []string, fs innervfs.FS, currentDirectory innertspath.RootedDirectoryPath) *innertsoptions.ParsedCommandLine {
  return innertsoptions.ParseCommandLine(args, fs, currentDirectory)
}

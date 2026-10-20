package tsoptions

import (
  innertsoptions "github.com/microsoft/typescript-go/internal/tsoptions"
  innervfs "github.com/microsoft/typescript-go/internal/vfs"
)

// Version-neutral command-line and config parsing entry points.
//
// TypeScript 7.0 parses through a host that carries the working directory,
// while TypeScript 7.1 takes the filesystem and directory separately and asks
// its config host whether a content-mapper package may run. Code that must
// compile on both compiler targets calls these functions, which the 7.1 bridge
// declares with identical signatures.

// parseConfigHost is the 7.0 ParseConfigHost over a filesystem and the
// directory relative paths resolve against.
type parseConfigHost struct {
  fs               innervfs.FS
  currentDirectory string
}

func (h parseConfigHost) FS() innervfs.FS             { return h.fs }
func (h parseConfigHost) GetCurrentDirectory() string { return h.currentDirectory }

// NewParseConfigHost returns the config-parsing host over fs. TypeScript 7.0
// resolves relative paths against currentDirectory; TypeScript 7.1 resolves
// them against the config file and leaves content-mapper authorization to the
// runExternalCode option.
//
// @evidence contracts/common.md#principled-implementation Supplies 7.0's ParseConfigHost contract, a filesystem and a current directory, which ttsc's compiler host satisfied before.
// @evidence contracts/common.md#clear-and-simple-design A two-field value implements the two-method interface.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The host only reports its inputs; parsing stays with the compiler.
// @evidence contracts/common.md#meaningful-documentation Native prose states each target's use of currentDirectory.
// @evidence contracts/portability.md#os-neutral-implementation The supplied FS owns every native operation; the host adds none.
// @evidenceExclude contracts/performance.md#efficient-algorithms Construction assigns two fields.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call returns a fresh value.
// @evidence contracts/performance.md#bound-retention-and-release-resources The value retains fs and the directory string for the caller's lifetime and owns no handle.
func NewParseConfigHost(fs innervfs.FS, currentDirectory string) innertsoptions.ParseConfigHost {
  return parseConfigHost{fs: fs, currentDirectory: currentDirectory}
}

// ParseCommandLineAt parses tsc arguments, resolving relative values against
// currentDirectory, the directory the arguments were given in.
//
// @evidence contracts/common.md#principled-implementation Calls ParseCommandLine with a host whose current directory is the argument base, as ttsc's driver did with a host built at that directory.
// @evidence contracts/common.md#clear-and-simple-design One parser call keeps the target difference inside the shim.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Argument parsing remains the compiler's.
// @evidence contracts/common.md#meaningful-documentation Native prose states which directory relative values use.
// @evidence contracts/portability.md#os-neutral-implementation Response-file reads go through the supplied FS.
// @evidenceExclude contracts/performance.md#efficient-algorithms The compiler owns the argument scan.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The function coordinates no shared work.
// @evidence contracts/performance.md#bound-retention-and-release-resources The returned command line is caller-owned; the temporary host is released on return.
func ParseCommandLineAt(args []string, fs innervfs.FS, currentDirectory string) *innertsoptions.ParsedCommandLine {
  return innertsoptions.ParseCommandLine(args, NewParseConfigHost(fs, currentDirectory))
}

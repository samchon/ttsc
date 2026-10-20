package tspath

import innertspath "github.com/microsoft/typescript-go/internal/tspath"

// Typed path names of the TypeScript 7.1 compiler.
//
// TypeScript 7.1 types every path, while TypeScript 7.0 spells each one as a
// string and keys files by Path. These aliases give 7.0 the 7.1 names, so code
// that must compile on both compiler targets can convert a string to the type
// each compiler's API expects with one expression, such as RootedFilePath(name).
// They add no behavior: on 7.0 every typed path is the string it names.

// RootedPath is 7.1's rooted, normalized path, a string on 7.0.
//
// @evidence contracts/common.md#principled-implementation A type alias names the representation 7.0 already uses for this value, so it adds no behavior.
// @evidence contracts/common.md#clear-and-simple-design One alias per 7.1 name lets one expression produce each compiler's parameter type.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No validation or method is attached to the 7.0 value.
// @evidence contracts/common.md#meaningful-documentation Native prose names the 7.1 type and the 7.0 representation.
// @evidenceExclude contracts/portability.md#os-neutral-implementation A type alias performs no native operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type alias executes nothing.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type alias coordinates no work.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type alias acquires nothing.
type RootedPath = string

// RootedFilePath is 7.1's rooted file path, a string on 7.0.
//
// @evidence contracts/common.md#principled-implementation A type alias names the representation 7.0 already uses for this value, so it adds no behavior.
// @evidence contracts/common.md#clear-and-simple-design One alias per 7.1 name lets one expression produce each compiler's parameter type.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No validation or method is attached to the 7.0 value.
// @evidence contracts/common.md#meaningful-documentation Native prose names the 7.1 type and the 7.0 representation.
// @evidenceExclude contracts/portability.md#os-neutral-implementation A type alias performs no native operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type alias executes nothing.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type alias coordinates no work.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type alias acquires nothing.
type RootedFilePath = string

// RootedDirectoryPath is 7.1's rooted directory path, a string on 7.0.
//
// @evidence contracts/common.md#principled-implementation A type alias names the representation 7.0 already uses for this value, so it adds no behavior.
// @evidence contracts/common.md#clear-and-simple-design One alias per 7.1 name lets one expression produce each compiler's parameter type.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No validation or method is attached to the 7.0 value.
// @evidence contracts/common.md#meaningful-documentation Native prose names the 7.1 type and the 7.0 representation.
// @evidenceExclude contracts/portability.md#os-neutral-implementation A type alias performs no native operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type alias executes nothing.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type alias coordinates no work.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type alias acquires nothing.
type RootedDirectoryPath = string

// RelativePath is 7.1's relative path, a string on 7.0.
//
// @evidence contracts/common.md#principled-implementation A type alias names the representation 7.0 already uses for this value, so it adds no behavior.
// @evidence contracts/common.md#clear-and-simple-design One alias per 7.1 name lets one expression produce each compiler's parameter type.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No validation or method is attached to the 7.0 value.
// @evidence contracts/common.md#meaningful-documentation Native prose names the 7.1 type and the 7.0 representation.
// @evidenceExclude contracts/portability.md#os-neutral-implementation A type alias performs no native operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type alias executes nothing.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type alias coordinates no work.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type alias acquires nothing.
type RelativePath = string

// FileNameStem is 7.1's file name without its extension, a string on 7.0.
//
// @evidence contracts/common.md#principled-implementation A type alias names the representation 7.0 already uses for this value, so it adds no behavior.
// @evidence contracts/common.md#clear-and-simple-design One alias per 7.1 name lets one expression produce each compiler's parameter type.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No validation or method is attached to the 7.0 value.
// @evidence contracts/common.md#meaningful-documentation Native prose names the 7.1 type and the 7.0 representation.
// @evidenceExclude contracts/portability.md#os-neutral-implementation A type alias performs no native operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type alias executes nothing.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type alias coordinates no work.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type alias acquires nothing.
type FileNameStem = string

// ModuleSpecifier is 7.1's module specifier, a string on 7.0.
//
// @evidence contracts/common.md#principled-implementation A type alias names the representation 7.0 already uses for this value, so it adds no behavior.
// @evidence contracts/common.md#clear-and-simple-design One alias per 7.1 name lets one expression produce each compiler's parameter type.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No validation or method is attached to the 7.0 value.
// @evidence contracts/common.md#meaningful-documentation Native prose names the 7.1 type and the 7.0 representation.
// @evidenceExclude contracts/portability.md#os-neutral-implementation A type alias performs no native operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type alias executes nothing.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type alias coordinates no work.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type alias acquires nothing.
type ModuleSpecifier = string

// PathKey is 7.1's canonical path key, which is 7.0's Path.
//
// @evidence contracts/common.md#principled-implementation A type alias names the representation 7.0 already uses for this value, so it adds no behavior.
// @evidence contracts/common.md#clear-and-simple-design One alias per 7.1 name lets one expression produce each compiler's parameter type.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No validation or method is attached to the 7.0 value.
// @evidence contracts/common.md#meaningful-documentation Native prose names the 7.1 type and the 7.0 representation.
// @evidenceExclude contracts/portability.md#os-neutral-implementation A type alias performs no native operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type alias executes nothing.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type alias coordinates no work.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type alias acquires nothing.
type PathKey = innertspath.Path

// CaseSensitivity is TypeScript 7.1's case policy for path identity. On 7.0 it
// is the useCaseSensitiveFileNames boolean that the 7.0 path functions take, so
// a value passes to either compiler's API unchanged.
//
// @evidence contracts/common.md#principled-implementation A type alias names the representation 7.0 already uses for this value, so it adds no behavior.
// @evidence contracts/common.md#clear-and-simple-design One alias per 7.1 name lets one expression produce each compiler's parameter type.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No validation or method is attached to the 7.0 value.
// @evidence contracts/common.md#meaningful-documentation Native prose names the 7.1 type and the 7.0 representation.
// @evidenceExclude contracts/portability.md#os-neutral-implementation A type alias performs no native operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms A type alias executes nothing.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work A type alias coordinates no work.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources A type alias acquires nothing.
type CaseSensitivity = bool

// The two case policies, matching TypeScript 7.1's constants. CaseInsensitive
// is the zero value on both targets.
const (
  CaseInsensitive CaseSensitivity = false
  CaseSensitive   CaseSensitivity = true
)

// Constructors of TypeScript 7.1's typed paths. 7.1 declares them in its own
// tspath package; here each maps to the 7.0 path function that ttsc's own 7.0
// code used for the same purpose, so code calling them compiles on both.

// ToRootedFilePath resolves fileName against currentDirectory and normalizes
// the result, as TypeScript 7.1's constructor of the same name does.
//
// @evidence contracts/common.md#principled-implementation GetNormalizedAbsolutePath combines a relative name with the directory and normalizes separators and dot segments, the rooting 7.1 performs.
// @evidence contracts/common.md#clear-and-simple-design One upstream call keeps the target difference inside the shim.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No path normalization is reimplemented here.
// @evidence contracts/common.md#meaningful-documentation Native prose states the resolution and normalization.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Resolution manipulates path text only; it reads no filesystem.
// @evidenceExclude contracts/performance.md#efficient-algorithms The compiler owns the normalization pass.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The function coordinates no shared work.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The function retains nothing beyond the returned path.
func ToRootedFilePath(fileName string, currentDirectory RootedDirectoryPath) RootedFilePath {
  return innertspath.GetNormalizedAbsolutePath(fileName, currentDirectory)
}

// ToRootedDirectoryPath resolves directory against currentDirectory and
// normalizes the result, as TypeScript 7.1's constructor of the same name does.
//
// @evidence contracts/common.md#principled-implementation GetNormalizedAbsolutePath combines a relative directory with the base and normalizes it, the rooting 7.1 performs.
// @evidence contracts/common.md#clear-and-simple-design One upstream call keeps the target difference inside the shim.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No path normalization is reimplemented here.
// @evidence contracts/common.md#meaningful-documentation Native prose states the resolution and normalization.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Resolution manipulates path text only; it reads no filesystem.
// @evidenceExclude contracts/performance.md#efficient-algorithms The compiler owns the normalization pass.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The function coordinates no shared work.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The function retains nothing beyond the returned path.
func ToRootedDirectoryPath(directory string, currentDirectory RootedDirectoryPath) RootedDirectoryPath {
  return innertspath.GetNormalizedAbsolutePath(directory, currentDirectory)
}

// TryRootedPathFromAbsolute normalizes an absolute path. The boolean is false,
// and the path empty, when path is not absolute.
//
// @evidence contracts/common.md#principled-implementation PathIsAbsolute gates the input and GetNormalizedAbsolutePath normalizes it with no base, matching 7.1's absolute-only constructor.
// @evidence contracts/common.md#clear-and-simple-design Two upstream calls keep the target difference inside the shim.
// @evidence contracts/common.md#prohibited-implementation-shortcuts A relative path is refused rather than resolved against an assumed directory.
// @evidence contracts/common.md#meaningful-documentation Native prose states the false result.
// @evidenceExclude contracts/portability.md#os-neutral-implementation The check and normalization read path text only.
// @evidenceExclude contracts/performance.md#efficient-algorithms The compiler owns the root check and normalization pass.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The function coordinates no shared work.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The function retains nothing beyond the returned path.
func TryRootedPathFromAbsolute(path string) (RootedPath, bool) {
  if !innertspath.PathIsAbsolute(path) {
    return "", false
  }
  return innertspath.GetNormalizedAbsolutePath(path, ""), true
}

// TryRootedFilePathFromAbsolute is TryRootedPathFromAbsolute for a file path.
//
// @evidence contracts/common.md#principled-implementation Delegates to TryRootedPathFromAbsolute; on 7.0 file and plain rooted paths share one representation.
// @evidence contracts/common.md#clear-and-simple-design One delegation mirrors 7.1's file-intent constructor.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The same absolute-only gate applies.
// @evidence contracts/common.md#meaningful-documentation Native prose names the shared behavior.
// @evidenceExclude contracts/portability.md#os-neutral-implementation The check and normalization read path text only.
// @evidenceExclude contracts/performance.md#efficient-algorithms The delegate owns the work.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The function coordinates no shared work.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The function retains nothing beyond the returned path.
func TryRootedFilePathFromAbsolute(fileName string) (RootedFilePath, bool) {
  return TryRootedPathFromAbsolute(fileName)
}

// RootedFilePathFromAbsolute normalizes a file path that the caller has
// already checked is absolute.
//
// @evidence contracts/common.md#principled-implementation GetNormalizedAbsolutePath with no base normalizes an absolute path, the value 7.1's constructor produces for valid input.
// @evidence contracts/common.md#clear-and-simple-design One upstream call keeps the target difference inside the shim.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No path normalization is reimplemented here.
// @evidence contracts/common.md#meaningful-documentation Native prose states the caller's absolute-path precondition.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Normalization manipulates path text only.
// @evidenceExclude contracts/performance.md#efficient-algorithms The compiler owns the normalization pass.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The function coordinates no shared work.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The function retains nothing beyond the returned path.
func RootedFilePathFromAbsolute(fileName string) RootedFilePath {
  return innertspath.GetNormalizedAbsolutePath(fileName, "")
}

// RootedPathFromAbsolute normalizes a path that the caller has already checked
// is absolute.
//
// @evidence contracts/common.md#principled-implementation GetNormalizedAbsolutePath with no base normalizes an absolute path, the value 7.1's constructor produces for valid input.
// @evidence contracts/common.md#clear-and-simple-design One upstream call keeps the target difference inside the shim.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No path normalization is reimplemented here.
// @evidence contracts/common.md#meaningful-documentation Native prose states the caller's absolute-path precondition.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Normalization manipulates path text only.
// @evidenceExclude contracts/performance.md#efficient-algorithms The compiler owns the normalization pass.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The function coordinates no shared work.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The function retains nothing beyond the returned path.
func RootedPathFromAbsolute(path string) RootedPath {
  return innertspath.GetNormalizedAbsolutePath(path, "")
}

// RootedDirectoryPathFromAbsolute normalizes a directory path that the caller
// has already checked is absolute.
//
// @evidence contracts/common.md#principled-implementation GetNormalizedAbsolutePath with no base normalizes an absolute path, the value 7.1's constructor produces for valid input.
// @evidence contracts/common.md#clear-and-simple-design One upstream call keeps the target difference inside the shim.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No path normalization is reimplemented here.
// @evidence contracts/common.md#meaningful-documentation Native prose states the caller's absolute-path precondition.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Normalization manipulates path text only.
// @evidenceExclude contracts/performance.md#efficient-algorithms The compiler owns the normalization pass.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The function coordinates no shared work.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The function retains nothing beyond the returned path.
func RootedDirectoryPathFromAbsolute(directory string) RootedDirectoryPath {
  return innertspath.GetNormalizedAbsolutePath(directory, "")
}

// RootedPathFromNormalized accepts a path that is already rooted and
// normalized. On 7.0 it is returned unchanged.
//
// @evidence contracts/common.md#principled-implementation 7.0 represents a normalized rooted path as the same string, so the value is returned unchanged.
// @evidence contracts/common.md#clear-and-simple-design An identity conversion mirrors 7.1's validating constructor for valid input.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The path is not altered.
// @evidence contracts/common.md#meaningful-documentation Native prose states the precondition and the identity on 7.0.
// @evidenceExclude contracts/portability.md#os-neutral-implementation The conversion reads its argument only.
// @evidenceExclude contracts/performance.md#efficient-algorithms An identity conversion chooses no algorithm.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The function coordinates no shared work.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The function retains nothing.
func RootedPathFromNormalized(path string) RootedPath { return path }

// RootedDirectoryPathFromNormalized gives directory intent to a path that is
// already rooted and normalized. On 7.0 it is returned unchanged.
//
// @evidence contracts/common.md#principled-implementation 7.0 represents a normalized rooted directory as the same string, so the value is returned unchanged.
// @evidence contracts/common.md#clear-and-simple-design An identity conversion mirrors 7.1's intent conversion.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The path is not altered.
// @evidence contracts/common.md#meaningful-documentation Native prose states the precondition and the identity on 7.0.
// @evidenceExclude contracts/portability.md#os-neutral-implementation The conversion reads its argument only.
// @evidenceExclude contracts/performance.md#efficient-algorithms An identity conversion chooses no algorithm.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The function coordinates no shared work.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The function retains nothing.
func RootedDirectoryPathFromNormalized(directory string) RootedDirectoryPath { return directory }

// RootedDirectoryPathFromPath gives a rooted path directory intent. On 7.0 both
// are the same string.
//
// @evidence contracts/common.md#principled-implementation 7.0 represents file and directory intent identically, so the value is returned unchanged.
// @evidence contracts/common.md#clear-and-simple-design An identity conversion mirrors 7.1's intent conversion.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The path is not altered.
// @evidence contracts/common.md#meaningful-documentation Native prose states the identity on 7.0.
// @evidenceExclude contracts/portability.md#os-neutral-implementation The conversion reads its argument only.
// @evidenceExclude contracts/performance.md#efficient-algorithms An identity conversion chooses no algorithm.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The function coordinates no shared work.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The function retains nothing.
func RootedDirectoryPathFromPath(path RootedPath) RootedDirectoryPath { return path }

package tspath

// Version-neutral path operations.
//
// TypeScript 7.1 makes these path operations methods of its typed paths and
// CaseSensitivity, while TypeScript 7.0 spells the same values as strings and
// booleans that cannot carry methods. Code that must compile on both compiler
// targets calls these functions, which the 7.0 shim declares with identical
// signatures over its own path functions; here each forwards to the 7.1 method.

// Canonicalize applies the case policy to text used as a path identity: an
// insensitive policy lowercases it the way file names compare.
//
// @evidence contracts/common.md#principled-implementation Forwards to CaseSensitivity.Canonicalize, the compiler's own path-identity canonicalization.
// @evidence contracts/common.md#clear-and-simple-design One forwarding call keeps the target difference inside the shim.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No case folding is reimplemented here.
// @evidence contracts/common.md#meaningful-documentation Native prose states the insensitive-policy effect.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Text canonicalization performs no native filesystem, path or process operation; the policy is supplied, not read from the OS.
// @evidenceExclude contracts/performance.md#efficient-algorithms The compiler owns the single pass over the text.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The function coordinates no shared work.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The function retains nothing beyond the returned string.
func Canonicalize(caseSensitivity CaseSensitivity, text string) string {
  return caseSensitivity.Canonicalize(text)
}

// CompareFilePaths orders two rooted, normalized file paths under the case
// policy, returning a negative, zero or positive result.
//
// @evidence contracts/common.md#principled-implementation Forwards to CaseSensitivity.CompareFilePaths, which compares rooted text without combining or reducing components.
// @evidence contracts/common.md#clear-and-simple-design One forwarding call keeps the target difference inside the shim.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No comparison is reimplemented here.
// @evidence contracts/common.md#meaningful-documentation Native prose states the operand requirements and the result sign.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Comparison reads its arguments only; it opens no file and calls no process.
// @evidenceExclude contracts/performance.md#efficient-algorithms The compiler owns the comparison over the path text.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The function coordinates no shared work.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The function retains nothing.
func CompareFilePaths(caseSensitivity CaseSensitivity, a RootedFilePath, b RootedFilePath) int {
  return caseSensitivity.CompareFilePaths(a, b)
}

// ContainsPathWith reports whether child is parent or lies below it under the
// case policy. Both paths must be rooted and normalized.
//
// @evidence contracts/common.md#principled-implementation Forwards to CaseSensitivity.ContainsPath, the compiler's rooted containment test.
// @evidence contracts/common.md#clear-and-simple-design One forwarding call keeps the target difference inside the shim.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No containment test is reimplemented here.
// @evidence contracts/common.md#meaningful-documentation Native prose states the inclusive meaning and operand requirements.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Containment reads its arguments only; it opens no file and calls no process.
// @evidenceExclude contracts/performance.md#efficient-algorithms The compiler owns the prefix comparison.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The function coordinates no shared work.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The function retains nothing.
func ContainsPathWith(caseSensitivity CaseSensitivity, parent RootedDirectoryPath, child RootedPath) bool {
  return caseSensitivity.ContainsPath(parent, child)
}

// RelativePathFromFile returns to relative to the directory of from. The
// boolean is false when the two paths share no root to relate them through.
//
// @evidence contracts/common.md#principled-implementation Forwards to CaseSensitivity.RelativePathFromFile.
// @evidence contracts/common.md#clear-and-simple-design One forwarding call keeps the target difference inside the shim.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No relative-path computation is reimplemented here.
// @evidence contracts/common.md#meaningful-documentation Native prose states the base directory and the false result.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Relativization reads its arguments only; it opens no file and calls no process.
// @evidenceExclude contracts/performance.md#efficient-algorithms The compiler owns the component walk.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The function coordinates no shared work.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The function retains nothing beyond the returned path.
func RelativePathFromFile(caseSensitivity CaseSensitivity, from RootedFilePath, to RootedFilePath) (RelativePath, bool) {
  return caseSensitivity.RelativePathFromFile(from, to)
}

// RelativeModuleSpecifier spells a relative path as a module specifier, adding
// the leading "./" a bare relative path needs.
//
// @evidence contracts/common.md#principled-implementation Forwards to RelativePath.AsModuleSpecifier.
// @evidence contracts/common.md#clear-and-simple-design One forwarding call keeps the target difference inside the shim.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No specifier spelling is reimplemented here.
// @evidence contracts/common.md#meaningful-documentation Native prose states the added "./" prefix.
// @evidenceExclude contracts/portability.md#os-neutral-implementation The conversion reads its argument only.
// @evidenceExclude contracts/performance.md#efficient-algorithms The compiler owns the prefix check.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The function coordinates no shared work.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The function retains nothing beyond the returned specifier.
func RelativeModuleSpecifier(path RelativePath) ModuleSpecifier {
  return path.AsModuleSpecifier()
}

// ResolveFile resolves path against a rooted directory and normalizes the
// result. directory must not be empty.
//
// @evidence contracts/common.md#principled-implementation Forwards to RootedDirectoryPath.ResolveFile, which panics on an empty directory.
// @evidence contracts/common.md#clear-and-simple-design One forwarding call keeps the target difference inside the shim.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No resolution is reimplemented here.
// @evidence contracts/common.md#meaningful-documentation Native prose states the normalization and the empty-directory precondition.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Resolution manipulates path text only; it reads no filesystem.
// @evidenceExclude contracts/performance.md#efficient-algorithms The compiler owns the normalization pass.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The function coordinates no shared work.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The function retains nothing beyond the returned path.
func ResolveFile(directory RootedDirectoryPath, path string) RootedFilePath {
  return directory.ResolveFile(path)
}

// FileBaseName returns the last component of a rooted file path.
//
// @evidence contracts/common.md#principled-implementation Forwards to RootedFilePath.BaseName.
// @evidence contracts/common.md#clear-and-simple-design One forwarding call keeps the target difference inside the shim.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No component split is reimplemented here.
// @evidence contracts/common.md#meaningful-documentation Native prose states which component is returned.
// @evidenceExclude contracts/portability.md#os-neutral-implementation The split reads its argument only.
// @evidenceExclude contracts/performance.md#efficient-algorithms The compiler owns the separator scan.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The function coordinates no shared work.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The function retains nothing beyond the returned name.
func FileBaseName(fileName RootedFilePath) string {
  return fileName.BaseName()
}

// FileDirectory returns the rooted directory that contains a file.
//
// @evidence contracts/common.md#principled-implementation Forwards to RootedFilePath.Directory.
// @evidence contracts/common.md#clear-and-simple-design One forwarding call keeps the target difference inside the shim.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No directory split is reimplemented here.
// @evidence contracts/common.md#meaningful-documentation Native prose states the returned directory.
// @evidenceExclude contracts/portability.md#os-neutral-implementation The split reads its argument only.
// @evidenceExclude contracts/performance.md#efficient-algorithms The compiler owns the separator scan.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The function coordinates no shared work.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The function retains nothing beyond the returned directory.
func FileDirectory(fileName RootedFilePath) RootedDirectoryPath {
  return fileName.Directory()
}

// RelativePathFromDirectoryWith returns path relative to directory under the
// case policy. A path on another root comes back absolute.
//
// @evidence contracts/common.md#principled-implementation Calls Forwards to 7.1's GetRelativePathFromDirectory with the case policy.
// @evidence contracts/common.md#clear-and-simple-design One upstream call keeps the target difference inside the shim.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No relative-path computation is reimplemented here.
// @evidence contracts/common.md#meaningful-documentation Native prose states the result for different roots.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Relativization reads its arguments only; it opens no file and calls no process.
// @evidenceExclude contracts/performance.md#efficient-algorithms The compiler owns the component walk.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The function coordinates no shared work.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The function retains nothing beyond the returned path.
func RelativePathFromDirectoryWith(caseSensitivity CaseSensitivity, directory string, path string) string {
  return GetRelativePathFromDirectory(directory, path, caseSensitivity)
}

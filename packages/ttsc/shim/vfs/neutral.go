package vfs

import innervfs "github.com/microsoft/typescript-go/internal/vfs"

// CaseSensitivityOf reports the case policy the filesystem compares names
// with. TypeScript 7.0 spells it UseCaseSensitiveFileNames and TypeScript 7.1
// spells it CaseSensitivity; code that must compile on both compiler targets
// calls this function, which the 7.1 bridge declares with the same signature.
//
// @evidence contracts/common.md#principled-implementation Returns UseCaseSensitiveFileNames, the boolean that is 7.0's CaseSensitivity.
// @evidence contracts/common.md#clear-and-simple-design One method call keeps the target difference inside the shim.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The policy is the filesystem's own answer, not inferred from the OS name.
// @evidence contracts/common.md#meaningful-documentation Native prose states the two spellings and the shared signature.
// @evidence contracts/portability.md#os-neutral-implementation The filesystem implementation owns how it learns its case policy; this function adds no OS assumption.
// @evidenceExclude contracts/performance.md#efficient-algorithms The filesystem returns its stored policy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The function coordinates no shared work.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The function retains nothing.
func CaseSensitivityOf(fs innervfs.FS) bool {
  return fs.UseCaseSensitiveFileNames()
}

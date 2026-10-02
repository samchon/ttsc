// Package astnav exposes cursor-position traversal helpers from TypeScript-Go.
package astnav

import (
  "github.com/microsoft/typescript-go/internal/ast"
  _ "github.com/microsoft/typescript-go/internal/astnav"
  _ "unsafe"
)

// GetTouchingToken returns the token touching position in sourceFile. When
// position touches no token, it returns the enclosing non-token node instead;
// callers that require a token must check ast.IsTokenKind on the result kind.
//
// @evidence contracts/common.md#principled-implementation Linking the pinned traversal preserves its byte-coordinate and enclosing-node fallback semantics; sourceFile must be a real compiler source tree.
// @evidence contracts/common.md#clear-and-simple-design One direct bridge exposes the existing cursor operation without adding a second AST search or token representation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts go:linkname is the shim's explicit internal-package bridge; it neither replaces the upstream traversal nor guesses token kinds from source text.
// @evidence contracts/common.md#meaningful-documentation Native prose warns about the non-token fallback and the caller's classification responsibility, separated from these acknowledgments.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources GetTouchingToken declares a signature only; the implementation owns acquisition and release of resources.
// @evidenceExclude contracts/performance.md#efficient-algorithms GetTouchingToken declares a signature only; the implementation owns the processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work GetTouchingToken declares a signature only; the implementation owns any shared work.
// @evidenceExclude contracts/portability.md#os-neutral-implementation GetTouchingToken is a signature without a body here; path and platform behavior belongs to the implementation that supplies it.
//
//go:linkname GetTouchingToken github.com/microsoft/typescript-go/internal/astnav.GetTouchingToken
func GetTouchingToken(sourceFile *ast.SourceFile, position int) *ast.Node

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
//
//go:linkname GetTouchingToken github.com/microsoft/typescript-go/internal/astnav.GetTouchingToken
func GetTouchingToken(sourceFile *ast.SourceFile, position int) *ast.Node

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
//go:linkname GetTouchingToken github.com/microsoft/typescript-go/internal/astnav.GetTouchingToken
func GetTouchingToken(sourceFile *ast.SourceFile, position int) *ast.Node

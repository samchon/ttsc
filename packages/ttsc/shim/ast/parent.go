package ast

import innerast "github.com/microsoft/typescript-go/internal/ast"

// SetParentInChildren recursively sets each descendant node's Parent pointer to
// its containing node.
//
// A transform that splices freshly built (synthetic) nodes onto a SourceFile
// must call this before emit: passes that walk parents — e.g. the emit
// resolver's reference marking (MarkLinkedReferencesRecursively) — dereference
// Parent and would hit nil on a synthetic node otherwise.
func SetParentInChildren(node *Node) {
  innerast.SetParentInChildren(node)
}

package ast

import innerast "github.com/microsoft/typescript-go/internal/ast"

// SetParentInChildren recursively sets each descendant node's Parent pointer to
// its containing node.
//
// A transform that splices freshly built (synthetic) nodes onto a SourceFile
// must call this before emit, because the passes that then walk the spliced tree
// dereference Parent and would hit nil on a synthetic node. The printer is the
// example that holds up: getContainingNodeArray reads node.Parent unguarded for
// a parameter, template span, decorator, and heritage clause.
//
// Two earlier examples were dropped rather than the rule. The emit resolver's
// reference marking no longer walks the spliced tree at all in ttsc's plugin
// emit lane, which builds the builtin chain from the parse tree (see
// driver.EmitWithPluginTransformers). The module transform's own Parent reads
// carry upstream //nolint:customlint notes saying they deliberately inspect
// parse-tree parents.
func SetParentInChildren(node *Node) {
  innerast.SetParentInChildren(node)
}

// SetParentInChildrenUnset sets Parent only on nodes that don't already have
// one, recursing through the whole tree. Unlike SetParentInChildren it does NOT
// overwrite the parent of original parse-tree nodes that a transform reused
// inside a rebuilt SourceFile — overwriting those (e.g. an `export namespace`
// kept verbatim while sibling statements were rewritten) makes tsgo's
// runtime-syntax/printer mis-resolve the declaration and drop it from emit.
// Only freshly built (synthetic) nodes need a parent wired, and those start nil.
//
// This is the form ttsc's plugin emit lane calls. How much it currently carries
// is unproven: stubbing the call out leaves the whole driver suite green, which
// measures the suite's coverage of parent-dependent emit rather than the hazard.
// Keep it for the reason above, not on the strength of a failing test.
func SetParentInChildrenUnset(node *Node) {
  node.ForEachChild(func(child *Node) bool {
    if child.Parent == nil {
      child.Parent = node
    }
    SetParentInChildrenUnset(child)
    return false
  })
}

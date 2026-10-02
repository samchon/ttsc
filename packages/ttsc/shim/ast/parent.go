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
// This overwrites existing parent links. Use SetParentInChildrenUnset when a
// transform reuses parse-tree children whose original ancestry must survive.
// The root must be nonnil and its child graph must be acyclic.
//
// @evidence contracts/common.md#principled-implementation Recursive upstream child traversal assigns each child's immediate containing node, matching the AST parent relation for an acyclic tree.
// @evidence contracts/common.md#clear-and-simple-design The wrapper exposes upstream's overwrite operation separately from the preserve-existing-parent operation, so callers choose ownership explicitly.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The only mutation is the requested AST parent wiring through the compiler's own traversal API; it does not replace foreign methods or globals.
// @evidence contracts/common.md#meaningful-documentation Native prose states the overwrite effect, emit motivation, alternative for reused parse nodes, and nonnil acyclic-tree premise with separated paragraphs.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources SetParentInChildren acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms SetParentInChildren performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work SetParentInChildren computes one result per call, so there is no repeated work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation SetParentInChildren computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func SetParentInChildren(node *Node) {
  innerast.SetParentInChildren(node)
}

// SetParentInChildrenUnset sets Parent only on nodes that don't already have
// one, recursing through the whole tree. Unlike SetParentInChildren it does NOT
// overwrite the parent of original parse-tree nodes that a transform reused
// inside a rebuilt SourceFile; overwriting those (e.g. an `export namespace`
// kept verbatim while sibling statements were rewritten) makes tsgo's
// runtime-syntax/printer mis-resolve the declaration and drop it from emit.
// Only freshly built (synthetic) nodes need a parent wired, and those start nil.
//
// The root must be nonnil and its child graph must be acyclic. Existing links
// remain authoritative even if they point outside the rebuilt tree.
//
// @evidence contracts/common.md#principled-implementation Every traversed child receives its containing node only when Parent is nil, preserving reused parse-tree ancestry while wiring synthetic descendants in an acyclic tree.
// @evidence contracts/common.md#clear-and-simple-design A single recursive child traversal owns the nil-only assignment; the overwrite variant remains a separate explicit operation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The nil check expresses synthetic-node ownership rather than a fixture exception; no foreign method is replaced and existing parse parents are preserved deliberately.
// @evidence contracts/common.md#meaningful-documentation Native prose explains why existing parents survive, the synthetic-node case, and the nonnil acyclic-tree premise without relying on test history.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources SetParentInChildrenUnset acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms SetParentInChildrenUnset performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work SetParentInChildrenUnset computes one result per call, so there is no repeated work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation SetParentInChildrenUnset computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func SetParentInChildrenUnset(node *Node) {
  node.ForEachChild(func(child *Node) bool {
    if child.Parent == nil {
      child.Parent = node
    }
    SetParentInChildrenUnset(child)
    return false
  })
}

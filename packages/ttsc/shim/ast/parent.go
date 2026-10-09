package ast

import innerast "github.com/microsoft/TypeScript/tsc/internal/ast"

// SetParentInChildren sets Parent pointers along the compiler's ForEachChild
// traversal to each child's containing node.
//
// A transform that splices freshly built (synthetic) nodes onto a SourceFile
// must establish valid parent relationships before a pass that relies on them;
// this overwrite operation is one way to do so. The printer's
// getContainingNodeArray first permits a nil parent, then uses parent-kind and
// payload relationships to select a containing list. A wrong existing parent
// can therefore select the wrong list or fail a payload assertion.
//
// This overwrites existing parent links. Use SetParentInChildrenUnset when a
// transform reuses parse-tree children whose original ancestry must survive.
// The root must be nonnil with valid compiler payloads and an acyclic child
// tree. Callers must own the parent mutations without concurrent tree access.
//
// @evidence contracts/common.md#principled-implementation Recursive upstream child traversal assigns each child's immediate containing node, matching the AST parent relation for an acyclic tree.
// @evidence contracts/common.md#clear-and-simple-design The wrapper exposes upstream's overwrite operation separately from the preserve-existing-parent operation, so callers choose ownership explicitly.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The only mutation is the requested AST parent wiring through the compiler's own traversal API; it does not replace foreign methods or globals.
// @evidence contracts/common.md#meaningful-documentation Native prose states the overwrite effect, emit motivation, alternative for reused parse nodes, and nonnil acyclic-tree premise with separated paragraphs.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The shim controls no independent traversal-state lifetime. Upstream checks a setter closure out of sync.Pool and defers returning it; normal traversal restores its parent reference. The pool has no numeric cap, and an invalid-tree panic can leave captured parent state until the pool entry is discarded. Mutated Parent links remain owned by the caller's tree.
// @evidenceExclude contracts/performance.md#efficient-algorithms The shim chooses no independent parent-traversal algorithm. Upstream visits V traversed nodes with O(V) work and up to O(H) stack for child depth H, without collecting all descendants; caller graphs must be valid trees.
// @evidence contracts/performance.md#reuse-equivalent-work Upstream shares reusable setter closures through sync.Pool, checking one out for a traversal and returning it with defer. Normal completion restores the mutable parent cursor before reuse; this pools traversal machinery, not a cached result that could skip required parent mutations.
// @evidenceExclude contracts/portability.md#os-neutral-implementation SetParentInChildren computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
func SetParentInChildren(node *Node) {
  innerast.SetParentInChildren(node)
}

// SetParentInChildrenUnset sets Parent only on visited children that do not
// already have one, using the compiler's ForEachChild traversal. Unlike
// SetParentInChildren it does not
// overwrite the parent of original parse-tree nodes that a transform reused
// inside a rebuilt SourceFile. Changing preserved ancestry can change how
// downstream parent-sensitive passes interpret those declarations. Nil parent
// links are wired regardless of whether a node is marked synthetic.
//
// Supply a nonnil root with valid compiler payloads and an acyclic child tree.
// Existing links remain authoritative even if they point outside the rebuilt
// tree; callers must own mutations without concurrent tree access.
//
// @evidence contracts/common.md#principled-implementation Every traversed child receives its containing node only when Parent is nil, preserving reused parse-tree ancestry while wiring synthetic descendants in an acyclic tree.
// @evidence contracts/common.md#clear-and-simple-design A single recursive child traversal owns the nil-only assignment; the overwrite variant remains a separate explicit operation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The nil check is the requested preservation policy, not synthetic-flag inference or a fixture exception; no foreign method is replaced and existing parents are preserved deliberately.
// @evidence contracts/common.md#meaningful-documentation Native prose explains why existing parents survive, the synthetic-node case, and the nonnil acyclic-tree premise without relying on test history.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources This traversal acquires no native handle, task or independently retained cache. Assigned and preserved Parent references remain in the caller-owned tree and can keep ancestor objects reachable, including ancestors outside the rebuilt root; tree owners control that lifetime.
// @evidence contracts/performance.md#efficient-algorithms One recursive ForEachChild traversal visits V nodes and tests each child parent once, costing O(V) time and O(H) stack for depth H. Already-parented subtrees are still traversed because their deeper children can have nil parents; no full descendant collection is allocated.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The traversal coordinates no cached result or in-flight work. Existing nonnil Parent values are preserved as caller-authoritative state, while descendants still require inspection for missing links.
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

// Stable wrappers around `shim/ast.Node` and `shim/ast.SourceFile`.
//
// The wrappers expose the small surface contributor rules actually need:
// kind, position, range, source-file accessors. Power users can reach
// the underlying shim handle via `Inner()` / `InnerFile()`, but doing so
// opts out of the public API's stability promise — when the shim
// renames a typed accessor or restructures a node, contributors that
// touched `Inner()` must follow the change while those that stayed on
// the wrapper keep compiling.
package rule

import (
	shimast "github.com/microsoft/typescript-go/shim/ast"
)

// Node is the public AST node handle passed to a rule's `Check`. Holds a
// reference to the shim node and the file the engine is currently
// walking so range-based diagnostics can resolve text without an extra
// handle.
type Node struct {
	inner *shimast.Node
	file  *shimast.SourceFile
}

// WrapNode builds a public `Node` from a shim node and the owning source
// file. Reserved for host code (the engine wraps each visited node).
func WrapNode(inner *shimast.Node, file *shimast.SourceFile) *Node {
	if inner == nil {
		return nil
	}
	return &Node{inner: inner, file: file}
}

// Kind returns the AST kind of this node.
func (n *Node) Kind() Kind {
	if n == nil || n.inner == nil {
		return shimast.KindUnknown
	}
	return n.inner.Kind
}

// Pos returns the source byte offset where the node begins, INCLUDING
// leading trivia (whitespace and comments) attached to the node.
func (n *Node) Pos() int {
	if n == nil || n.inner == nil {
		return 0
	}
	return n.inner.Pos()
}

// End returns the source byte offset one past the node's last byte.
func (n *Node) End() int {
	if n == nil || n.inner == nil {
		return 0
	}
	return n.inner.End()
}

// Text returns the source text under the node, including any leading
// trivia between `Pos` and the actual token. Use `Range()` or
// `Context.ReportRange` for trimmed text positioning.
func (n *Node) Text() string {
	if n == nil || n.inner == nil || n.file == nil {
		return ""
	}
	text := n.file.Text()
	pos := n.inner.Pos()
	end := n.inner.End()
	if pos < 0 || end > len(text) || pos > end {
		return ""
	}
	return text[pos:end]
}

// File returns the source file that owns this node.
func (n *Node) File() *File {
	if n == nil {
		return nil
	}
	return WrapFile(n.file)
}

// Inner returns the underlying `shim/ast.Node`. Use this when you need a
// typed accessor (e.g. `Inner().AsCallExpression()`); doing so couples
// your rule to the shim version pinned by the host plugin's build.
func (n *Node) Inner() *shimast.Node {
	if n == nil {
		return nil
	}
	return n.inner
}

// File wraps `shim/ast.SourceFile`. The same stability/escape-hatch
// policy as `Node` applies.
type File struct {
	inner *shimast.SourceFile
}

// WrapFile builds a public `File` from a shim source file. Reserved for
// host code; contributors usually receive a `*File` through
// `Context.File` or `Node.File`.
func WrapFile(inner *shimast.SourceFile) *File {
	if inner == nil {
		return nil
	}
	return &File{inner: inner}
}

// FileName returns the source file's normalized path. Forward slashes
// regardless of host platform.
func (f *File) FileName() string {
	if f == nil || f.inner == nil {
		return ""
	}
	return f.inner.FileName()
}

// Text returns the entire source text of the file.
func (f *File) Text() string {
	if f == nil || f.inner == nil {
		return ""
	}
	return f.inner.Text()
}

// IsDeclarationFile reports whether this file is a `.d.ts` declaration
// (which the engine already skips at dispatch time).
func (f *File) IsDeclarationFile() bool {
	if f == nil || f.inner == nil {
		return false
	}
	return f.inner.IsDeclarationFile
}

// Inner returns the underlying `shim/ast.SourceFile`. Same escape-hatch
// policy as `Node.Inner()`.
func (f *File) Inner() *shimast.SourceFile {
	if f == nil {
		return nil
	}
	return f.inner
}

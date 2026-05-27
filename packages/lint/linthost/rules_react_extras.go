package linthost

import (
	shimast "github.com/microsoft/typescript-go/shim/ast"
)

// reactJSXNoUndef rejects JSX elements whose tag is a bare uppercase
// identifier that has no value-level declaration anywhere in the source
// file. Lowercase tags are intrinsic HTML; qualified `<Foo.Bar>` forms
// are skipped because resolving the outer name requires module-level
// information that belongs to the type checker.
//
// Reference: https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/jsx-no-undef.md
type reactJSXNoUndef struct{}

func (reactJSXNoUndef) Name() string { return "react/jsx-no-undef" }
func (reactJSXNoUndef) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindJsxElement, shimast.KindJsxSelfClosingElement}
}

func (reactJSXNoUndef) Check(ctx *Context, node *shimast.Node) {
	info := reactJSXElementFromNode(node)
	if info.opening == nil {
		return
	}
	tagNode := reactExtrasOpeningTagNameNode(info.opening)
	name := identifierText(tagNode)
	if name == "" {
		return
	}
	first := name[0]
	if first < 'A' || first > 'Z' {
		return
	}
	if reactExtrasFileHasDeclaration(ctx.File.AsNode(), name) {
		return
	}
	ctx.Report(info.opening, "'"+name+"' is not defined.")
}

// reactDisplayName rejects `React.memo(...)` / `forwardRef(...)`
// wrappers whose immediate argument is an anonymous function or arrow
// expression and that are not assigned to a named host (variable,
// object property, class property, or `export default`).
//
// Reference: https://github.com/jsx-eslint/eslint-plugin-react/blob/master/docs/rules/display-name.md
type reactDisplayName struct{}

func (reactDisplayName) Name() string                { return "react/display-name" }
func (reactDisplayName) Visits() []shimast.Kind      { return []shimast.Kind{shimast.KindCallExpression} }

func (reactDisplayName) Check(ctx *Context, node *shimast.Node) {
	call := node.AsCallExpression()
	if call == nil || call.Arguments == nil || len(call.Arguments.Nodes) == 0 {
		return
	}
	if !reactExtrasIsDisplayNameWrapperCall(call) {
		return
	}
	arg := stripParens(call.Arguments.Nodes[0])
	if arg == nil {
		return
	}
	switch arg.Kind {
	case shimast.KindArrowFunction:
		// arrow functions never carry an own name
	case shimast.KindFunctionExpression:
		fn := arg.AsFunctionExpression()
		if fn != nil && identifierText(fn.Name()) != "" {
			return
		}
	default:
		return
	}
	if reactExtrasCallHasNamedHost(node) {
		return
	}
	ctx.Report(node, "Component definition is missing display name.")
}

// reactExtrasOpeningTagNameNode returns the TagName node from either a
// JsxOpeningElement (the node on a paired JsxElement) or a
// JsxSelfClosingElement directly.
func reactExtrasOpeningTagNameNode(opening *shimast.Node) *shimast.Node {
	if opening == nil {
		return nil
	}
	switch opening.Kind {
	case shimast.KindJsxOpeningElement:
		el := opening.AsJsxOpeningElement()
		if el == nil {
			return nil
		}
		return el.TagName
	case shimast.KindJsxSelfClosingElement:
		el := opening.AsJsxSelfClosingElement()
		if el == nil {
			return nil
		}
		return el.TagName
	}
	return nil
}

// reactExtrasFileHasDeclaration reports whether `name` is bound anywhere
// in the source file by an import, function declaration, class
// declaration, variable declaration, parameter, or enum declaration. The
// walk is whole-file because JSX names resolve lexically in the
// surrounding closure, not against a single statement list.
func reactExtrasFileHasDeclaration(root *shimast.Node, name string) bool {
	if root == nil || name == "" {
		return false
	}
	found := false
	walkDescendants(root, func(child *shimast.Node) {
		if found || child == nil {
			return
		}
		switch child.Kind {
		case shimast.KindFunctionDeclaration:
			if fn := child.AsFunctionDeclaration(); fn != nil && identifierText(fn.Name()) == name {
				found = true
			}
		case shimast.KindClassDeclaration:
			if cl := child.AsClassDeclaration(); cl != nil && identifierText(cl.Name()) == name {
				found = true
			}
		case shimast.KindVariableDeclaration:
			if v := child.AsVariableDeclaration(); v != nil && identifierText(v.Name()) == name {
				found = true
			}
		case shimast.KindParameter:
			if p := child.AsParameterDeclaration(); p != nil && identifierText(p.Name()) == name {
				found = true
			}
		case shimast.KindEnumDeclaration:
			if e := child.AsEnumDeclaration(); e != nil && identifierText(e.Name()) == name {
				found = true
			}
		case shimast.KindImportClause:
			clause := child.AsImportClause()
			if clause == nil {
				return
			}
			if identifierText(clause.Name()) == name {
				found = true
				return
			}
			if clause.NamedBindings != nil {
				switch clause.NamedBindings.Kind {
				case shimast.KindNamespaceImport:
					ns := clause.NamedBindings.AsNamespaceImport()
					if ns != nil && identifierText(ns.Name()) == name {
						found = true
					}
				case shimast.KindNamedImports:
					named := clause.NamedBindings.AsNamedImports()
					if named == nil || named.Elements == nil {
						return
					}
					for _, spec := range named.Elements.Nodes {
						s := spec.AsImportSpecifier()
						if s == nil {
							continue
						}
						if identifierText(s.Name()) == name {
							found = true
							return
						}
					}
				}
			}
		}
	})
	return found
}

// reactExtrasIsDisplayNameWrapperCall reports whether the call
// expression is `React.memo`, `React.forwardRef`, or a bare `memo` /
// `forwardRef` invocation — the wrappers whose inner anonymous function
// loses its name unless `displayName` is set explicitly.
func reactExtrasIsDisplayNameWrapperCall(call *shimast.CallExpression) bool {
	if call == nil {
		return false
	}
	name := callCalleeName(call)
	if name == "memo" || name == "forwardRef" {
		return true
	}
	_, prop, ok := reactPropertyAccessParts(call.Expression)
	return ok && (prop == "memo" || prop == "forwardRef")
}

// reactExtrasCallHasNamedHost reports whether the call is initializing
// a named binding that supplies the component's display name — a
// variable declaration `const Foo = memo(...)`, an object property
// `{ Foo: memo(...) }`, a class property `Foo = memo(...)`, or
// `export default memo(...)`. In those shapes the wrapper still
// produces a debuggable component, so the rule abstains.
func reactExtrasCallHasNamedHost(node *shimast.Node) bool {
	parent := node.Parent
	for parent != nil && parent.Kind == shimast.KindParenthesizedExpression {
		parent = parent.Parent
	}
	if parent == nil {
		return false
	}
	switch parent.Kind {
	case shimast.KindVariableDeclaration:
		v := parent.AsVariableDeclaration()
		if v != nil && identifierText(v.Name()) != "" {
			return true
		}
	case shimast.KindPropertyAssignment:
		return true
	case shimast.KindPropertyDeclaration:
		return true
	case shimast.KindExportAssignment:
		return true
	}
	return false
}

func init() {
	Register(reactJSXNoUndef{})
	Register(reactDisplayName{})
}

// noImportAssign: writes to a binding introduced by an `import`
// declaration. Imported bindings are read-only at runtime; mutating
// them either throws under strict mode or silently desynchronises the
// module's view of its own exports.
//
// Conservative scope tracking: collect the local names introduced by
// every `import` declaration in the file (default specifier, named
// specifier, namespace alias), then walk descendants once and flag
// `name = …` / `name op= …` / `++name` / `name--` assignments whose
// left-hand side is one of those names. Namespace imports are also
// flagged on `ns.foo = …` / `++ns.foo` because the namespace object
// is itself frozen — mutating any property throws in strict mode.
//
// Like `no-param-reassign`, this is an AST-only baseline: a later
// `const name = …` inside an inner scope that shadows an imported
// name will produce a false positive. Proper resolution needs the
// real binder, which the AST-only baseline avoids.
// https://eslint.org/docs/latest/rules/no-import-assign
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type noImportAssign struct{}

func (noImportAssign) Name() string           { return "no-import-assign" }
func (noImportAssign) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindSourceFile} }
func (noImportAssign) Check(ctx *Context, node *shimast.Node) {
	if node == nil {
		return
	}
	imported := map[string]bool{}
	namespaces := map[string]bool{}
	collectImportedBindings(node, imported, namespaces)
	if len(imported) == 0 {
		return
	}
	walkDescendants(node, func(n *shimast.Node) {
		switch n.Kind {
		case shimast.KindBinaryExpression:
			expr := n.AsBinaryExpression()
			if expr == nil || expr.OperatorToken == nil || !isAssignmentOperator(expr.OperatorToken.Kind) {
				return
			}
			reportImportTarget(ctx, expr.Left, imported, namespaces)
		case shimast.KindPrefixUnaryExpression:
			pre := n.AsPrefixUnaryExpression()
			if pre == nil || (pre.Operator != shimast.KindPlusPlusToken && pre.Operator != shimast.KindMinusMinusToken) {
				return
			}
			reportImportTarget(ctx, pre.Operand, imported, namespaces)
		case shimast.KindPostfixUnaryExpression:
			post := n.AsPostfixUnaryExpression()
			if post == nil || (post.Operator != shimast.KindPlusPlusToken && post.Operator != shimast.KindMinusMinusToken) {
				return
			}
			reportImportTarget(ctx, post.Operand, imported, namespaces)
		}
	})
}

// collectImportedBindings walks every `import` declaration in `file` and
// records the local names introduced. Namespace bindings (`* as ns`) are
// additionally remembered so callers can flag property mutations like
// `ns.foo = …`.
func collectImportedBindings(file *shimast.Node, imported, namespaces map[string]bool) {
	walkDescendants(file, func(n *shimast.Node) {
		if n == nil || n.Kind != shimast.KindImportDeclaration {
			return
		}
		decl := n.AsImportDeclaration()
		if decl == nil || decl.ImportClause == nil {
			return
		}
		clause := decl.ImportClause.AsImportClause()
		if clause == nil {
			return
		}
		// `import Default from "x"` — default specifier.
		if name := identifierText(clause.Name()); name != "" {
			imported[name] = true
		}
		if clause.NamedBindings == nil {
			return
		}
		switch clause.NamedBindings.Kind {
		case shimast.KindNamedImports:
			named := clause.NamedBindings.AsNamedImports()
			if named == nil || named.Elements == nil {
				return
			}
			for _, specNode := range named.Elements.Nodes {
				spec := specNode.AsImportSpecifier()
				if spec == nil {
					continue
				}
				if name := identifierText(spec.Name()); name != "" {
					imported[name] = true
				}
			}
		case shimast.KindNamespaceImport:
			ns := clause.NamedBindings.AsNamespaceImport()
			if ns == nil {
				return
			}
			if name := identifierText(ns.Name()); name != "" {
				imported[name] = true
				namespaces[name] = true
			}
		}
	})
}

// reportImportTarget flags `target` when it writes to an imported name.
// A bare identifier matching an imported binding is always flagged; a
// `ns.<key>` property access is flagged when `ns` is a namespace import.
func reportImportTarget(ctx *Context, target *shimast.Node, imported, namespaces map[string]bool) {
	stripped := stripParens(target)
	if stripped == nil {
		return
	}
	if name := identifierText(stripped); name != "" {
		if imported[name] {
			ctx.Report(target, "'"+name+"' is read-only.")
		}
		return
	}
	if stripped.Kind == shimast.KindPropertyAccessExpression {
		access := stripped.AsPropertyAccessExpression()
		if access == nil || access.Expression == nil {
			return
		}
		if ns := identifierText(stripParens(access.Expression)); ns != "" && namespaces[ns] {
			ctx.Report(target, "The members of '"+ns+"' are read-only.")
		}
	}
}

func init() {
	Register(noImportAssign{})
}

// unicorn/no-accessor-recursion: a `get value()` that reads
// `this.value` triggers itself — the getter is the only thing that
// resolves `this.value`, so the call recurses until the stack runs
// out. The same holds for setters, computed and string-keyed names,
// and class / object-literal accessors. The rule pins every read of
// `this.<X>` inside the `<X>` accessor as a recursion bug.
//
// AST-only: visit both `KindGetAccessor` and `KindSetAccessor`. Take
// the accessor's own name and walk its body, reporting every
// `KindPropertyAccessExpression(KindThisKeyword, <name>)` that
// matches. The walk does NOT descend into nested non-arrow function
// bodies (`FunctionDeclaration`, `FunctionExpression`,
// `MethodDeclaration`, `GetAccessor`, `SetAccessor`,
// `Constructor`), because those rebind `this`. Arrow functions
// preserve the outer `this` and are walked through.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-accessor-recursion.md
package linthost

import (
	"fmt"

	shimast "github.com/microsoft/typescript-go/shim/ast"
)

type unicornNoAccessorRecursion struct{}

func (unicornNoAccessorRecursion) Name() string { return "unicorn/no-accessor-recursion" }
func (unicornNoAccessorRecursion) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindGetAccessor, shimast.KindSetAccessor}
}
func (unicornNoAccessorRecursion) Check(ctx *Context, node *shimast.Node) {
	name := unicornAccessorRecursionName(node)
	if name == "" {
		return
	}
	body := node.Body()
	if body == nil {
		return
	}
	unicornAccessorRecursionWalkRespectingThisBoundary(body, func(child *shimast.Node) {
		if child == nil || child.Kind != shimast.KindPropertyAccessExpression {
			return
		}
		access := child.AsPropertyAccessExpression()
		if access == nil || access.Expression == nil {
			return
		}
		if access.Expression.Kind != shimast.KindThisKeyword {
			return
		}
		if identifierText(access.Name()) != name {
			return
		}
		ctx.Report(child, fmt.Sprintf("Reading `this.%s` inside the `%s` accessor recurses forever.", name, name))
	})
}

// unicornAccessorRecursionWalkRespectingThisBoundary walks `node` and
// its descendants depth-first, but does not descend into bodies that
// rebind `this`. Arrow functions are walked through because they
// capture the outer `this`.
func unicornAccessorRecursionWalkRespectingThisBoundary(node *shimast.Node, visit func(*shimast.Node)) {
	if node == nil {
		return
	}
	visit(node)
	node.ForEachChild(func(child *shimast.Node) bool {
		if child == nil {
			return false
		}
		switch child.Kind {
		case shimast.KindFunctionDeclaration,
			shimast.KindFunctionExpression,
			shimast.KindMethodDeclaration,
			shimast.KindGetAccessor,
			shimast.KindSetAccessor,
			shimast.KindConstructor:
			return false
		}
		unicornAccessorRecursionWalkRespectingThisBoundary(child, visit)
		return false
	})
}

// unicornAccessorRecursionName returns the property name of a
// get/set accessor declaration. Only bare Identifier and StringLiteral
// names are supported because computed names cannot be matched against
// the `this.<X>` shape statically.
func unicornAccessorRecursionName(node *shimast.Node) string {
	var name *shimast.Node
	switch node.Kind {
	case shimast.KindGetAccessor:
		if g := node.AsGetAccessorDeclaration(); g != nil {
			name = g.Name()
		}
	case shimast.KindSetAccessor:
		if s := node.AsSetAccessorDeclaration(); s != nil {
			name = s.Name()
		}
	}
	if name == nil {
		return ""
	}
	switch name.Kind {
	case shimast.KindIdentifier:
		return identifierText(name)
	case shimast.KindStringLiteral:
		return stringLiteralText(name)
	}
	return ""
}

func init() {
	Register(unicornNoAccessorRecursion{})
}

// idLength reports declaration names shorter than the default minimum
// of two characters. Single-letter bindings (`a`, `x`, `t`) are
// notoriously hard to grep, fold poorly into call-site documentation,
// and frequently collide with the convention of using single letters
// only for true free variables.
// https://eslint.org/docs/latest/rules/id-length
//
// Conservative baseline: only the four declaration kinds the ESLint
// rule documents as in-scope are inspected — variable, function,
// class, and parameter declarations. Each name is read through the
// shared `identifierText` helper so destructuring patterns and
// computed property names contribute zero findings.
package linthost

import (
	shimast "github.com/microsoft/typescript-go/shim/ast"
)

// idLengthMinimum is the default minimum identifier length. ESLint
// uses 2; mirroring it keeps the rule's default behavior aligned with
// upstream and lets the existing fixture annotations remain stable.
const idLengthMinimum = 2

type idLength struct{}

func (idLength) Name() string { return "id-length" }
func (idLength) Visits() []shimast.Kind {
	return []shimast.Kind{
		shimast.KindVariableDeclaration,
		shimast.KindParameter,
		shimast.KindFunctionDeclaration,
		shimast.KindClassDeclaration,
	}
}
func (idLength) Check(ctx *Context, node *shimast.Node) {
	var nameNode *shimast.Node
	switch node.Kind {
	case shimast.KindVariableDeclaration:
		decl := node.AsVariableDeclaration()
		if decl == nil {
			return
		}
		nameNode = decl.Name()
	case shimast.KindParameter:
		decl := node.AsParameterDeclaration()
		if decl == nil {
			return
		}
		nameNode = decl.Name()
	case shimast.KindFunctionDeclaration:
		decl := node.AsFunctionDeclaration()
		if decl == nil {
			return
		}
		nameNode = decl.Name()
	case shimast.KindClassDeclaration:
		decl := node.AsClassDeclaration()
		if decl == nil {
			return
		}
		nameNode = decl.Name()
	}
	name := identifierText(nameNode)
	if name == "" {
		return
	}
	if len([]rune(name)) >= idLengthMinimum {
		return
	}
	ctx.Report(nameNode, "Identifier name '"+name+"' is too short (< "+itoa(idLengthMinimum)+").")
}

// itoa renders a small positive int without pulling in strconv at the
// call site. Inlining keeps the rule file self-contained alongside its
// sibling style rules.
func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	if n < 0 {
		return "-" + itoa(-n)
	}
	buf := [20]byte{}
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	return string(buf[i:])
}

func init() {
	Register(idLength{})
}

// sortKeys reports object literal property keys that are not in
// alphabetical order. One finding is emitted per offending key; the
// previous key in the same sort group is the comparison baseline.
//
// A spread element (`...other`) and a computed dynamic property name
// (`[expr]: value`) both reset the sort baseline because the rule cannot
// reason about their position relative to surrounding static keys
// without runtime knowledge. After such a divider, sorting restarts
// from the next static property. This mirrors ESLint's behavior.
//
// Property kinds considered: PropertyAssignment, ShorthandPropertyAssignment,
// MethodDeclaration, GetAccessor, SetAccessor. Numeric and string-literal
// keys participate using their literal text as the sort key. Computed
// names whose payload is a literal (e.g. `["a"]`) also participate.
//
// https://eslint.org/docs/latest/rules/sort-keys
package linthost

import (
	shimast "github.com/microsoft/typescript-go/shim/ast"
)

type sortKeys struct{}

func (sortKeys) Name() string           { return "sort-keys" }
func (sortKeys) Visits() []shimast.Kind { return []shimast.Kind{shimast.KindObjectLiteralExpression} }
func (sortKeys) Check(ctx *Context, node *shimast.Node) {
	obj := node.AsObjectLiteralExpression()
	if obj == nil || obj.Properties == nil {
		return
	}
	previous := ""
	hasPrevious := false
	for _, prop := range obj.Properties.Nodes {
		if prop == nil {
			continue
		}
		// A spread divider resets the sort baseline; keys after the
		// spread restart their own ordered group.
		if prop.Kind == shimast.KindSpreadAssignment {
			previous = ""
			hasPrevious = false
			continue
		}
		key := sortKeysName(prop)
		if key == "" {
			// Dynamic computed key (`[expr]`) — cannot compare; reset
			// the baseline so the next static key starts a fresh group.
			previous = ""
			hasPrevious = false
			continue
		}
		if hasPrevious && key < previous {
			ctx.Report(prop, "Expected object keys to be in ascending order. '"+key+"' should be before '"+previous+"'.")
		}
		previous = key
		hasPrevious = true
	}
}

// sortKeysName returns the comparable name for a property in an object
// literal. Identifier, numeric/string literal, and a literal payload
// inside a ComputedPropertyName all yield a usable key. Other shapes
// (dynamic computed names) return "" so the caller resets the sort
// baseline.
func sortKeysName(prop *shimast.Node) string {
	if prop == nil {
		return ""
	}
	var name *shimast.Node
	switch prop.Kind {
	case shimast.KindPropertyAssignment:
		if a := prop.AsPropertyAssignment(); a != nil {
			name = a.Name()
		}
	case shimast.KindShorthandPropertyAssignment:
		if a := prop.AsShorthandPropertyAssignment(); a != nil {
			name = a.Name()
		}
	case shimast.KindMethodDeclaration:
		if a := prop.AsMethodDeclaration(); a != nil {
			name = a.Name()
		}
	case shimast.KindGetAccessor:
		if a := prop.AsGetAccessorDeclaration(); a != nil {
			name = a.Name()
		}
	case shimast.KindSetAccessor:
		if a := prop.AsSetAccessorDeclaration(); a != nil {
			name = a.Name()
		}
	default:
		return ""
	}
	return propertyNameText(name)
}

// propertyNameText extracts a comparable string from a property-name
// node. Identifier and literal forms yield their text; a computed name
// that wraps a literal payload (e.g. `["a"]`) is unwrapped one level.
// Dynamic computed expressions return "" so the caller treats the
// property as a sort-baseline reset.
func propertyNameText(name *shimast.Node) string {
	if name == nil {
		return ""
	}
	switch name.Kind {
	case shimast.KindIdentifier:
		return identifierText(name)
	case shimast.KindStringLiteral, shimast.KindNoSubstitutionTemplateLiteral:
		return stringLiteralText(name)
	case shimast.KindNumericLiteral, shimast.KindBigIntLiteral:
		return numericLiteralText(name)
	case shimast.KindComputedPropertyName:
		// Only static literal payloads are comparable; dynamic
		// expressions yield "" so the caller resets the sort baseline.
		computed := name.AsComputedPropertyName()
		if computed == nil || computed.Expression == nil {
			return ""
		}
		inner := computed.Expression
		switch inner.Kind {
		case shimast.KindStringLiteral, shimast.KindNoSubstitutionTemplateLiteral:
			return stringLiteralText(inner)
		case shimast.KindNumericLiteral, shimast.KindBigIntLiteral:
			return numericLiteralText(inner)
		}
	}
	return ""
}

func init() {
	Register(sortKeys{})
}

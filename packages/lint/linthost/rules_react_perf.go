package linthost

import (
	"encoding/json"
	"path/filepath"
	"strings"

	shimast "github.com/microsoft/typescript-go/shim/ast"
	shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

type reactPerfMatcher func(*shimast.Node) bool

type reactPerfRule struct {
	name    string
	message string
	matcher reactPerfMatcher
}

func (r reactPerfRule) Name() string { return r.name }
func (r reactPerfRule) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindJsxAttribute}
}
func (r reactPerfRule) Check(ctx *Context, node *shimast.Node) {
	if !reactPerfIsTSXFile(ctx) {
		return
	}
	attr := node.AsJsxAttribute()
	if attr == nil || attr.Initializer == nil {
		return
	}
	attrName := shimast.NodeText(attr.Name())
	if reactPerfNativeAllowed(ctx, node, attrName) {
		return
	}
	expr := reactPerfAttributeExpression(attr.Initializer)
	if expr == nil {
		return
	}
	if matched := reactPerfFindNewValue(expr, r.matcher); matched != nil {
		ctx.Report(matched, r.message)
	}
}

type reactPerfRuleOptions struct {
	NativeAllowList json.RawMessage `json:"nativeAllowList"`
}

type reactPerfNativeAllowList struct {
	all   bool
	names map[string]struct{}
}

func reactPerfIsTSXFile(ctx *Context) bool {
	if ctx == nil || ctx.File == nil {
		return false
	}
	return strings.EqualFold(filepath.Ext(ctx.File.FileName()), ".tsx")
}

func reactPerfAttributeExpression(initializer *shimast.Node) *shimast.Node {
	if initializer == nil {
		return nil
	}
	if initializer.Kind == shimast.KindJsxExpression {
		expr := initializer.AsJsxExpression()
		if expr == nil {
			return nil
		}
		return expr.Expression
	}
	return initializer
}

func reactPerfNativeAllowed(ctx *Context, attrNode *shimast.Node, attrName string) bool {
	if !reactPerfIsIntrinsicAttribute(attrNode) {
		return false
	}
	allow := reactPerfLoadNativeAllowList(ctx)
	if allow.all {
		return true
	}
	if attrName == "" || len(allow.names) == 0 {
		return false
	}
	_, ok := allow.names[attrName]
	return ok
}

func reactPerfLoadNativeAllowList(ctx *Context) reactPerfNativeAllowList {
	var raw reactPerfRuleOptions
	_ = ctx.DecodeOptions(&raw)
	if len(raw.NativeAllowList) == 0 {
		return reactPerfNativeAllowList{}
	}

	var mode string
	if err := json.Unmarshal(raw.NativeAllowList, &mode); err == nil {
		if mode == "all" {
			return reactPerfNativeAllowList{all: true}
		}
		return reactPerfNativeAllowList{}
	}

	var names []string
	if err := json.Unmarshal(raw.NativeAllowList, &names); err != nil {
		return reactPerfNativeAllowList{}
	}
	out := reactPerfNativeAllowList{names: make(map[string]struct{}, len(names))}
	for _, name := range names {
		if name != "" {
			out.names[name] = struct{}{}
		}
	}
	return out
}

func reactPerfIsIntrinsicAttribute(attrNode *shimast.Node) bool {
	if attrNode == nil {
		return false
	}
	parent := attrNode.Parent
	if parent == nil || parent.Kind != shimast.KindJsxAttributes {
		return false
	}
	owner := parent.Parent
	if owner == nil {
		return false
	}

	var tag *shimast.Node
	switch owner.Kind {
	case shimast.KindJsxOpeningElement:
		opening := owner.AsJsxOpeningElement()
		if opening != nil {
			tag = opening.TagName
		}
	case shimast.KindJsxSelfClosingElement:
		selfClosing := owner.AsJsxSelfClosingElement()
		if selfClosing != nil {
			tag = selfClosing.TagName
		}
	}
	if tag == nil || tag.Kind != shimast.KindIdentifier {
		return false
	}
	return shimscanner.IsIntrinsicJsxName(identifierText(tag))
}

func reactPerfFindNewValue(node *shimast.Node, matcher reactPerfMatcher) *shimast.Node {
	node = reactPerfUnwrapExpression(node)
	if node == nil {
		return nil
	}
	if matcher(node) {
		return node
	}

	switch node.Kind {
	case shimast.KindBinaryExpression:
		binary := node.AsBinaryExpression()
		if binary == nil || binary.OperatorToken == nil {
			return nil
		}
		switch binary.OperatorToken.Kind {
		case shimast.KindBarBarToken, shimast.KindQuestionQuestionToken:
			if matched := reactPerfFindNewValue(binary.Left, matcher); matched != nil {
				return matched
			}
			return reactPerfFindNewValue(binary.Right, matcher)
		}
	case shimast.KindConditionalExpression:
		cond := node.AsConditionalExpression()
		if cond == nil {
			return nil
		}
		if matched := reactPerfFindNewValue(cond.WhenTrue, matcher); matched != nil {
			return matched
		}
		return reactPerfFindNewValue(cond.WhenFalse, matcher)
	}
	return nil
}

func reactPerfUnwrapExpression(node *shimast.Node) *shimast.Node {
	for {
		node = stripParens(node)
		if node == nil {
			return nil
		}
		switch node.Kind {
		case shimast.KindAsExpression:
			expr := node.AsAsExpression()
			if expr == nil {
				return node
			}
			node = expr.Expression
		case shimast.KindSatisfiesExpression:
			expr := node.AsSatisfiesExpression()
			if expr == nil {
				return node
			}
			node = expr.Expression
		case shimast.KindNonNullExpression:
			expr := node.AsNonNullExpression()
			if expr == nil {
				return node
			}
			node = expr.Expression
		case shimast.KindTypeAssertionExpression:
			expr := node.AsTypeAssertion()
			if expr == nil {
				return node
			}
			node = expr.Expression
		default:
			return node
		}
	}
}

func reactPerfIsNewObjectValue(node *shimast.Node) bool {
	switch node.Kind {
	case shimast.KindObjectLiteralExpression:
		return true
	case shimast.KindNewExpression:
		expr := node.AsNewExpression()
		return expr != nil && identifierText(expr.Expression) == "Object"
	case shimast.KindCallExpression:
		call := node.AsCallExpression()
		return call != nil && identifierText(call.Expression) == "Object"
	}
	return false
}

func reactPerfIsNewArrayValue(node *shimast.Node) bool {
	switch node.Kind {
	case shimast.KindArrayLiteralExpression:
		return true
	case shimast.KindNewExpression:
		expr := node.AsNewExpression()
		return expr != nil && identifierText(expr.Expression) == "Array"
	case shimast.KindCallExpression:
		call := node.AsCallExpression()
		return call != nil && identifierText(call.Expression) == "Array"
	}
	return false
}

func reactPerfIsNewFunctionValue(node *shimast.Node) bool {
	switch node.Kind {
	case shimast.KindFunctionExpression, shimast.KindArrowFunction:
		return true
	case shimast.KindNewExpression:
		expr := node.AsNewExpression()
		return expr != nil && identifierText(expr.Expression) == "Function"
	case shimast.KindCallExpression:
		call := node.AsCallExpression()
		return call != nil && identifierText(call.Expression) == "Function"
	}
	return false
}

func reactPerfIsNewJSXValue(node *shimast.Node) bool {
	switch node.Kind {
	case shimast.KindJsxElement, shimast.KindJsxSelfClosingElement, shimast.KindJsxFragment:
		return true
	}
	return false
}

func init() {
	Register(reactPerfRule{
		name:    "react-perf/jsx-no-new-object-as-prop",
		message: "Do not pass a freshly-created object as a JSX prop.",
		matcher: reactPerfIsNewObjectValue,
	})
	Register(reactPerfRule{
		name:    "react-perf/jsx-no-new-array-as-prop",
		message: "Do not pass a freshly-created array as a JSX prop.",
		matcher: reactPerfIsNewArrayValue,
	})
	Register(reactPerfRule{
		name:    "react-perf/jsx-no-new-function-as-prop",
		message: "Do not pass a freshly-created function as a JSX prop.",
		matcher: reactPerfIsNewFunctionValue,
	})
	Register(reactPerfRule{
		name:    "react-perf/jsx-no-jsx-as-prop",
		message: "Do not pass freshly-created JSX as a JSX prop.",
		matcher: reactPerfIsNewJSXValue,
	})
}

package linthost

import (
	"regexp"
	"strings"

	shimast "github.com/microsoft/typescript-go/shim/ast"
)

type functionalParameters struct{}
type functionalImmutableData struct{}
type functionalNoClassInheritance struct{}
type functionalNoClasses struct{}
type functionalNoConditionalStatements struct{}
type functionalNoExpressionStatements struct{}
type functionalNoLet struct{}
type functionalNoLoopStatements struct{}
type functionalNoMixedTypes struct{}
type functionalNoPromiseReject struct{}
type functionalNoReturnVoid struct{}
type functionalNoThisExpressions struct{}
type functionalNoThrowStatements struct{}
type functionalNoTryStatements struct{}
type functionalPreferImmutableTypes struct{}
type functionalPreferPropertySignatures struct{}
type functionalPreferReadonlyType struct{}
type functionalPreferTacit struct{}
type functionalReadonlyType struct{}
type functionalTypeDeclarationImmutability struct{}

func (functionalParameters) Name() string              { return "functional/functional-parameters" }
func (functionalImmutableData) Name() string           { return "functional/immutable-data" }
func (functionalNoClassInheritance) Name() string      { return "functional/no-class-inheritance" }
func (functionalNoClasses) Name() string               { return "functional/no-classes" }
func (functionalNoConditionalStatements) Name() string { return "functional/no-conditional-statements" }
func (functionalNoExpressionStatements) Name() string  { return "functional/no-expression-statements" }
func (functionalNoLet) Name() string                   { return "functional/no-let" }
func (functionalNoLoopStatements) Name() string        { return "functional/no-loop-statements" }
func (functionalNoMixedTypes) Name() string            { return "functional/no-mixed-types" }
func (functionalNoPromiseReject) Name() string         { return "functional/no-promise-reject" }
func (functionalNoReturnVoid) Name() string            { return "functional/no-return-void" }
func (functionalNoThisExpressions) Name() string       { return "functional/no-this-expressions" }
func (functionalNoThrowStatements) Name() string       { return "functional/no-throw-statements" }
func (functionalNoTryStatements) Name() string         { return "functional/no-try-statements" }
func (functionalPreferImmutableTypes) Name() string    { return "functional/prefer-immutable-types" }
func (functionalPreferPropertySignatures) Name() string {
	return "functional/prefer-property-signatures"
}
func (functionalPreferReadonlyType) Name() string { return "functional/prefer-readonly-type" }
func (functionalPreferTacit) Name() string        { return "functional/prefer-tacit" }
func (functionalReadonlyType) Name() string       { return "functional/readonly-type" }
func (functionalTypeDeclarationImmutability) Name() string {
	return "functional/type-declaration-immutability"
}

func (functionalParameters) Visits() []shimast.Kind {
	return []shimast.Kind{
		shimast.KindParameter,
		shimast.KindIdentifier,
		shimast.KindFunctionDeclaration,
		shimast.KindFunctionExpression,
		shimast.KindArrowFunction,
		shimast.KindMethodDeclaration,
	}
}
func (functionalImmutableData) Visits() []shimast.Kind {
	return []shimast.Kind{
		shimast.KindBinaryExpression,
		shimast.KindPrefixUnaryExpression,
		shimast.KindPostfixUnaryExpression,
		shimast.KindDeleteExpression,
		shimast.KindCallExpression,
	}
}
func (functionalNoClassInheritance) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindClassDeclaration, shimast.KindClassExpression}
}
func (functionalNoClasses) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindClassDeclaration, shimast.KindClassExpression}
}
func (functionalNoConditionalStatements) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindIfStatement, shimast.KindSwitchStatement}
}
func (functionalNoExpressionStatements) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindExpressionStatement}
}
func (functionalNoLet) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindVariableDeclarationList}
}
func (functionalNoLoopStatements) Visits() []shimast.Kind {
	return []shimast.Kind{
		shimast.KindForStatement,
		shimast.KindForInStatement,
		shimast.KindForOfStatement,
		shimast.KindWhileStatement,
		shimast.KindDoStatement,
	}
}
func (functionalNoMixedTypes) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindInterfaceDeclaration, shimast.KindTypeLiteral}
}
func (functionalNoPromiseReject) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindCallExpression}
}
func (functionalNoReturnVoid) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindReturnStatement, shimast.KindFunctionDeclaration, shimast.KindFunctionExpression, shimast.KindArrowFunction, shimast.KindMethodDeclaration}
}
func (functionalNoThisExpressions) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindThisKeyword}
}
func (functionalNoThrowStatements) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindThrowStatement}
}
func (functionalNoTryStatements) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindTryStatement}
}
func (functionalPreferImmutableTypes) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindVariableDeclaration, shimast.KindParameter, shimast.KindPropertyDeclaration, shimast.KindPropertySignature}
}
func (functionalPreferPropertySignatures) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindMethodSignature}
}
func (functionalPreferReadonlyType) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindArrayType, shimast.KindTupleType, shimast.KindTypeReference, shimast.KindPropertySignature}
}
func (functionalPreferTacit) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindArrowFunction}
}
func (functionalReadonlyType) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindTypeReference, shimast.KindTypeOperator}
}
func (functionalTypeDeclarationImmutability) Visits() []shimast.Kind {
	return []shimast.Kind{shimast.KindInterfaceDeclaration, shimast.KindTypeAliasDeclaration}
}

type functionalNoLetOptions struct {
	functionalPatternOptions
	AllowInForLoopInit bool `json:"allowInForLoopInit"`
	AllowInFunctions   bool `json:"allowInFunctions"`
}

type functionalNoTryOptions struct {
	AllowCatch   bool `json:"allowCatch"`
	AllowFinally bool `json:"allowFinally"`
}

type functionalImmutableDataOptions struct {
	functionalPatternOptions
	IgnoreMapsAndSets bool `json:"ignoreMapsAndSets"`
}

type functionalParametersOptions struct {
	functionalPatternOptions
	AllowRestParameter    bool        `json:"allowRestParameter"`
	AllowArgumentsKeyword bool        `json:"allowArgumentsKeyword"`
	EnforceParameterCount interface{} `json:"enforceParameterCount"`
}

type functionalPreferImmutableTypesOptions struct {
	functionalPatternOptions
}

type functionalPreferReadonlyTypeOptions struct {
	functionalPatternOptions
}

type functionalReadonlyTypeOptions struct {
	Prefer string `json:"prefer"`
}

type functionalPatternOptions struct {
	IgnoreIdentifierPattern interface{} `json:"ignoreIdentifierPattern"`
	IgnoreCodePattern       interface{} `json:"ignoreCodePattern"`
}

type functionalImmutabilityDeclarationOptions struct {
	functionalPatternOptions
	Rules            []functionalImmutabilityRule `json:"rules"`
	IgnoreInterfaces bool                         `json:"ignoreInterfaces"`
}

type functionalImmutabilityRule struct {
	Identifiers interface{} `json:"identifiers"`
}

func (functionalParameters) Check(ctx *Context, node *shimast.Node) {
	var opts functionalParametersOptions
	_ = ctx.DecodeOptions(&opts)
	switch node.Kind {
	case shimast.KindParameter:
		param := node.AsParameterDeclaration()
		if param != nil && param.DotDotDotToken != nil && !opts.AllowRestParameter {
			if functionalShouldIgnore(ctx, opts.functionalPatternOptions, node, identifierText(param.Name())) {
				return
			}
			ctx.Report(node, "Unexpected rest parameter. Use a regular parameter of array type instead.")
		}
	case shimast.KindIdentifier:
		if opts.AllowArgumentsKeyword || identifierText(node) != "arguments" || isDeclarationName(node) {
			return
		}
		if functionalShouldIgnore(ctx, opts.functionalPatternOptions, node, "arguments") {
			return
		}
		ctx.Report(node, "Unexpected use of `arguments`. Use regular function arguments instead.")
	default:
		if opts.EnforceParameterCount == nil || opts.EnforceParameterCount == false {
			return
		}
		if len(node.Parameters()) == 0 {
			if functionalShouldIgnore(ctx, opts.functionalPatternOptions, node, functionalFunctionLikeName(node)) {
				return
			}
			ctx.Report(node, "Functions must have at least one parameter.")
		}
	}
}

func (functionalImmutableData) Check(ctx *Context, node *shimast.Node) {
	var opts functionalImmutableDataOptions
	_ = ctx.DecodeOptions(&opts)
	switch node.Kind {
	case shimast.KindBinaryExpression:
		expr := node.AsBinaryExpression()
		if expr == nil || expr.OperatorToken == nil || !isAssignmentOperator(expr.OperatorToken.Kind) {
			return
		}
		if isMemberMutationTarget(expr.Left) {
			if functionalShouldIgnore(ctx, opts.functionalPatternOptions, expr.Left, functionalIdentifierTexts(expr.Left)...) {
				return
			}
			ctx.Report(expr.Left, "Modifying an existing object/array is not allowed.")
		}
	case shimast.KindPrefixUnaryExpression:
		expr := node.AsPrefixUnaryExpression()
		if expr != nil && isUpdateOperator(expr.Operator) && isMemberMutationTarget(expr.Operand) {
			if functionalShouldIgnore(ctx, opts.functionalPatternOptions, expr.Operand, functionalIdentifierTexts(expr.Operand)...) {
				return
			}
			ctx.Report(expr.Operand, "Modifying an existing object/array is not allowed.")
		}
	case shimast.KindPostfixUnaryExpression:
		expr := node.AsPostfixUnaryExpression()
		if expr != nil && isUpdateOperator(expr.Operator) && isMemberMutationTarget(expr.Operand) {
			if functionalShouldIgnore(ctx, opts.functionalPatternOptions, expr.Operand, functionalIdentifierTexts(expr.Operand)...) {
				return
			}
			ctx.Report(expr.Operand, "Modifying an existing object/array is not allowed.")
		}
	case shimast.KindDeleteExpression:
		expr := node.AsDeleteExpression()
		if expr != nil && isMemberMutationTarget(expr.Expression) {
			if functionalShouldIgnore(ctx, opts.functionalPatternOptions, expr.Expression, functionalIdentifierTexts(expr.Expression)...) {
				return
			}
			ctx.Report(expr.Expression, "Modifying an existing object/array is not allowed.")
		}
	case shimast.KindCallExpression:
		call := node.AsCallExpression()
		if call == nil || call.Expression == nil || call.Expression.Kind != shimast.KindPropertyAccessExpression {
			return
		}
		access := call.Expression.AsPropertyAccessExpression()
		if access == nil {
			return
		}
		method := identifierText(access.Name())
		if isMutableArrayMethod(method) || (!opts.IgnoreMapsAndSets && isMutableCollectionMethod(method)) {
			if functionalShouldIgnore(ctx, opts.functionalPatternOptions, call.Expression, functionalIdentifierTexts(call.Expression)...) {
				return
			}
			ctx.Report(call.Expression, "Modifying an existing object/array is not allowed.")
		}
	}
}

func (functionalNoClassInheritance) Check(ctx *Context, node *shimast.Node) {
	if hasModifier(node, shimast.KindAbstractKeyword) {
		ctx.Report(node, "Unexpected abstract class.")
		return
	}
	if classHasHeritage(node) {
		ctx.Report(node, "Unexpected inheritance, use composition instead.")
	}
}

func (functionalNoClasses) Check(ctx *Context, node *shimast.Node) {
	ctx.Report(node, "Unexpected class, use functions not classes.")
}

func (functionalNoConditionalStatements) Check(ctx *Context, node *shimast.Node) {
	switch node.Kind {
	case shimast.KindIfStatement:
		ctx.Report(node, "Unexpected if, use a conditional expression instead.")
	case shimast.KindSwitchStatement:
		ctx.Report(node, "Unexpected switch, use a conditional expression instead.")
	}
}

func (functionalNoExpressionStatements) Check(ctx *Context, node *shimast.Node) {
	text := strings.TrimSpace(nodeText(ctx.File, node))
	if strings.HasPrefix(text, `"use `) || strings.HasPrefix(text, `'use `) {
		return
	}
	ctx.Report(node, "Using expressions to cause side effects is not allowed.")
}

func (functionalNoLet) Check(ctx *Context, node *shimast.Node) {
	if !shimast.IsLet(node) {
		return
	}
	var opts functionalNoLetOptions
	_ = ctx.DecodeOptions(&opts)
	if opts.AllowInForLoopInit && node.Parent != nil && node.Parent.Kind == shimast.KindForStatement {
		return
	}
	if opts.AllowInFunctions && hasAncestor(node, isFunctionLikeKind) {
		return
	}
	if functionalShouldIgnore(ctx, opts.functionalPatternOptions, node, functionalVariableDeclarationListNames(node)...) {
		return
	}
	start := keywordStart(ctx.File, node, "let")
	if start >= 0 {
		ctx.ReportRange(start, start+len("let"), "Unexpected let, use const instead.")
		return
	}
	ctx.Report(node, "Unexpected let, use const instead.")
}

func (functionalNoLoopStatements) Check(ctx *Context, node *shimast.Node) {
	ctx.Report(node, "Unexpected loop, use map or reduce instead.")
}

func (functionalNoMixedTypes) Check(ctx *Context, node *shimast.Node) {
	members := containerMembers(node)
	if len(members) < 2 {
		return
	}
	first := ""
	for _, member := range members {
		kind := functionalMemberKind(member)
		if kind == "" {
			continue
		}
		if first == "" {
			first = kind
			continue
		}
		if first != kind {
			ctx.Report(member, "Only the same kind of members are allowed in types.")
			return
		}
	}
}

func (functionalNoPromiseReject) Check(ctx *Context, node *shimast.Node) {
	call := node.AsCallExpression()
	if call != nil && isMatchingPropertyAccess(call.Expression, "Promise", "reject") {
		ctx.Report(node, "Unexpected rejection, resolve an error instead.")
	}
}

func (functionalNoReturnVoid) Check(ctx *Context, node *shimast.Node) {
	if node.Kind == shimast.KindReturnStatement {
		ret := node.AsReturnStatement()
		if ret != nil && ret.Expression == nil {
			ctx.Report(node, "Function must return a value.")
		}
		return
	}
	if functionalReturnTypeText(ctx, node) == "void" {
		ctx.Report(node, "Function must return a value.")
	}
}

func (functionalNoThisExpressions) Check(ctx *Context, node *shimast.Node) {
	ctx.Report(node, "Unexpected this, use functions not classes.")
}

func (functionalNoThrowStatements) Check(ctx *Context, node *shimast.Node) {
	ctx.Report(node, "Unexpected throw, throwing exceptions is not functional.")
}

func (functionalNoTryStatements) Check(ctx *Context, node *shimast.Node) {
	var opts functionalNoTryOptions
	_ = ctx.DecodeOptions(&opts)
	try := node.AsTryStatement()
	if try == nil {
		return
	}
	if try.CatchClause != nil && !opts.AllowCatch {
		ctx.Report(node, "Unexpected try-catch, this pattern is not functional.")
		return
	}
	if try.FinallyBlock != nil && !opts.AllowFinally {
		ctx.Report(node, "Unexpected try-finally, this pattern is not functional.")
	}
}

func (functionalPreferImmutableTypes) Check(ctx *Context, node *shimast.Node) {
	var opts functionalPreferImmutableTypesOptions
	_ = ctx.DecodeOptions(&opts)
	typeNode := declarationTypeNode(node)
	if typeNode == nil || !functionalMutableType(typeNode) {
		return
	}
	if functionalShouldIgnore(ctx, opts.functionalPatternOptions, node, functionalDeclarationName(node)) ||
		functionalShouldIgnore(ctx, opts.functionalPatternOptions, typeNode) {
		return
	}
	ctx.Report(typeNode, "Type should be readonly or immutable.")
}

func (functionalPreferPropertySignatures) Check(ctx *Context, node *shimast.Node) {
	ctx.Report(node, "Use a property signature instead of a method signature.")
}

func (functionalPreferReadonlyType) Check(ctx *Context, node *shimast.Node) {
	var opts functionalPreferReadonlyTypeOptions
	_ = ctx.DecodeOptions(&opts)
	switch node.Kind {
	case shimast.KindArrayType:
		if !isReadonlyTypeNode(node) {
			if functionalShouldIgnore(ctx, opts.functionalPatternOptions, node) {
				return
			}
			ctx.Report(node, "Only readonly arrays allowed.")
		}
	case shimast.KindTupleType:
		if !isReadonlyTypeNode(node) {
			if functionalShouldIgnore(ctx, opts.functionalPatternOptions, node) {
				return
			}
			ctx.Report(node, "Only readonly tuples allowed.")
		}
	case shimast.KindTypeReference:
		if isMutableTypeReference(node) {
			if functionalShouldIgnore(ctx, opts.functionalPatternOptions, node, functionalIdentifierTexts(node)...) {
				return
			}
			ctx.Report(node, "Only readonly types allowed.")
		}
	case shimast.KindPropertySignature:
		if !hasModifier(node, shimast.KindReadonlyKeyword) {
			if functionalShouldIgnore(ctx, opts.functionalPatternOptions, node, functionalDeclarationName(node)) {
				return
			}
			ctx.Report(node, "A readonly modifier is required.")
		}
	}
}

func (functionalPreferTacit) Check(ctx *Context, node *shimast.Node) {
	text := compactFunctionalWhitespace(nodeText(ctx.File, node))
	if isTacitWrapperText(text) {
		ctx.Report(node, "Potentially unnecessary function wrapper.")
	}
}

func (functionalReadonlyType) Check(ctx *Context, node *shimast.Node) {
	var opts functionalReadonlyTypeOptions
	_ = ctx.DecodeOptions(&opts)
	prefer := opts.Prefer
	if prefer == "" {
		prefer = "keyword"
	}
	switch node.Kind {
	case shimast.KindTypeReference:
		if prefer == "keyword" && identifierText(node.AsTypeReferenceNode().TypeName) == "ReadonlyArray" {
			ctx.Report(node, "Use the readonly keyword instead of ReadonlyArray<T>.")
		}
	case shimast.KindTypeOperator:
		if prefer == "generic" && strings.HasPrefix(strings.TrimSpace(nodeText(ctx.File, node)), "readonly ") {
			ctx.Report(node, "Use Readonly<T> instead of the readonly keyword.")
		}
	}
}

func (functionalTypeDeclarationImmutability) Check(ctx *Context, node *shimast.Node) {
	var opts functionalImmutabilityDeclarationOptions
	_ = ctx.DecodeOptions(&opts)
	if opts.IgnoreInterfaces && node.Kind == shimast.KindInterfaceDeclaration {
		return
	}
	name := functionalTypeDeclarationName(node)
	if functionalShouldIgnore(ctx, opts.functionalPatternOptions, node, name) {
		return
	}
	if !functionalDeclarationRuleApplies(opts, name) {
		return
	}
	if functionalDeclarationIsMutable(node) {
		ctx.Report(node, "Type declaration should only expose readonly members and immutable property types.")
	}
}

func isMemberMutationTarget(node *shimast.Node) bool {
	if node == nil {
		return false
	}
	node = stripParens(node)
	return node != nil && (node.Kind == shimast.KindPropertyAccessExpression || node.Kind == shimast.KindElementAccessExpression)
}

func functionalShouldIgnore(ctx *Context, opts functionalPatternOptions, node *shimast.Node, identifiers ...string) bool {
	if functionalPatternOptionMatches(opts.IgnoreCodePattern, strings.TrimSpace(nodeText(ctx.File, node))) {
		return true
	}
	for _, name := range identifiers {
		if functionalPatternOptionMatches(opts.IgnoreIdentifierPattern, name) {
			return true
		}
	}
	return false
}

func isUpdateOperator(kind shimast.Kind) bool {
	return kind == shimast.KindPlusPlusToken || kind == shimast.KindMinusMinusToken
}

func isMutableArrayMethod(name string) bool {
	switch name {
	case "copyWithin", "fill", "pop", "push", "reverse", "shift", "sort", "splice", "unshift":
		return true
	default:
		return false
	}
}

func isMutableCollectionMethod(name string) bool {
	switch name {
	case "add", "clear", "delete", "set":
		return true
	default:
		return false
	}
}

func classHasHeritage(node *shimast.Node) bool {
	switch node.Kind {
	case shimast.KindClassDeclaration:
		decl := node.AsClassDeclaration()
		return decl != nil && decl.HeritageClauses != nil && len(decl.HeritageClauses.Nodes) > 0
	case shimast.KindClassExpression:
		decl := node.AsClassExpression()
		return decl != nil && decl.HeritageClauses != nil && len(decl.HeritageClauses.Nodes) > 0
	default:
		return false
	}
}

func hasAncestor(node *shimast.Node, pred func(*shimast.Node) bool) bool {
	for cur := node.Parent; cur != nil; cur = cur.Parent {
		if pred(cur) {
			return true
		}
	}
	return false
}

func functionalMemberKind(node *shimast.Node) string {
	if node == nil {
		return ""
	}
	switch node.Kind {
	case shimast.KindPropertySignature, shimast.KindPropertyDeclaration:
		return "property"
	case shimast.KindMethodSignature, shimast.KindMethodDeclaration:
		return "method"
	case shimast.KindCallSignature:
		return "call"
	case shimast.KindIndexSignature:
		return "index"
	default:
		return ""
	}
}

func isDeclarationName(node *shimast.Node) bool {
	if node == nil || node.Parent == nil {
		return false
	}
	parent := node.Parent
	switch parent.Kind {
	case shimast.KindVariableDeclaration:
		decl := parent.AsVariableDeclaration()
		return decl != nil && decl.Name() == node
	case shimast.KindParameter:
		decl := parent.AsParameterDeclaration()
		return decl != nil && decl.Name() == node
	case shimast.KindFunctionDeclaration, shimast.KindClassDeclaration, shimast.KindInterfaceDeclaration, shimast.KindTypeAliasDeclaration:
		return true
	default:
		return false
	}
}

func functionalReturnTypeText(ctx *Context, node *shimast.Node) string {
	var typeNode *shimast.Node
	switch node.Kind {
	case shimast.KindFunctionDeclaration:
		if decl := node.AsFunctionDeclaration(); decl != nil {
			typeNode = decl.Type
		}
	case shimast.KindFunctionExpression:
		if decl := node.AsFunctionExpression(); decl != nil {
			typeNode = decl.Type
		}
	case shimast.KindArrowFunction:
		if decl := node.AsArrowFunction(); decl != nil {
			typeNode = decl.Type
		}
	case shimast.KindMethodDeclaration:
		if decl := node.AsMethodDeclaration(); decl != nil {
			typeNode = decl.Type
		}
	}
	return strings.TrimSpace(nodeText(ctx.File, typeNode))
}

func functionalFunctionLikeName(node *shimast.Node) string {
	if node == nil {
		return ""
	}
	switch node.Kind {
	case shimast.KindFunctionDeclaration:
		if decl := node.AsFunctionDeclaration(); decl != nil {
			return identifierText(decl.Name())
		}
	case shimast.KindMethodDeclaration:
		if decl := node.AsMethodDeclaration(); decl != nil {
			return identifierText(decl.Name())
		}
	}
	return ""
}

func declarationTypeNode(node *shimast.Node) *shimast.Node {
	if node == nil {
		return nil
	}
	switch node.Kind {
	case shimast.KindVariableDeclaration:
		if decl := node.AsVariableDeclaration(); decl != nil {
			return decl.Type
		}
	case shimast.KindParameter:
		if decl := node.AsParameterDeclaration(); decl != nil {
			return decl.Type
		}
	case shimast.KindPropertyDeclaration:
		if decl := node.AsPropertyDeclaration(); decl != nil {
			return decl.Type
		}
	case shimast.KindPropertySignature:
		if decl := node.AsPropertySignatureDeclaration(); decl != nil {
			return decl.Type
		}
	}
	return nil
}

func functionalDeclarationName(node *shimast.Node) string {
	if node == nil {
		return ""
	}
	switch node.Kind {
	case shimast.KindVariableDeclaration:
		if decl := node.AsVariableDeclaration(); decl != nil {
			return identifierText(decl.Name())
		}
	case shimast.KindParameter:
		if decl := node.AsParameterDeclaration(); decl != nil {
			return identifierText(decl.Name())
		}
	case shimast.KindPropertyDeclaration:
		if decl := node.AsPropertyDeclaration(); decl != nil {
			return identifierText(decl.Name())
		}
	case shimast.KindPropertySignature:
		if decl := node.AsPropertySignatureDeclaration(); decl != nil {
			return identifierText(decl.Name())
		}
	case shimast.KindFunctionDeclaration:
		if decl := node.AsFunctionDeclaration(); decl != nil {
			return identifierText(decl.Name())
		}
	case shimast.KindMethodDeclaration:
		if decl := node.AsMethodDeclaration(); decl != nil {
			return identifierText(decl.Name())
		}
	}
	return ""
}

func functionalVariableDeclarationListNames(node *shimast.Node) []string {
	list := node.AsVariableDeclarationList()
	if list == nil || list.Declarations == nil {
		return nil
	}
	names := make([]string, 0, len(list.Declarations.Nodes))
	for _, child := range list.Declarations.Nodes {
		if name := functionalDeclarationName(child); name != "" {
			names = append(names, name)
		}
	}
	return names
}

func functionalIdentifierTexts(node *shimast.Node) []string {
	var names []string
	walkDescendants(node, func(child *shimast.Node) {
		if name := identifierText(child); name != "" {
			names = append(names, name)
		}
	})
	return names
}

func functionalMutableType(node *shimast.Node) bool {
	if node == nil || isReadonlyTypeNode(node) {
		return false
	}
	switch node.Kind {
	case shimast.KindArrayType, shimast.KindTupleType:
		return true
	case shimast.KindTypeReference:
		return isMutableTypeReference(node)
	case shimast.KindTypeLiteral:
		return functionalTypeLiteralIsMutable(node)
	default:
		found := false
		walkDescendants(node, func(child *shimast.Node) {
			if child != node && functionalMutableType(child) {
				found = true
			}
		})
		return found
	}
}

func isReadonlyTypeNode(node *shimast.Node) bool {
	if node == nil {
		return false
	}
	return node.Kind == shimast.KindTypeOperator ||
		(node.Parent != nil && node.Parent.Kind == shimast.KindTypeOperator &&
			strings.HasPrefix(strings.TrimSpace(nodeText(nilSafeFile(node), node.Parent)), "readonly "))
}

func nilSafeFile(node *shimast.Node) *shimast.SourceFile {
	for cur := node; cur != nil; cur = cur.Parent {
		if cur.Kind == shimast.KindSourceFile {
			return cur.AsSourceFile()
		}
	}
	return nil
}

func isMutableTypeReference(node *shimast.Node) bool {
	ref := node.AsTypeReferenceNode()
	if ref == nil || ref.TypeName == nil {
		return false
	}
	switch identifierText(ref.TypeName) {
	case "Array", "Map", "Set", "WeakMap", "WeakSet":
		return true
	default:
		return false
	}
}

func functionalTypeLiteralIsMutable(node *shimast.Node) bool {
	lit := node.AsTypeLiteralNode()
	if lit == nil || lit.Members == nil {
		return false
	}
	for _, member := range lit.Members.Nodes {
		if member == nil {
			continue
		}
		if member.Kind == shimast.KindPropertySignature && !hasModifier(member, shimast.KindReadonlyKeyword) {
			return true
		}
		if functionalMutableType(declarationTypeNode(member)) {
			return true
		}
	}
	return false
}

func compactFunctionalWhitespace(text string) string {
	text = strings.TrimSpace(text)
	text = strings.Join(strings.Fields(text), "")
	return strings.TrimSuffix(text, ";")
}

func isTacitWrapperText(text string) bool {
	parts := strings.Split(text, "=>")
	if len(parts) != 2 {
		return false
	}
	param := strings.Trim(parts[0], "()")
	if !isFunctionalIdentifier(param) {
		return false
	}
	call := parts[1]
	if !strings.HasSuffix(call, ")") {
		return false
	}
	open := strings.LastIndex(call, "(")
	if open <= 0 {
		return false
	}
	callee := call[:open]
	arg := strings.TrimSuffix(call[open+1:], ")")
	return arg == param && isFunctionalMemberChain(callee)
}

func isFunctionalMemberChain(text string) bool {
	parts := strings.Split(text, ".")
	for _, part := range parts {
		if !isFunctionalIdentifier(part) {
			return false
		}
	}
	return true
}

func isFunctionalIdentifier(text string) bool {
	if text == "" {
		return false
	}
	for i, r := range text {
		if i == 0 {
			if r == '_' || r == '$' || ('A' <= r && r <= 'Z') || ('a' <= r && r <= 'z') {
				continue
			}
			return false
		}
		if r == '_' || r == '$' || ('A' <= r && r <= 'Z') || ('a' <= r && r <= 'z') || ('0' <= r && r <= '9') {
			continue
		}
		return false
	}
	return true
}

func functionalTypeDeclarationName(node *shimast.Node) string {
	switch node.Kind {
	case shimast.KindInterfaceDeclaration:
		if decl := node.AsInterfaceDeclaration(); decl != nil {
			return identifierText(decl.Name())
		}
	case shimast.KindTypeAliasDeclaration:
		if decl := node.AsTypeAliasDeclaration(); decl != nil {
			return identifierText(decl.Name())
		}
	}
	return ""
}

func functionalDeclarationRuleApplies(opts functionalImmutabilityDeclarationOptions, name string) bool {
	if len(opts.Rules) == 0 {
		return true
	}
	for _, rule := range opts.Rules {
		if functionalPatternOptionMatches(rule.Identifiers, name) {
			return true
		}
	}
	return false
}

func functionalPatternOptionMatches(raw interface{}, text string) bool {
	switch value := raw.(type) {
	case string:
		return functionalPatternMatches(value, text)
	case []interface{}:
		for _, item := range value {
			if pattern, ok := item.(string); ok && functionalPatternMatches(pattern, text) {
				return true
			}
		}
	}
	return false
}

func functionalPatternMatches(pattern, name string) bool {
	if pattern == "" || name == "" {
		return false
	}
	if pattern == name {
		return true
	}
	re, err := regexp.Compile(pattern)
	return err == nil && re.MatchString(name)
}

func functionalDeclarationIsMutable(node *shimast.Node) bool {
	switch node.Kind {
	case shimast.KindInterfaceDeclaration:
		for _, member := range containerMembers(node) {
			if member.Kind == shimast.KindPropertySignature && !hasModifier(member, shimast.KindReadonlyKeyword) {
				return true
			}
			if functionalMutableType(declarationTypeNode(member)) {
				return true
			}
		}
	case shimast.KindTypeAliasDeclaration:
		decl := node.AsTypeAliasDeclaration()
		return decl != nil && functionalMutableType(decl.Type)
	}
	return false
}

func init() {
	Register(functionalParameters{})
	Register(functionalImmutableData{})
	Register(functionalNoClassInheritance{})
	Register(functionalNoClasses{})
	Register(functionalNoConditionalStatements{})
	Register(functionalNoExpressionStatements{})
	Register(functionalNoLet{})
	Register(functionalNoLoopStatements{})
	Register(functionalNoMixedTypes{})
	Register(functionalNoPromiseReject{})
	Register(functionalNoReturnVoid{})
	Register(functionalNoThisExpressions{})
	Register(functionalNoThrowStatements{})
	Register(functionalNoTryStatements{})
	Register(functionalPreferImmutableTypes{})
	Register(functionalPreferPropertySignatures{})
	Register(functionalPreferReadonlyType{})
	Register(functionalPreferTacit{})
	Register(functionalReadonlyType{})
	Register(functionalTypeDeclarationImmutability{})
}

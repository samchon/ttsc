package printer

import (
	"github.com/microsoft/typescript-go/internal/ast"
	"github.com/microsoft/typescript-go/internal/core"
	innerprinter "github.com/microsoft/typescript-go/internal/printer"
)

type PrintHandlers = innerprinter.PrintHandlers
type Printer = innerprinter.Printer
type PrinterOptions = innerprinter.PrinterOptions
type EmitContext = innerprinter.EmitContext

func NewPrinter(options PrinterOptions, handlers PrintHandlers, emitContext *EmitContext) *Printer {
	return innerprinter.NewPrinter(options, handlers, emitContext)
}

func NewEmitContext() *EmitContext {
	return innerprinter.NewEmitContext()
}

func Emit(node *ast.Node, sourceFile *ast.SourceFile) string {
	node = stripTypeSyntax(node)
	normalizeSyntheticTokens(node)
	return NewPrinter(PrinterOptions{
		RemoveComments: true,
		NewLine:        core.NewLineKindLF,
	}, PrintHandlers{}, nil).Emit(node, sourceFile)
}

func EmitWithIdentifierSubstitutions(node *ast.Node, sourceFile *ast.SourceFile, substitutions map[string]string) string {
	node = stripTypeSyntax(node)
	node = rewriteIdentifiers(node, substitutions)
	normalizeSyntheticTokens(node)
	return NewPrinter(PrinterOptions{
		RemoveComments: true,
		NewLine:        core.NewLineKindLF,
	}, PrintHandlers{}, nil).Emit(node, sourceFile)
}

func EmitPreservingTypesWithIdentifierSubstitutions(node *ast.Node, sourceFile *ast.SourceFile, substitutions map[string]string) string {
	node = rewriteIdentifiers(node, substitutions)
	normalizeSyntheticTokens(node)
	return NewPrinter(PrinterOptions{
		RemoveComments: true,
		NewLine:        core.NewLineKindLF,
	}, PrintHandlers{}, nil).Emit(node, sourceFile)
}

func EmitSourceFile(p *Printer, sourceFile *ast.SourceFile) string {
	return p.EmitSourceFile(sourceFile)
}

func stripTypeSyntax(node *ast.Node) *ast.Node {
	if node == nil {
		return nil
	}
	factory := ast.NewNodeFactory(ast.NodeFactoryHooks{})
	var visitor *ast.NodeVisitor
	visitor = ast.NewNodeVisitor(func(current *ast.Node) *ast.Node {
		if current == nil {
			return nil
		}
		switch current.Kind {
		case ast.KindAsExpression, ast.KindSatisfiesExpression, ast.KindTypeAssertionExpression, ast.KindNonNullExpression:
			return visitor.VisitNode(current.Expression())
		case ast.KindVariableDeclaration:
			decl := current.AsVariableDeclaration()
			return factory.UpdateVariableDeclaration(
				decl,
				visitor.VisitNode(decl.Name()),
				nil,
				nil,
				visitor.VisitNode(decl.Initializer),
			)
		case ast.KindParameter:
			parameter := current.AsParameterDeclaration()
			return factory.UpdateParameterDeclaration(
				parameter,
				visitor.VisitModifiers(parameter.Modifiers()),
				visitor.VisitNode(parameter.DotDotDotToken),
				visitor.VisitNode(parameter.Name()),
				nil,
				nil,
				visitor.VisitNode(parameter.Initializer),
			)
		case ast.KindArrowFunction:
			arrow := current.AsArrowFunction()
			return factory.UpdateArrowFunction(
				arrow,
				visitor.VisitModifiers(arrow.Modifiers()),
				nil,
				visitor.VisitNodes(arrow.Parameters),
				nil,
				nil,
				visitor.VisitNode(arrow.EqualsGreaterThanToken),
				visitor.VisitNode(arrow.Body),
			)
		case ast.KindCallExpression:
			call := current.AsCallExpression()
			return factory.UpdateCallExpression(
				call,
				visitor.VisitNode(call.Expression),
				visitor.VisitNode(call.QuestionDotToken),
				nil,
				visitor.VisitNodes(call.Arguments),
				call.Flags,
			)
		case ast.KindNewExpression:
			expr := current.AsNewExpression()
			return factory.UpdateNewExpression(
				expr,
				visitor.VisitNode(expr.Expression),
				nil,
				visitor.VisitNodes(expr.Arguments),
			)
		default:
			return visitor.VisitEachChild(current)
		}
	}, factory, ast.NodeVisitorHooks{})
	return visitor.VisitNode(node)
}

func rewriteIdentifiers(node *ast.Node, substitutions map[string]string) *ast.Node {
	if node == nil || len(substitutions) == 0 {
		return node
	}
	factory := ast.NewNodeFactory(ast.NodeFactoryHooks{})
	var visitor *ast.NodeVisitor
	visitor = ast.NewNodeVisitor(func(current *ast.Node) *ast.Node {
		if current == nil {
			return nil
		}
		switch current.Kind {
		case ast.KindIdentifier:
			if replacement, ok := substitutions[current.Text()]; ok {
				return rewriteIdentifierExpression(factory, replacement)
			}
			return current
		case ast.KindVariableDeclaration:
			decl := current.AsVariableDeclaration()
			return factory.UpdateVariableDeclaration(
				decl,
				decl.Name(),
				nil,
				nil,
				visitor.VisitNode(decl.Initializer),
			)
		case ast.KindParameter:
			parameter := current.AsParameterDeclaration()
			return factory.UpdateParameterDeclaration(
				parameter,
				parameter.Modifiers(),
				parameter.DotDotDotToken,
				parameter.Name(),
				nil,
				nil,
				visitor.VisitNode(parameter.Initializer),
			)
		case ast.KindPropertyAssignment:
			assignment := current.AsPropertyAssignment()
			return factory.UpdatePropertyAssignment(
				assignment,
				assignment.Modifiers(),
				assignment.Name(),
				assignment.PostfixToken,
				nil,
				visitor.VisitNode(assignment.Initializer),
			)
		case ast.KindShorthandPropertyAssignment:
			assignment := current.AsShorthandPropertyAssignment()
			name := assignment.Name()
			if name != nil && name.Kind == ast.KindIdentifier {
				if replacement, ok := substitutions[name.Text()]; ok && assignment.ObjectAssignmentInitializer == nil {
					return factory.NewPropertyAssignment(
						assignment.Modifiers(),
						name,
						assignment.PostfixToken,
						nil,
						rewriteIdentifierExpression(factory, replacement),
					)
				}
			}
			return factory.UpdateShorthandPropertyAssignment(
				assignment,
				assignment.Modifiers(),
				name,
				assignment.PostfixToken,
				nil,
				nil,
				visitor.VisitNode(assignment.ObjectAssignmentInitializer),
			)
		case ast.KindPropertyAccessExpression:
			access := current.AsPropertyAccessExpression()
			return factory.UpdatePropertyAccessExpression(
				access,
				visitor.VisitNode(access.Expression),
				access.QuestionDotToken,
				access.Name(),
				access.Flags,
			)
		default:
			return visitor.VisitEachChild(current)
		}
	}, factory, ast.NodeVisitorHooks{})
	return visitor.VisitNode(node)
}

func rewriteIdentifierExpression(factory *ast.NodeFactory, replacement string) *ast.Node {
	parts := []string{}
	start := 0
	for i := 0; i <= len(replacement); i++ {
		if i == len(replacement) || replacement[i] == '.' {
			if start < i {
				parts = append(parts, replacement[start:i])
			}
			start = i + 1
		}
	}
	if len(parts) == 0 {
		return factory.NewIdentifier(replacement)
	}
	output := factory.NewIdentifier(parts[0])
	for _, part := range parts[1:] {
		output = factory.NewPropertyAccessExpression(
			output,
			nil,
			factory.NewIdentifier(part),
			ast.NodeFlagsNone,
		)
	}
	return output
}

func normalizeSyntheticTokens(node *ast.Node) {
	if node == nil {
		return
	}
	if node.Kind == ast.KindConditionalExpression {
		conditional := node.AsConditionalExpression()
		factory := ast.NewNodeFactory(ast.NodeFactoryHooks{})
		if conditional.QuestionToken == nil {
			conditional.QuestionToken = factory.NewToken(ast.KindQuestionToken)
		}
		if conditional.ColonToken == nil {
			conditional.ColonToken = factory.NewToken(ast.KindColonToken)
		}
	}
	node.ForEachChild(func(child *ast.Node) bool {
		normalizeSyntheticTokens(child)
		return false
	})
}

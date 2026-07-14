package linthost

import (
  "bytes"
  "encoding/json"

  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimcore "github.com/microsoft/typescript-go/shim/core"
)

// noInnerDeclarations enforces the root-declaration positions and option
// defaults of ESLint's core no-inner-declarations rule. TypeScript-Go parses
// JavaScript and TypeScript with the current ECMAScript grammar, so strict
// functions in ordinary parsed source have ES2015 block-function semantics.
// https://eslint.org/docs/latest/rules/no-inner-declarations
type noInnerDeclarations struct{}

type noInnerDeclarationsOptions struct {
  both                 bool
  allowBlockScopedFunc bool
}

type noInnerDeclarationsBlockOptions struct {
  BlockScopedFunctions string `json:"blockScopedFunctions"`
}

func (noInnerDeclarations) Name() string { return "no-inner-declarations" }

func (noInnerDeclarations) Visits() []shimast.Kind {
  return []shimast.Kind{
    shimast.KindFunctionDeclaration,
    shimast.KindVariableDeclarationList,
  }
}

func (noInnerDeclarations) Check(ctx *Context, node *shimast.Node) {
  options := resolveNoInnerDeclarationsOptions(ctx)
  declaration := node
  declarationType := "function"

  if node.Kind == shimast.KindVariableDeclarationList {
    if !options.both || !shimast.IsVar(node) {
      return
    }
    declarationType = "variable"
    // A statement-level list is wrapped by VariableStatement in the tsgo AST.
    // Use that wrapper for root classification and for the diagnostic range;
    // loop-header lists have no wrapper and remain nested declarations.
    if node.Parent != nil && node.Parent.Kind == shimast.KindVariableStatement {
      declaration = node.Parent
    }
  } else if options.allowBlockScopedFunc &&
    noInnerDeclarationsSupportsBlockFunctions(ctx.File) &&
    noInnerDeclarationsIsStrict(ctx.File, node) {
    return
  }

  if noInnerDeclarationsIsRoot(declaration) {
    return
  }
  ctx.Report(
    declaration,
    "Move "+declarationType+" declaration to "+noInnerDeclarationsAllowedBody(declaration)+" root.",
  )
}

// resolveNoInnerDeclarationsOptions reads the canonical ESLint positional
// options. The config transport preserves one positional value directly and
// two or more values as an array, so both [severity, mode] and
// [severity, mode, object] arrive without rule-specific parser behavior.
func resolveNoInnerDeclarationsOptions(ctx *Context) noInnerDeclarationsOptions {
  resolved := noInnerDeclarationsOptions{allowBlockScopedFunc: true}
  if ctx == nil || len(ctx.Options) == 0 {
    return resolved
  }

  raw := bytes.TrimSpace(ctx.Options)
  if len(raw) == 0 {
    return resolved
  }
  var slots []json.RawMessage
  if raw[0] == '[' {
    // Decode into a zero-value slice. Seeding it with raw would let the first
    // RawMessage reuse and overwrite Context.Options' backing bytes, changing
    // the option seen by every later declaration in the same file.
    if err := json.Unmarshal(raw, &slots); err != nil {
      return resolved
    }
  } else {
    slots = []json.RawMessage{raw}
  }

  if len(slots) > 0 {
    var mode string
    if json.Unmarshal(slots[0], &mode) == nil && mode == "both" {
      resolved.both = true
    }
  }
  if len(slots) > 1 {
    var options noInnerDeclarationsBlockOptions
    if json.Unmarshal(slots[1], &options) == nil && options.BlockScopedFunctions == "disallow" {
      resolved.allowBlockScopedFunc = false
    }
  }
  return resolved
}

func noInnerDeclarationsSupportsBlockFunctions(file *shimast.SourceFile) bool {
  return file != nil && file.ScriptKind != shimcore.ScriptKindJSON
}

// noInnerDeclarationsIsStrict derives strictness from parser-owned AST facts:
// external-module identity, class ancestry, and real directive prologues. It
// deliberately does not infer semantics from filenames or substring searches.
func noInnerDeclarationsIsStrict(file *shimast.SourceFile, node *shimast.Node) bool {
  if file != nil && file.ExternalModuleIndicator != nil {
    return true
  }
  for ancestor := node.Parent; ancestor != nil; ancestor = ancestor.Parent {
    switch ancestor.Kind {
    case shimast.KindClassDeclaration, shimast.KindClassExpression:
      return true
    case shimast.KindSourceFile, shimast.KindModuleBlock:
      if noInnerDeclarationsHasUseStrictDirective(file, ancestor) {
        return true
      }
    case shimast.KindBlock:
      if isFunctionLikeKind(ancestor.Parent) && noInnerDeclarationsHasUseStrictDirective(file, ancestor) {
        return true
      }
    }
  }
  return false
}

func noInnerDeclarationsHasUseStrictDirective(file *shimast.SourceFile, container *shimast.Node) bool {
  for _, statement := range parentStatements(container) {
    if statement == nil || statement.Kind != shimast.KindExpressionStatement {
      return false
    }
    expressionStatement := statement.AsExpressionStatement()
    if expressionStatement == nil || expressionStatement.Expression == nil ||
      expressionStatement.Expression.Kind != shimast.KindStringLiteral {
      return false
    }
    // ES5 forbids escapes in a Use Strict Directive. Match the parser/binder
    // contract against the parser-classified literal token, not its cooked
    // value (`"use\x20strict"` must stay sloppy).
    raw := nodeText(file, expressionStatement.Expression)
    if raw == `"use strict"` || raw == `'use strict'` {
      return true
    }
  }
  return false
}

func noInnerDeclarationsIsRoot(declaration *shimast.Node) bool {
  if declaration == nil || declaration.Parent == nil {
    return true
  }
  parent := declaration.Parent
  switch parent.Kind {
  case shimast.KindSourceFile, shimast.KindModuleBlock, shimast.KindClassStaticBlockDeclaration:
    return true
  case shimast.KindBlock:
    return isFunctionLikeKind(parent.Parent) ||
      (parent.Parent != nil && parent.Parent.Kind == shimast.KindClassStaticBlockDeclaration)
  }
  return false
}

func noInnerDeclarationsAllowedBody(declaration *shimast.Node) string {
  for ancestor := declaration.Parent; ancestor != nil; ancestor = ancestor.Parent {
    if ancestor.Kind == shimast.KindClassStaticBlockDeclaration {
      return "class static block body"
    }
    if isFunctionLikeKind(ancestor) {
      return "function body"
    }
  }
  return "program"
}

func init() {
  Register(noInnerDeclarations{})
}

// unicorn/throw-new-error: `throw Foo(...)` and `throw new Foo(...)` both
// produce an Error instance for the BUILT-IN Error constructors, which stay
// callable without `new`, but the call-form is a footgun — readers expect
// `throw` to be paired with `new`, and a user-defined `class FooError extends
// Error` cannot be called without `new` at all: the call throws a TypeError
// instead of the error the author meant to throw. The rule requires
// `throw new` whenever the operand is a direct call to an error-like
// constructor.
//
// The callee predicate is upstream's: an `Identifier` callee, or a
// non-computed member callee whose property is an `Identifier`, whose name
// matches `^(?:[A-Z][\da-z]*)*Error$`. That covers the built-ins
// (`TypeError`) AND user-defined classes (`ValidationError`,
// `ns.HttpError`), which are the rule's most common real-world target.
//
// AST-only: visit each `ThrowStatement`, peel parentheses off its operand,
// and fire when the operand is a `CallExpression` (NOT a `NewExpression`)
// whose callee matches. Computed access (`lib["Error"]()`) is skipped, and
// so is any optional-chained callee (`Error?.()`, `lib?.Error()`) because
// `new` cannot be applied to an optional chain. Shadowed bindings and
// type-aware widening are intentionally out of scope — the rule is a
// syntactic nudge, not a full Error-tracking pass. Unlike upstream, which
// flags every error-constructing call site, this port stays scoped to
// `throw` operands.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/throw-new-error.md
package linthost

import (
  "regexp"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// unicornThrowNewErrorNamePattern is upstream's `customError` regex: any
// number of capitalized words (each a capital followed by digits/lowercase)
// closed by a literal `Error`. It accepts `Error`, `TypeError`, `HTTPError`,
// and `Abc3Error`, and rejects `fooError` (no leading capital), `ERROR` (the
// suffix is case-sensitive), `getError`, and `Errors`.
var unicornThrowNewErrorNamePattern = regexp.MustCompile(`^(?:[A-Z][\da-z]*)*Error$`)

type unicornThrowNewError struct{}

func (unicornThrowNewError) Name() string { return "unicorn/throw-new-error" }
func (unicornThrowNewError) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindThrowStatement}
}
func (unicornThrowNewError) Check(ctx *Context, node *shimast.Node) {
  throw := node.AsThrowStatement()
  if throw == nil || throw.Expression == nil {
    return
  }
  expr := stripParens(throw.Expression)
  if expr == nil || expr.Kind != shimast.KindCallExpression {
    return
  }
  call := expr.AsCallExpression()
  if call == nil || call.Expression == nil {
    return
  }
  // `new` cannot be applied to an optional chain (`new lib?.Error()` is a
  // syntax error), so upstream reports neither an optional call nor an
  // optional-chained callee.
  if call.QuestionDotToken != nil || unicornThrowNewErrorHasOptionalChain(call.Expression) {
    return
  }
  callee := stripParens(call.Expression)
  if !unicornThrowNewErrorIsErrorCallee(callee) {
    return
  }
  ctx.ReportFix(
    expr,
    "Use `new` when throwing an error.",
    unicornThrowNewErrorFix(ctx.File, throw.Expression, expr, call.Expression)...,
  )
}

// unicornThrowNewErrorIsErrorCallee reports whether a callee names an error
// constructor. A bare identifier matches on its own name; a property access
// matches on its property name, so `ns.FooError()` counts while the computed
// `ns["FooError"]()` (an element access) never does — computed keys are opaque
// to upstream's selector too.
//
// `Data.TaggedError(...)` is upstream's Effect-library carve-out: the call
// builds an error CLASS rather than an error instance, so `new` would be wrong.
// https://github.com/sindresorhus/eslint-plugin-unicorn/issues/2654
func unicornThrowNewErrorIsErrorCallee(callee *shimast.Node) bool {
  if callee == nil {
    return false
  }
  switch callee.Kind {
  case shimast.KindIdentifier:
    return unicornThrowNewErrorNamePattern.MatchString(identifierText(callee))
  case shimast.KindPropertyAccessExpression:
    access := callee.AsPropertyAccessExpression()
    if access == nil {
      return false
    }
    name := identifierText(access.Name())
    if !unicornThrowNewErrorNamePattern.MatchString(name) {
      return false
    }
    return name != "TaggedError" ||
      identifierText(stripParens(access.Expression)) != "Data"
  default:
    return false
  }
}

// unicornThrowNewErrorHasOptionalChain reports whether any element on a
// callee's left-hand chain uses `?.`, mirroring upstream's
// `hasOptionalChainElement`. It differs from the shared `containsOptionalChain`
// by seeing through parentheses and TypeScript's type-only wrappers, so
// `(lib?.foo)!.Error()` is still recognized as an optional chain; `new` on any
// such callee is a syntax error, and the rule must stay silent rather than
// offer a fix that breaks the file.
func unicornThrowNewErrorHasOptionalChain(node *shimast.Node) bool {
  node = unwrapReferenceExpression(node)
  if node == nil {
    return false
  }
  switch node.Kind {
  case shimast.KindPropertyAccessExpression:
    access := node.AsPropertyAccessExpression()
    if access == nil {
      return false
    }
    return access.QuestionDotToken != nil ||
      unicornThrowNewErrorHasOptionalChain(access.Expression)
  case shimast.KindElementAccessExpression:
    access := node.AsElementAccessExpression()
    if access == nil {
      return false
    }
    return access.QuestionDotToken != nil ||
      unicornThrowNewErrorHasOptionalChain(access.Expression)
  case shimast.KindCallExpression:
    call := node.AsCallExpression()
    if call == nil {
      return false
    }
    return call.QuestionDotToken != nil ||
      unicornThrowNewErrorHasOptionalChain(call.Expression)
  default:
    return false
  }
}

// unicornThrowNewErrorFix builds upstream's autofix: insert `new ` in front of
// the reported call. Two adjustments keep the rewritten source parseable, both
// owed to upstream's shared `switchCallExpressionToNewExpression` fixer.
//
// A `throw` keyword that abuts its operand (`throw(Error())`,
// `throw[lib][0].Error()`) needs a separating space, or the inserted keyword
// welds onto it (`thrownew ...`). The space belongs at the operand's own start
// — outside any parentheses wrapping it — and merges into the `new ` insert
// when the two offsets coincide, because two zero-width inserts at one offset
// cannot both survive edit selection.
//
// A callee that still exposes a call needs parentheses, because a `new`
// expression's callee grammar ends at the first argument list; see
// unicornThrowNewErrorCalleeNeedsParens.
func unicornThrowNewErrorFix(
  file *shimast.SourceFile,
  operand *shimast.Node,
  call *shimast.Node,
  rawCallee *shimast.Node,
) []TextEdit {
  if file == nil {
    return nil
  }
  callee := stripParens(rawCallee)
  operandStart, _ := tokenRange(file, operand)
  // A callee is its call's first token, so the call and its callee share one
  // start offset; the opening parenthesis therefore rides along with the `new `
  // insert instead of being a second zero-width edit at that same offset.
  callStart, _ := tokenRange(file, call)
  _, calleeEnd := tokenRange(file, callee)
  if operandStart < 0 || callStart < 0 || calleeEnd < 0 {
    return nil
  }
  src := file.Text()
  parenthesize := unicornThrowNewErrorCalleeNeedsParens(rawCallee, callee)
  insert := "new "
  if parenthesize {
    insert += "("
  }
  edits := make([]TextEdit, 0, 3)
  if operandStart > 0 && isIdentifierPart(src[operandStart-1]) {
    if operandStart == callStart {
      insert = " " + insert
    } else {
      edits = append(edits, TextEdit{Pos: operandStart, End: operandStart, Text: " "})
    }
  }
  edits = append(edits, TextEdit{Pos: callStart, End: callStart, Text: insert})
  if parenthesize {
    edits = append(edits, TextEdit{Pos: calleeEnd, End: calleeEnd, Text: ")"})
  }
  return edits
}

// unicornThrowNewErrorCalleeNeedsParens reports whether the fix has to wrap the
// callee in parentheses: only when the source does not already parenthesize the
// callee itself and an unshielded call sits on its object chain, whose argument
// list `new` would otherwise consume as its own.
//
// The walk stops at a parenthesized object because parentheses already shield
// everything inside them — `throw (getGlobalThis()).Error()` fixes to
// `throw new (getGlobalThis()).Error()`, whose callee parse ends at `.Error`.
// A non-null assertion shields nothing, so it stays transparent: without that
// step `throw lib.getError()!.FooError()` would fix to
// `throw new lib.getError()!.FooError()`, which constructs `lib.getError()` and
// then reads `.FooError()` off the instance.
func unicornThrowNewErrorCalleeNeedsParens(rawCallee, callee *shimast.Node) bool {
  if rawCallee == nil || rawCallee.Kind == shimast.KindParenthesizedExpression {
    return false
  }
  if callee == nil || callee.Kind != shimast.KindPropertyAccessExpression {
    return false
  }
  access := callee.AsPropertyAccessExpression()
  if access == nil {
    return false
  }
  current := access.Expression
  for current != nil {
    switch current.Kind {
    case shimast.KindCallExpression:
      return true
    case shimast.KindPropertyAccessExpression:
      inner := current.AsPropertyAccessExpression()
      if inner == nil {
        return false
      }
      current = inner.Expression
    case shimast.KindElementAccessExpression:
      inner := current.AsElementAccessExpression()
      if inner == nil {
        return false
      }
      current = inner.Expression
    case shimast.KindNonNullExpression:
      current = current.Expression()
    default:
      return false
    }
  }
  return false
}

func init() {
  Register(unicornThrowNewError{})
}

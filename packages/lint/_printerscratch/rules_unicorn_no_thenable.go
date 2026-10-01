// unicorn/no-thenable: an object that exposes a callable `then` property
// becomes accidentally thenable — the runtime's `Promise.resolve(value)`
// pipeline treats every such value as a promise, so awaiting it invokes
// the user's `then` instead of resolving to the object itself. This is a
// common source of surprises in plain data objects and class shapes that
// were never intended as promises.
//
// AST-only: dispatch on every property-defining node form (data
// property, method, shorthand property, getter, setter) and fire when
// the name node is an Identifier `then` or a StringLiteral `"then"`.
// `moduleExportNameText` already returns the right textual value for
// both shapes; computed names and other syntactic forms are skipped.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-thenable.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornNoThenable struct{}

func (unicornNoThenable) Name() string { return "unicorn/no-thenable" }
func (unicornNoThenable) Visits() []shimast.Kind {
  return []shimast.Kind{
    shimast.KindPropertyAssignment,
    shimast.KindMethodDeclaration,
    shimast.KindShorthandPropertyAssignment,
    shimast.KindGetAccessor,
    shimast.KindSetAccessor,
  }
}
func (unicornNoThenable) Check(ctx *Context, node *shimast.Node) {
  var name *shimast.Node
  switch node.Kind {
  case shimast.KindPropertyAssignment:
    if a := node.AsPropertyAssignment(); a != nil {
      name = a.Name()
    }
  case shimast.KindMethodDeclaration:
    if m := node.AsMethodDeclaration(); m != nil {
      name = m.Name()
    }
  case shimast.KindShorthandPropertyAssignment:
    if s := node.AsShorthandPropertyAssignment(); s != nil {
      name = s.Name()
    }
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
    return
  }
  switch name.Kind {
  case shimast.KindIdentifier:
    if identifierText(name) != "then" {
      return
    }
  case shimast.KindStringLiteral:
    if stringLiteralText(name) != "then" {
      return
    }
  default:
    return
  }
  ctx.Report(node, "Don't define a property named `then` — it makes the object accidentally thenable.")
}

func init() {
  Register(unicornNoThenable{})
}

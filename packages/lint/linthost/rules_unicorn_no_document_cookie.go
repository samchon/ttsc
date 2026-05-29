// unicorn/no-document-cookie: writing to (or reading) `document.cookie`
// directly mixes name/value parsing, serialization, attribute handling,
// and quoting concerns into one mutable string. The replacement is the
// async Cookie Store API (`cookieStore.set`/`cookieStore.get`) or a
// dedicated cookie wrapper — both surface attribute fields as data
// instead of string-encoded options.
//
// AST-only and identifier-text-driven: any `PropertyAccessExpression`
// whose receiver identifier is `document` and whose property name is
// `cookie` matches, so the same visit handles both the read
// (`document.cookie`) and the assignment LHS (`document.cookie = "..."`).
// Shadowed `document` bindings and computed/optional access are out of
// scope, mirroring `unicorn/no-process-exit`.
// https://github.com/sindresorhus/eslint-plugin-unicorn/blob/main/docs/rules/no-document-cookie.md
package linthost

import shimast "github.com/microsoft/typescript-go/shim/ast"

type unicornNoDocumentCookie struct{}

func (unicornNoDocumentCookie) Name() string { return "unicorn/no-document-cookie" }
func (unicornNoDocumentCookie) Visits() []shimast.Kind {
  return []shimast.Kind{shimast.KindPropertyAccessExpression}
}
func (unicornNoDocumentCookie) Check(ctx *Context, node *shimast.Node) {
  access := node.AsPropertyAccessExpression()
  if access == nil {
    return
  }
  if identifierText(access.Expression) != "document" {
    return
  }
  if identifierText(access.Name()) != "cookie" {
    return
  }
  ctx.Report(node, "Don't use `document.cookie` directly; use the Cookie Store API or a wrapper.")
}

func init() {
  Register(unicornNoDocumentCookie{})
}

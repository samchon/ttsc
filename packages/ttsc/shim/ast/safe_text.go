// gen_shims:hand-maintained
//
// Total-function replacement for upstream `(*Node).Text()`.
//
// Upstream panics for any Kind missing from its switch — most notably
// KindQualifiedName, which surfaces in JSDoc parameter names (`@param
// obj.field`) and dotted entity references. NodeText handles
// QualifiedName by recursing on the left subtree and joining with the
// right identifier, and falls back to the source-text slice for any
// other Kind so downstream code can treat the helper as a total
// function over *Node instead of guarding each call site.

package ast

import (
  "strings"

  innerast "github.com/microsoft/typescript-go/internal/ast"
)

// NodeText returns the identifier-like text of a node. It mirrors
// upstream `(*Node).Text()` where upstream has an arm, adds a
// QualifiedName arm that joins `left.right`, and falls back to the
// node's source slice for any other Kind. Returns "" for nil.
func NodeText(n *Node) string {
  if n == nil {
    return ""
  }
  switch n.Kind {
  case KindIdentifier,
    innerast.KindPrivateIdentifier,
    KindStringLiteral,
    KindNumericLiteral,
    KindBigIntLiteral,
    KindNoSubstitutionTemplateLiteral,
    KindTemplateHead,
    KindTemplateMiddle,
    KindTemplateTail,
    innerast.KindRegularExpressionLiteral,
    innerast.KindJsxNamespacedName,
    innerast.KindJSDocText,
    innerast.KindJSDocLink,
    innerast.KindJSDocLinkCode,
    innerast.KindJSDocLinkPlain,
    innerast.KindMetaProperty:
    return n.Text()
  case KindQualifiedName:
    qn := n.AsQualifiedName()
    if qn == nil {
      return ""
    }
    left := NodeText(qn.Left)
    right := ""
    if qn.Right != nil {
      right = qn.Right.Text()
    }
    switch {
    case left == "" && right == "":
      return ""
    case left == "":
      return right
    case right == "":
      return left
    default:
      return left + "." + right
    }
  }
  return nodeSourceText(n)
}

// nodeSourceText returns the verbatim source slice covered by the node's
// position range, trimmed of surrounding whitespace. Same byte range
// scanner.GetTextOfNode would read; safe for any Kind because it does
// not inspect per-Kind data fields.
func nodeSourceText(n *innerast.Node) string {
  file := innerast.GetSourceFileOfNode(n)
  if file == nil {
    return ""
  }
  text := file.Text()
  pos, end := n.Pos(), n.End()
  if pos < 0 || end > len(text) || pos >= end {
    return ""
  }
  return strings.TrimSpace(text[pos:end])
}

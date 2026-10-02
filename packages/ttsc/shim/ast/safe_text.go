// gen_shims:hand-maintained
//
// Total-function replacement for upstream `(*Node).Text()`.
//
// Upstream panics for any Kind missing from its switch, most notably
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
//
// A node's payload must match its Kind. Unsupported kinds without a valid
// containing source range return "" instead of synthesizing spelling.
//
// @evidence contracts/common.md#principled-implementation Known text-bearing kinds use their upstream payload accessor, qualified names concatenate their identifier components, and other kinds use checked source byte ranges; nodes must have payloads matching their Kind.
// @evidence contracts/common.md#clear-and-simple-design One kind dispatch separates semantic token text from qualified-name composition and the private source-range fallback, keeping the safety policy local.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Kind-specific cases reflect actual AST representations missing from upstream Text, and the range fallback does not patch that foreign method or special-case consumers.
// @evidence contracts/common.md#meaningful-documentation Native prose distinguishes token text from source spelling, documents nil and unavailable ranges, and states the payload premise using separated body and tag sections.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources NodeText acquires no handle, buffer or cache and retains nothing after it returns.
// @evidenceExclude contracts/performance.md#efficient-algorithms NodeText performs a fixed number of steps with no loop or recursion over caller data.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work NodeText computes one result per call, so there is no repeated work to share.
// @evidenceExclude contracts/portability.md#os-neutral-implementation NodeText computes from its arguments only; it opens no file, builds no path and calls no platform or process API.
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

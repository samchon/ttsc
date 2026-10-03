// gen_shims:hand-maintained
//
// Text accessor for valid compiler nodes beyond upstream `(*Node).Text()`.
//
// Upstream panics for any Kind missing from its switch, most notably
// KindQualifiedName, which surfaces in JSDoc parameter names (`@param
// obj.field`) and dotted entity references. NodeText handles
// QualifiedName by collecting the left chain and joining nonempty components,
// and falls back to the checked source-text slice for other kinds. Payloads
// must match their kinds and parent/qualified-name chains must terminate.

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
// A node's payload must match its Kind, present qualified-name right nodes must
// be valid text-bearing names, and parent/qualified-name chains must terminate.
// Unsupported kinds without a valid containing source range return "" instead
// of synthesizing spelling. This is not a total function for malformed cycles
// or mismatched payloads.
//
// @evidence contracts/common.md#principled-implementation Known text-bearing kinds use their upstream payload accessor, qualified names concatenate their identifier components, and other kinds use checked source byte ranges; nodes must have payloads matching their Kind.
// @evidence contracts/common.md#clear-and-simple-design One kind dispatch separates semantic token text from qualified-name composition and the private source-range fallback, keeping the safety policy local.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Kind-specific cases reflect actual AST representations missing from upstream Text, and the range fallback does not patch that foreign method or special-case consumers.
// @evidence contracts/common.md#meaningful-documentation Native prose distinguishes token text from source spelling, documents nil and unavailable ranges, and states the payload premise using separated body and tag sections.
// @evidence contracts/performance.md#bound-retention-and-release-resources Qualified-name assembly uses temporary O(H) component references and transfers the assembled string to the caller; no handle or task is acquired. Direct payload and source-slice results may keep their backing text reachable, including a whole source string for a small slice. Caller references determine that lifetime; no independent cache or retained-byte cap is owned here.
// @evidence contracts/performance.md#efficient-algorithms A qualified chain of H links is collected once and its B output bytes are appended once with a builder, costing O(H+B) time and O(H+B) temporary/output space instead of repeatedly copying growing prefixes. Other valid kinds delegate text access; source fallback walks P parent links and trims W range bytes in O(P+W). Upstream composed text such as JSX namespace names retains its own byte-copy cost.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work This text query coordinates no completed-result cache or in-flight work; compiler-tree owners establish validity when sharing node spelling and source ranges across calls.
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
    var parts []string
    for n != nil && n.Kind == KindQualifiedName {
      qn := n.AsQualifiedName()
      if qn == nil {
        n = nil
        break
      }
      if qn.Right != nil {
        if text := qn.Right.Text(); text != "" {
          parts = append(parts, text)
        }
      }
      n = qn.Left
    }
    left := NodeText(n)
    if len(parts) == 0 {
      return left
    }
    var result strings.Builder
    result.WriteString(left)
    for i := len(parts) - 1; i >= 0; i-- {
      if result.Len() != 0 {
        result.WriteByte('.')
      }
      result.WriteString(parts[i])
    }
    return result.String()
  }
  return nodeSourceText(n)
}

// nodeSourceText checks the containing source range and trims surrounding
// whitespace. It does not perform scanner.GetTextOfNode's SkipTrivia step, so
// leading comments may remain. Kind-specific payloads are not inspected here;
// source ownership still requires a terminating, valid parent chain.
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

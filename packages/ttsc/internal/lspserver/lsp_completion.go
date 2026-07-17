package lspserver

import "strings"

// completionScopeJSDoc is the one scope a hint may claim today. It mirrors
// rule.HintScopeJSDoc; the wire carries the string, not the Go constant.
const completionScopeJSDoc = "jsdoc"

// matchCompletionHints returns the items that apply at a cursor, and the prefix
// the editor should filter them against.
//
// The longest matching After wins and only its items are offered. That single
// rule is what lets a corpus be layered without a query language: "@",
// "@evidence ", and "@evidence docs/spec.md#" can all be published at once, and
// the most specific one that matches is the one the user is actually inside.
// Equal-length triggers merge, because two rules answering the same position is
// a real thing and neither owns it.
func matchCompletionHints(
  hints []LSPCompletionHint,
  linePrefix string,
  inJSDoc bool,
) (items []LSPCompletionItem, filter string) {
  best := -1
  for _, hint := range hints {
    if !completionHintApplies(hint, linePrefix, inJSDoc) {
      continue
    }
    if len(hint.After) < best {
      continue
    }
    if len(hint.After) > best {
      best = len(hint.After)
      items = nil
      filter = linePrefix[strings.LastIndex(linePrefix, hint.After)+len(hint.After):]
    }
    items = append(items, hint.Items...)
  }
  return items, filter
}

func completionHintApplies(
  hint LSPCompletionHint,
  linePrefix string,
  inJSDoc bool,
) bool {
  if hint.After == "" || len(hint.Items) == 0 {
    return false
  }
  if hint.Scope == completionScopeJSDoc && !inJSDoc {
    return false
  }
  if hint.Scope != completionScopeJSDoc {
    // An unknown scope is refused rather than ignored. Treating it as
    // "anywhere" would make a hint from a newer plugin than this host fire in
    // every string literal — the one place a wrong guess is most visible and
    // least explicable.
    return false
  }
  return strings.Contains(linePrefix, hint.After)
}

// cursorInJSDoc reports whether an offset sits inside a `/** */` block.
//
// A plain backward scan for the nearest `/**` or `*/`, which is enough because
// the question is only ever asked about the cursor. It deliberately does not
// parse: the proxy holds text, not a tree, and reaching for tsgo's parser here
// would put a round trip on the keystroke path — the exact cost this design
// exists to avoid.
//
// Line comments are not considered: `// @evidence` is not a doc comment and a
// tag there means nothing to the rule that published the hint.
func cursorInJSDoc(text string, offset int) bool {
  if offset < 0 || offset > len(text) {
    return false
  }
  head := text[:offset]
  open := strings.LastIndex(head, "/**")
  if open == -1 {
    return false
  }
  close := strings.LastIndex(head, "*/")
  // `/**` is itself followed by no `*/` yet, or the last close precedes the
  // last open — either way the cursor is still inside the block.
  return close < open
}

// linePrefixAt returns the text from the start of the cursor's line up to the
// cursor.
//
// This is what a trigger matches against. It stops at the line start because a
// trigger is line-local by construction: a corpus that could match across lines
// would need the enclosing declaration, which the proxy does not have.
func linePrefixAt(text string, offset int) string {
  if offset < 0 || offset > len(text) {
    return ""
  }
  head := text[:offset]
  if start := strings.LastIndexAny(head, "\r\n"); start != -1 {
    return head[start+1:]
  }
  return head
}

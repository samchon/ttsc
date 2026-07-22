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
  if !completionHintTriggers(hint, linePrefix) {
    return false
  }
  if hint.Scope != completionScopeJSDoc {
    // An unknown scope is refused rather than ignored. Treating it as
    // "anywhere" would make a hint from a newer plugin than this host fire in
    // every string literal — the one place a wrong guess is most visible and
    // least explicable.
    return false
  }
  return inJSDoc
}

// completionHintTriggers reports whether a hint has something to offer and its
// trigger literal is present in the cursor's line.
//
// This is the half of the admission test that needs only the current line. It
// is split out so a caller can run it before deciding the cursor's lexical
// scope, which is the expensive half: the scope decision scans the document
// from byte zero, while this reads one line.
func completionHintTriggers(hint LSPCompletionHint, linePrefix string) bool {
  return hint.After != "" &&
    len(hint.Items) > 0 &&
    strings.Contains(linePrefix, hint.After)
}

// anyCompletionHintTriggers reports whether any hint's trigger appears in the
// line, meaning the corpus could contribute here and the scope is worth
// deciding.
//
// When it answers false no hint can apply whatever the scope turns out to be,
// because completionHintApplies requires the same trigger test — so the
// document scan behind that decision would produce an answer nothing reads.
// That is the overwhelmingly common case while typing: a corpus triggers on
// "@" or "@evidence ", and most lines contain neither.
func anyCompletionHintTriggers(hints []LSPCompletionHint, linePrefix string) bool {
  for _, hint := range hints {
    if completionHintTriggers(hint, linePrefix) {
      return true
    }
  }
  return false
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

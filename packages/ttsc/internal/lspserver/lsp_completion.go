package lspserver

import "strings"

// completionScopeJSDoc is the one scope a hint may claim today. It mirrors
// rule.HintScopeJSDoc; the wire carries the string, not the Go constant.
const completionScopeJSDoc = "jsdoc"

// matchCompletionHints returns the items that apply at a cursor, and the prefix
// the editor should filter them against.
//
// The cursor-nearest matching After wins; at the same occurrence, the longest
// trigger wins. That lets a corpus be layered without a query language while
// ensuring a later trigger is never eclipsed by an earlier, longer one. Rules
// merge only when they name the same trigger at the winning occurrence.
func matchCompletionHints(
  hints []LSPCompletionHint,
  linePrefix string,
  inJSDoc bool,
) (items []LSPCompletionItem, filter string) {
  bestStart := -1
  bestLength := -1
  bestAfter := ""
  for _, hint := range hints {
    if !completionHintApplies(hint, linePrefix, inJSDoc) {
      continue
    }
    start := strings.LastIndex(linePrefix, hint.After)
    if start < bestStart || (start == bestStart && len(hint.After) < bestLength) {
      continue
    }
    if start > bestStart || len(hint.After) > bestLength {
      bestStart = start
      bestLength = len(hint.After)
      bestAfter = hint.After
      items = nil
      filter = linePrefix[start+len(hint.After):]
    }
    if start != bestStart || hint.After != bestAfter {
      continue
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
  return completionHintCouldApply(hint, linePrefix) && inJSDoc
}

// completionHintCouldApply reports every part of a hint's admission that does
// not depend on where the cursor sits lexically: that the hint has something to
// offer, that its scope is one this host knows, and that its trigger literal is
// on the current line.
//
// Split out because the remaining condition is the expensive one. Deciding the
// cursor's scope scans the document from byte zero, while all of this reads one
// line, so a caller can find out whether that scan can change any answer before
// paying for it.
func completionHintCouldApply(hint LSPCompletionHint, linePrefix string) bool {
  if hint.After == "" || len(hint.Items) == 0 {
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

// anyCompletionHintCouldApply reports whether the cursor's lexical scope can
// change any hint's answer here, and therefore whether it is worth deciding.
//
// When it answers false, completionHintApplies refuses every hint on grounds
// the scope cannot rescue, so the document scan behind that decision would
// produce an answer nothing reads. That is the overwhelmingly common case while
// typing: a corpus triggers on "@" or "@evidence ", and most lines hold neither.
func anyCompletionHintCouldApply(hints []LSPCompletionHint, linePrefix string) bool {
  for _, hint := range hints {
    if completionHintCouldApply(hint, linePrefix) {
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

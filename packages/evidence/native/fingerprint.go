package evidence

import (
  "crypto/sha256"
  "encoding/hex"
  "sort"
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

// normalizeFingerprintText puts content into the one form every platform agrees
// on before it is hashed.
//
// Line endings collapse and trailing whitespace per line is dropped, because a
// consumer's `core.autocrlf` and `.gitattributes` are outside this repository's
// control. A digest over raw bytes would expire every review on a CRLF checkout
// and none on an LF checkout of the same commit, which is a stale report whose
// repair no author can perform. A reformat that changes no content must not
// expire a review either, and leading whitespace is kept because in Markdown and
// TypeScript alike it can carry structure.
func normalizeFingerprintText(text string) string {
  text = strings.ReplaceAll(text, "\r\n", "\n")
  text = strings.ReplaceAll(text, "\r", "\n")
  lines := strings.Split(text, "\n")
  for index, line := range lines {
    lines[index] = strings.TrimRight(line, " \t")
  }
  // Trailing blank lines say nothing about content and appear or vanish with an
  // editor's final-newline setting.
  for len(lines) != 0 && lines[len(lines)-1] == "" {
    lines = lines[:len(lines)-1]
  }
  // Leading blank lines go for a sharper reason. A TypeScript node's position is
  // its *full* start, meaning the end of the previous token, so an undocumented
  // declaration's span begins with whatever blank lines and `//` comments sit
  // above it. Keeping them made inserting one blank line elsewhere in the file
  // expire a review, and inconsistently: the same edit above a *documented*
  // declaration is neutral, because the whole leading run through `*/` is
  // excluded as a tag position. Dropping them makes both cases agree and honors
  // the rule that a reformat which changes no content expires nothing.
  return strings.Join(lines, "\n")
}

// withoutLeadingTrivia drops the leading run a TypeScript span carries but does
// not own.
//
// A node's position is its full start, so an undocumented declaration's text
// begins at the previous token and arrives with the blank lines and `//` comments
// above it. Those are not content of the declaration: keeping them made inserting
// a blank line elsewhere expire a review, and inconsistently, because above a
// *documented* declaration the whole leading run through the block is already
// excluded as a tag position.
//
// Only the leading run, and only for TypeScript. An interior comment is part of
// what the author wrote inside the body, and in Markdown a line opening with `//`
// is ordinary prose that must keep counting.
func withoutLeadingTrivia(text string) string {
  lines := strings.Split(text, "\n")
  for len(lines) != 0 {
    first := strings.TrimSpace(lines[0])
    if first != "" && !strings.HasPrefix(first, "//") {
      break
    }
    lines = lines[1:]
  }
  return strings.Join(lines, "\n")
}

// contentDigest is the digest of one unit's own content.
func contentDigest(text string) string {
  sum := sha256.Sum256([]byte(normalizeFingerprintText(text)))
  return hex.EncodeToString(sum[:])
}

// scopeIndex answers what a citation of one unit has to name, over one
// reference's whole materialized population.
//
// The scope of a citation is the unit plus every structural descendant, and it is
// deliberately **not** the reference's covered set. `UnitsByScope` and `Units` are
// both narrowed by that reference's `symbol` selector, while one `@evidence` tag
// may acknowledge several references and carries exactly one fingerprint token.
// Composing from a narrowed set made the value a function of the reference: a
// selector that skipped the descendants left them out of the digest, so the
// review never expired, and two references over one scope under different
// selectors demanded two different values from that single token with no value
// able to satisfy both. The population is passed instead, which is why this type
// exists rather than a function over `Units`.
//
// So the fingerprint is a property of the address a citation names rather than of
// what the citation discharges. A reference confining acknowledgement to the
// named unit does not narrow this: the citation still names the scope, and
// re-reviewing when the subtree moves is conservative rather than wrong.
//
// Descendants are found through the stored parent identity, never through a
// shared address prefix. A literal dot may sit inside a TypeScript name, so
// treating a common prefix as ownership would make an unrelated same-name
// declaration an ancestor.
//
// A withdrawn descendant contributes its identity, so adding `@internal` to a
// member moves the composite: the tag's own block is excluded as a tag position,
// which would otherwise make a withdrawal invisible.
//
// Its content is **not** separable from its ancestor's, and an earlier version of
// this comment claimed otherwise. A TypeScript unit's digest is its whole
// declaration text, so a withdrawn member's body is already inside the enclosing
// type's digest and no substitution here can take it out. Churn behind
// `@internal` therefore does expire a review of the enclosing type. That is
// conservative noise rather than a wrong answer, and the honest trade: removing it
// means excluding every child unit's span from its ancestor's text, which is a
// second exclusion mechanism layered on the tag-position one.
//
// The index is built once per reference and the answers are memoized, because
// building it per citation is quadratic and the cost is not theoretical: it spans
// the whole population, so a claim with a citation per selected unit would walk
// every unit once per citation. On a requirements set of a few thousand headings
// that is millions of map inserts per Program cycle, paid again on every watch
// rebuild, for a value that is identical each time.
type scopeIndex struct {
  byID     map[string]*evidenceUnit
  children map[string][]*evidenceUnit
  cache    map[string]string
}

func newScopeIndex(units []*evidenceUnit) *scopeIndex {
  index := &scopeIndex{
    byID:     make(map[string]*evidenceUnit, len(units)),
    children: map[string][]*evidenceUnit{},
    cache:    map[string]string{},
  }
  for _, unit := range units {
    if unit == nil || index.byID[unit.ID] != nil {
      continue
    }
    index.byID[unit.ID] = unit
    if unit.ParentID != "" {
      index.children[unit.ParentID] = append(index.children[unit.ParentID], unit)
    }
  }
  return index
}

// fingerprint answers for one cited scope, remembering the answer.
//
// Several citations of one scope are ordinary — a reference may be acknowledged
// by many hosts — so the memo matters as much as the shared index.
func (index *scopeIndex) fingerprint(rootID string) string {
  if index == nil || rootID == "" {
    return ""
  }
  if remembered, seen := index.cache[rootID]; seen {
    return remembered
  }
  computed := index.compute(rootID)
  index.cache[rootID] = computed
  return computed
}

func (index *scopeIndex) compute(rootID string) string {
  scope := index.collect(rootID)
  if len(scope) == 0 {
    return ""
  }
  // Ordered by address rather than by walk order, so the value does not depend
  // on which file the loader happened to read first, and by symbol as well
  // because two same-titled Markdown headings answer to one anchor.
  sort.Slice(scope, func(left int, right int) bool {
    if scope[left].Target != scope[right].Target {
      return scope[left].Target < scope[right].Target
    }
    if scope[left].Symbol != scope[right].Symbol {
      return scope[left].Symbol < scope[right].Symbol
    }
    return scope[left].Digest < scope[right].Digest
  })
  composite := sha256.New()
  for _, unit := range scope {
    // NUL separates the fields because a target may contain any printable
    // character, and a joined pair that can be re-split ambiguously lets two
    // different scopes compose one digest.
    composite.Write([]byte(unit.Target))
    composite.Write([]byte{0})
    composite.Write([]byte(unit.Symbol))
    composite.Write([]byte{0})
    composite.Write([]byte(scopeContribution(unit)))
    composite.Write([]byte{0})
  }
  return presentedFingerprint(hex.EncodeToString(composite.Sum(nil)))
}

// scopeContribution is what one unit adds to its scope's composite.
//
// A withdrawn unit contributes the tag that withdrew it. That is what makes a
// withdrawal visible at all, since the tag lives in a documentation block and
// every such block is excluded as a tag position, so the enclosing declaration's
// text is unchanged by adding one.
//
// It does not make the withdrawn member's content invisible. For TypeScript that
// content sits inside its ancestor's declaration text, which is that ancestor's
// digest; see `evidenceUnit.Digest`.
func scopeContribution(unit *evidenceUnit) string {
  if unit.Hidden != "" {
    return "\x00withdrawn:" + unit.Hidden
  }
  return unit.Digest
}

// collect gathers one unit and every structural descendant.
func (index *scopeIndex) collect(rootID string) []*evidenceUnit {
  children := index.children
  root := index.byID[rootID]
  if root == nil {
    return nil
  }
  scope := []*evidenceUnit{}
  // Iterative rather than recursive, and guarded by a visited set: parent
  // identities are stored while materializing, and a cycle there would
  // otherwise hang the compiler instead of reporting anything.
  visited := map[string]bool{}
  queue := []*evidenceUnit{root}
  for len(queue) != 0 {
    current := queue[0]
    queue = queue[1:]
    if current == nil || visited[current.ID] {
      continue
    }
    visited[current.ID] = true
    scope = append(scope, current)
    queue = append(queue, children[current.ID]...)
  }
  return scope
}

// presentedFingerprint shortens a digest to what a tag carries.
func presentedFingerprint(digest string) string {
  if len(digest) <= reviewFingerprintLength {
    return digest
  }
  return digest[:reviewFingerprintLength]
}

// typeScriptUnitDigest hashes one identity's declarations with every
// documentation block removed.
//
// A JSDoc block is the only place a TypeScript citation or review can live, so
// removing exactly those spans is the general form of "exclude every position a
// tag can occupy". Removing only the block that happens to carry a tag would
// leave the case that breaks first: a property's own JSDoc is interior text of
// the interface containing it, so writing a review on one property would change
// the digest of every citation of the enclosing type.
//
// Blocks are collected from the whole subtree rather than from the declaration
// alone, for that same reason. An ordinary comment interior to the declaration
// stays in the digest, and that is correct: the graph reads tags only from the
// blocks a node reports, so no citation can hide in one. A comment that is
// merely leading trivia of the declaration is a different thing and does not
// reach the digest — `withoutLeadingTrivia` drops the blank lines and `//`
// comments a full start swallowed, and a comment above a sibling declarator
// lies outside this declaration's span to begin with.
//
// Every declaration of a merged identity contributes, in source order, because
// `interface I` beside `namespace I` is one unit whose content is both halves.
func typeScriptUnitDigest(
  file *shimast.SourceFile,
  nodes []*shimast.Node,
) string {
  if file == nil || len(nodes) == 0 {
    return ""
  }
  content := file.Text()
  ordered := make([]*shimast.Node, 0, len(nodes))
  for _, node := range nodes {
    if node == nil || node.Pos() < 0 || node.End() > len(content) || node.Pos() >= node.End() {
      continue
    }
    ordered = append(ordered, node)
  }
  if len(ordered) == 0 {
    return ""
  }
  sort.SliceStable(ordered, func(left int, right int) bool {
    return ordered[left].Pos() < ordered[right].Pos()
  })
  builder := strings.Builder{}
  for _, node := range ordered {
    builder.WriteString(
      withoutLeadingTrivia(withoutDocumentationSpans(content, node, file)),
    )
    builder.WriteByte(0)
  }
  return contentDigest(builder.String())
}

// withoutDocumentationSpans renders one declaration's text with its subtree's
// documentation blocks cut out.
func withoutDocumentationSpans(
  content string,
  node *shimast.Node,
  file *shimast.SourceFile,
) string {
  type span struct {
    start int
    end   int
  }
  excluded := []span{}
  walkTypeScriptNode(node, func(current *shimast.Node) {
    for _, doc := range current.JSDoc(file) {
      if doc == nil {
        continue
      }
      start, end := doc.Pos(), doc.End()
      if start < node.Pos() || end > node.End() || start >= end {
        continue
      }
      excluded = append(excluded, span{start: start, end: end})
    }
  })
  if len(excluded) == 0 {
    return content[node.Pos():node.End()]
  }
  sort.Slice(excluded, func(left int, right int) bool {
    if excluded[left].start != excluded[right].start {
      return excluded[left].start < excluded[right].start
    }
    return excluded[left].end < excluded[right].end
  })
  builder := strings.Builder{}
  cursor := node.Pos()
  for _, current := range excluded {
    // Overlapping and duplicate spans are expected: TypeScript cascades one
    // leading block onto nested nodes, so several nodes report the same
    // comment. Advancing the cursor monotonically collapses them instead of
    // emitting text twice or slicing backwards.
    if current.end <= cursor {
      continue
    }
    if current.start > cursor {
      builder.WriteString(content[cursor:current.start])
    }
    cursor = current.end
  }
  if cursor < node.End() {
    builder.WriteString(content[cursor:node.End()])
  }
  return builder.String()
}

// regex_tree_optimizer.go is a behavioral port of regexp-tree's optimizer —
// the engine behind the upstream unicorn/better-regex rule. Each transform
// below mirrors one module under regexp-tree/src/optimizer/transforms, and
// the pipeline reproduces the upstream driver: run every transform once per
// round, accept a transform's whole-tree mutation only when the regenerated
// literal is not longer (measured in UTF-16 units, the way JavaScript's
// String#length measures it), and repeat rounds until a full round changes
// nothing.
//
// Fidelity notes:
//   - The accept/rollback bookkeeping intentionally replicates the upstream
//     aliasing behavior (a rejected transform that runs after an accepted
//     one in the same round leaves its mutation on the working tree while
//     the accepted snapshot string stays authoritative); see regexOptimize.
//   - Node equality goes through regexEqualityKey, which reproduces the
//     JSON-encoding distinctions upstream equality checks rely on (field
//     presence and construction-site key order), so the same duplicates
//     collapse and the same near-duplicates survive.
//   - Deviations are safety fixes marked "SAFETY:"; each prevents a rewrite
//     that would change what the regex matches.
package linthost

import (
  "fmt"
  "math"
  "sort"
  "strings"
  "unicode"
)

// regexOptimizeLiteral runs the full optimizer over a `/pattern/flags`
// literal string and returns the optimized literal.
func regexOptimizeLiteral(literal string, blacklist map[string]bool) (string, error) {
  ast, err := regexParseLiteral(literal)
  if err != nil {
    return "", err
  }
  return regexOptimize(ast, blacklist), nil
}

type regexTransform struct {
  name      string
  shouldRun func(*regexRegExpNode) bool
  run       func(*regexRegExpNode)
}

var regexTransformList = []regexTransform{
  {
    name:      "charSurrogatePairToSingleUnicode",
    shouldRun: func(re *regexRegExpNode) bool { return strings.ContainsRune(re.Flags, 'u') },
    run:       regexTransformSurrogatePairs,
  },
  {name: "charCodeToSimpleChar", run: regexTransformCharCodeToSimple},
  {
    name:      "charCaseInsensitiveLowerCaseTransform",
    shouldRun: func(re *regexRegExpNode) bool { return strings.ContainsRune(re.Flags, 'i') },
    run:       regexTransformCaseInsensitiveLower,
  },
  {name: "charClassRemoveDuplicates", run: regexTransformClassRemoveDuplicates},
  {name: "quantifiersMerge", run: regexTransformQuantifiersMerge},
  {name: "quantifierRangeToSymbol", run: regexTransformQuantifierRangeToSymbol},
  {name: "charClassClassrangesToChars", run: regexTransformClassRangesToChars},
  {name: "charClassToMeta", run: regexTransformClassToMeta},
  {name: "charClassToSingleChar", run: regexTransformClassToSingleChar},
  {name: "charEscapeUnescape", run: regexTransformEscapeUnescape},
  {name: "charClassClassrangesMerge", run: regexTransformClassRangesMerge},
  {name: "disjunctionRemoveDuplicates", run: regexTransformDisjunctionRemoveDuplicates},
  {name: "groupSingleCharsToCharClass", run: regexTransformGroupSingleCharsToClass},
  {name: "removeEmptyGroup", run: regexTransformRemoveEmptyGroup},
  {name: "ungroup", run: regexTransformUngroup},
  {name: "combineRepeatingPatterns", run: regexTransformCombineRepeating},
}

// regexOptimize is the upstream optimizer driver. `result` is the last
// accepted tree and resultStr its snapshot string; `ast` is the working
// tree. After an acceptance both names alias one tree, exactly like the
// upstream TransformResult/ast aliasing, so a later rejection in the same
// round clones the (already mutated) working tree — replicating upstream's
// observable accept/reject sequence rather than an idealized one.
func regexOptimize(parsed *regexRegExpNode, blacklist map[string]bool) string {
  result := parsed
  resultStr := regexGenerate(result)
  for {
    prev := resultStr
    ast := regexCloneRegExp(result)
    for _, t := range regexTransformList {
      if blacklist[t.name] {
        continue
      }
      if t.shouldRun != nil && !t.shouldRun(ast) {
        continue
      }
      t.run(ast)
      newStr := regexGenerate(ast)
      if newStr != resultStr {
        if regexUTF16Length(newStr) <= regexUTF16Length(resultStr) {
          result = ast
          resultStr = newStr
        } else {
          ast = regexCloneRegExp(result)
        }
      }
    }
    if resultStr == prev {
      break
    }
  }
  return resultStr
}

// ---------------------------------------------------------------------------
// Generic pre-order walker
// ---------------------------------------------------------------------------

// regexIterState carries a live list-iteration index that removal/insert
// helpers adjust, mirroring regexp-tree's traversingIndex bookkeeping.
type regexIterState struct {
  i int
}

// regexSlot describes where the currently visited node lives so a visitor
// can replace or remove it, inspect its parent, and mutate siblings.
type regexSlot struct {
  parent regexNode       // enclosing node; the *regexRegExpNode for the body
  list   *[]regexNode    // non-nil when the node is a list element
  index  int             // element index when list != nil, else -1
  iter   *regexIterState // iteration state for the enclosing list walk
  single *regexNode      // non-nil when the node sits in a single-child field
  // rangeFrom/rangeTo point at ClassRange char fields.
  rangeFrom **regexCharNode
  rangeTo   **regexCharNode
}

func (s *regexSlot) parentType() string {
  switch s.parent.(type) {
  case *regexRegExpNode:
    return "RegExp"
  case *regexAlternativeNode:
    return "Alternative"
  case *regexDisjunctionNode:
    return "Disjunction"
  case *regexGroupNode:
    return "Group"
  case *regexRepetitionNode:
    return "Repetition"
  case *regexAssertionNode:
    return "Assertion"
  case *regexClassNode:
    return "CharacterClass"
  case *regexClassRangeNode:
    return "ClassRange"
  }
  return ""
}

// get re-reads the node currently in the slot (replacement-aware).
func (s *regexSlot) get() regexNode {
  switch {
  case s.list != nil:
    if s.index < 0 || s.index >= len(*s.list) {
      return nil
    }
    return (*s.list)[s.index]
  case s.single != nil:
    return *s.single
  case s.rangeFrom != nil:
    return *s.rangeFrom
  case s.rangeTo != nil:
    return *s.rangeTo
  }
  return nil
}

// set replaces the node in the slot.
func (s *regexSlot) set(node regexNode) {
  switch {
  case s.list != nil:
    (*s.list)[s.index] = node
  case s.single != nil:
    *s.single = node
  case s.rangeFrom != nil:
    if ch, ok := node.(*regexCharNode); ok {
      *s.rangeFrom = ch
    }
  case s.rangeTo != nil:
    if ch, ok := node.(*regexCharNode); ok {
      *s.rangeTo = ch
    }
  }
}

// remove deletes the node from its slot: list elements are spliced out
// (adjusting the live iteration index), single-child fields become nil.
func (s *regexSlot) remove() {
  if s.list != nil {
    regexListRemove(s.list, s.iter, s.index)
    return
  }
  if s.single != nil {
    *s.single = nil
  }
}

func regexListRemove(list *[]regexNode, iter *regexIterState, idx int) {
  if idx < 0 || idx >= len(*list) {
    return
  }
  *list = append((*list)[:idx], (*list)[idx+1:]...)
  if iter != nil && idx <= iter.i {
    iter.i--
  }
}

func regexListInsert(list *[]regexNode, iter *regexIterState, idx int, node regexNode) {
  *list = append(*list, nil)
  copy((*list)[idx+1:], (*list)[idx:])
  (*list)[idx] = node
  if iter != nil && idx <= iter.i {
    iter.i++
  }
}

// regexWalk visits every node pre-order; children are visited in the same
// property order as regexp-tree's traversal. After the visitor runs, the
// slot is re-read so a replacement's children are the ones descended into.
func regexWalk(re *regexRegExpNode, visit func(node regexNode, slot *regexSlot)) {
  slot := &regexSlot{parent: re, single: &re.Body, index: -1}
  regexWalkSlot(slot, visit)
}

func regexWalkSlot(slot *regexSlot, visit func(node regexNode, slot *regexSlot)) {
  node := slot.get()
  if node == nil {
    return
  }
  visit(node, slot)
  node = slot.get() // replacement-aware re-read
  switch n := node.(type) {
  case *regexAlternativeNode:
    regexWalkList(n, &n.Expressions, visit)
  case *regexClassNode:
    regexWalkList(n, &n.Expressions, visit)
  case *regexDisjunctionNode:
    regexWalkSlot(&regexSlot{parent: n, single: &n.Left, index: -1}, visit)
    regexWalkSlot(&regexSlot{parent: n, single: &n.Right, index: -1}, visit)
  case *regexGroupNode:
    regexWalkSlot(&regexSlot{parent: n, single: &n.Expression, index: -1}, visit)
  case *regexRepetitionNode:
    regexWalkSlot(&regexSlot{parent: n, single: &n.Expression, index: -1}, visit)
    if n.Quantifier != nil {
      visit(n.Quantifier, &regexSlot{parent: n, index: -1})
    }
  case *regexAssertionNode:
    regexWalkSlot(&regexSlot{parent: n, single: &n.Assertion, index: -1}, visit)
  case *regexClassRangeNode:
    regexWalkSlot(&regexSlot{parent: n, rangeFrom: &n.From, index: -1}, visit)
    regexWalkSlot(&regexSlot{parent: n, rangeTo: &n.To, index: -1}, visit)
  }
}

func regexWalkList(parent regexNode, list *[]regexNode, visit func(node regexNode, slot *regexSlot)) {
  iter := &regexIterState{}
  for iter.i = 0; iter.i < len(*list); iter.i++ {
    slot := &regexSlot{parent: parent, list: list, index: iter.i, iter: iter}
    regexWalkSlot(slot, visit)
  }
}

// ---------------------------------------------------------------------------
// charSurrogatePairToSingleUnicode
// ---------------------------------------------------------------------------

// 🚀 -> \u{1f680} (u flag only; the rule skips u-flag literals, so
// this stays for constructor-path completeness and pipeline parity).
func regexTransformSurrogatePairs(re *regexRegExpNode) {
  regexWalk(re, func(node regexNode, _ *regexSlot) {
    ch, ok := node.(*regexCharNode)
    if !ok || ch.Kind != "unicode" || !ch.SurrogatePair || ch.codePointIsNaN() {
      return
    }
    ch.Value = fmt.Sprintf("\\u{%x}", ch.CodePoint)
    ch.SurrogatePair = false
  })
}

// ---------------------------------------------------------------------------
// charCodeToSimpleChar
// ---------------------------------------------------------------------------

// a -> a
func regexTransformCharCodeToSimple(re *regexRegExpNode) {
  regexWalk(re, func(node regexNode, slot *regexSlot) {
    ch, ok := node.(*regexCharNode)
    if !ok || ch.codePointIsNaN() || ch.Kind == "simple" {
      return
    }
    parentType := slot.parentType()
    if cr, isRange := slot.parent.(*regexClassRangeNode); isRange {
      if !regexIsSimpleRange(cr) {
        return
      }
    }
    if ch.CodePoint < 0x20 || ch.CodePoint > 0x7e {
      return
    }
    symbol := string(rune(ch.CodePoint))
    newChar := &regexCharNode{
      Value: symbol, Kind: "simple",
      Symbol: symbol, SymbolState: regexFieldValue,
      CodePoint: ch.CodePoint, CodePointState: regexFieldValue,
      AltKeyOrder: true,
    }
    if regexNeedsEscape(symbol, parentType) {
      newChar.Escaped = true
      newChar.EscapedState = regexFieldValue
    }
    slot.set(newChar)
  })
}

// regexIsSimpleRange reports whether a range lies within 0-9, a-z, or A-Z.
func regexIsSimpleRange(cr *regexClassRangeNode) bool {
  if cr.From.codePointIsNaN() || cr.To.codePointIsNaN() {
    return false
  }
  from, to := cr.From.CodePoint, cr.To.CodePoint
  within := func(lo, hi int) bool { return from >= lo && from <= hi && to >= lo && to <= hi }
  return within('0', '9') || within('A', 'Z') || within('a', 'z')
}

func regexNeedsEscape(symbol, parentType string) bool {
  if parentType == "ClassRange" || parentType == "CharacterClass" {
    return strings.ContainsAny(symbol, "]\\^-")
  }
  return strings.ContainsAny(symbol, "*[()+?^$./\\|{}")
}

// ---------------------------------------------------------------------------
// charCaseInsensitiveLowerCaseTransform
// ---------------------------------------------------------------------------

// /AaBb/i -> /aabb/i
func regexTransformCaseInsensitiveLower(re *regexRegExpNode) {
  hasUFlag := strings.ContainsRune(re.Flags, 'u')
  azRanges := map[*regexClassRangeNode]bool{}
  regexWalk(re, func(node regexNode, slot *regexSlot) {
    ch, ok := node.(*regexCharNode)
    if !ok || ch.codePointIsNaN() {
      return
    }
    if !hasUFlag && ch.CodePoint >= 0x1000 {
      // Case-insensitive matching without the u flag is unreliable
      // above က in engines; upstream skips those too.
      return
    }
    if cr, isRange := slot.parent.(*regexClassRangeNode); isRange {
      if !azRanges[cr] && !regexIsAZClassRange(cr) {
        return
      }
      azRanges[cr] = true
    }
    r := rune(ch.CodePoint)
    // SAFETY: U+0130 (İ) is the one uppercase letter whose full lowercase
    // mapping is multi-character ("i" + combining dot). Upstream lowercases
    // it through String#toLowerCase and then truncates to the first code
    // point, silently dropping the combining mark; skip it instead.
    if r == 0x130 {
      return
    }
    lower := unicode.ToLower(r)
    if lower == r {
      return
    }
    ch.Value = regexDisplaySymbolAsValue(lower, ch)
    ch.Symbol = string(lower)
    ch.SymbolState = regexFieldValue
    ch.CodePoint = int(lower)
    ch.CodePointState = regexFieldValue
  })
}

func regexIsAZClassRange(cr *regexClassRangeNode) bool {
  if cr.From.codePointIsNaN() || cr.To.codePointIsNaN() {
    return false
  }
  return cr.From.CodePoint >= 'A' && cr.From.CodePoint <= 'Z' &&
    cr.To.CodePoint >= 'A' && cr.To.CodePoint <= 'Z'
}

// regexDisplaySymbolAsValue re-spells a code point in the same escape
// family the original char used.
func regexDisplaySymbolAsValue(r rune, node *regexCharNode) string {
  cp := int(r)
  switch node.Kind {
  case "decimal":
    return fmt.Sprintf("\\%d", cp)
  case "oct":
    // SAFETY: upstream prints "\0" + octal digits, which misparses for
    // values above 0o77 (the leading 0 caps the legacy octal at three
    // digits). Print the plain legacy octal spelling instead.
    return fmt.Sprintf("\\%o", cp)
  case "hex":
    return fmt.Sprintf("\\x%x", cp)
  case "unicode":
    if node.SurrogatePair {
      lead := 0xd800 + (cp-0x10000)/0x400
      trail := 0xdc00 + (cp-0x10000)%0x400
      return fmt.Sprintf("\\u%04x\\u%04x", lead, trail)
    }
    if strings.Contains(node.Value, "{") {
      return fmt.Sprintf("\\u{%x}", cp)
    }
    return fmt.Sprintf("\\u%04x", cp)
  }
  return string(r)
}

// ---------------------------------------------------------------------------
// charClassRemoveDuplicates
// ---------------------------------------------------------------------------

// [\d\d] -> [\d]
func regexTransformClassRemoveDuplicates(re *regexRegExpNode) {
  regexWalk(re, func(node regexNode, _ *regexSlot) {
    class, ok := node.(*regexClassNode)
    if !ok {
      return
    }
    seen := map[string]bool{}
    for i := 0; i < len(class.Expressions); i++ {
      key := regexEqualityKey(class.Expressions[i])
      if seen[key] {
        class.Expressions = append(class.Expressions[:i], class.Expressions[i+1:]...)
        i--
        continue
      }
      seen[key] = true
    }
  })
}

// ---------------------------------------------------------------------------
// quantifiersMerge
// ---------------------------------------------------------------------------

// a{1,2}a{2,3} -> a{3,5}
func regexTransformQuantifiersMerge(re *regexRegExpNode) {
  regexWalk(re, func(node regexNode, slot *regexSlot) {
    rep, ok := node.(*regexRepetitionNode)
    if !ok {
      return
    }
    if _, inAlt := slot.parent.(*regexAlternativeNode); !inAlt || slot.list == nil || slot.index == 0 {
      return
    }
    prev := (*slot.list)[slot.index-1]
    if prevRep, isRep := prev.(*regexRepetitionNode); isRep {
      if regexEqualityKey(prevRep.Expression) != regexEqualityKey(rep.Expression) {
        return
      }
      prevFrom, prevTo, prevHasTo := regexExtractFromTo(prevRep.Quantifier)
      nodeFrom, nodeTo, nodeHasTo := regexExtractFromTo(rep.Quantifier)
      if prevRep.Quantifier.Greedy != rep.Quantifier.Greedy &&
        !regexIsGreedyOpenRange(prevRep.Quantifier) &&
        !regexIsGreedyOpenRange(rep.Quantifier) {
        return
      }
      q := rep.Quantifier
      q.Kind = "Range"
      q.setFrom(prevFrom + nodeFrom)
      if prevHasTo && nodeHasTo {
        q.setTo(prevTo + nodeTo)
      } else {
        q.deleteTo()
      }
      if regexIsGreedyOpenRange(prevRep.Quantifier) || regexIsGreedyOpenRange(q) {
        q.Greedy = true
      }
      regexListRemove(slot.list, slot.iter, slot.index-1)
      return
    }
    if regexEqualityKey(prev) != regexEqualityKey(rep.Expression) {
      return
    }
    regexIncreaseQuantifierByOne(rep.Quantifier)
    regexListRemove(slot.list, slot.iter, slot.index-1)
  })
}

// setFrom / setTo / deleteTo mirror JavaScript object-key mechanics: a
// (re)assigned key that is absent appends to the key order, deletion
// removes it. FieldOrder feeds the equality encoding only.
func (q *regexQuantifierNode) setFrom(v int) {
  q.From = v
  if !strings.ContainsRune(q.FieldOrder, 'f') {
    q.FieldOrder += "f"
  }
}

func (q *regexQuantifierNode) setTo(v int) {
  q.To = v
  q.HasTo = true
  if !strings.ContainsRune(q.FieldOrder, 't') {
    q.FieldOrder += "t"
  }
}

func (q *regexQuantifierNode) deleteTo() {
  q.HasTo = false
  q.FieldOrder = strings.ReplaceAll(q.FieldOrder, "t", "")
}

func (q *regexQuantifierNode) deleteFrom() {
  q.FieldOrder = strings.ReplaceAll(q.FieldOrder, "f", "")
}

func (q *regexQuantifierNode) hasFrom() bool {
  return strings.ContainsRune(q.FieldOrder, 'f')
}

// regexExtractFromTo mirrors the upstream extractFromTo, including the
// JavaScript falsiness of a zero `to` (treated as absent).
func regexExtractFromTo(q *regexQuantifierNode) (int, int, bool) {
  switch q.Kind {
  case "*":
    return 0, 0, false
  case "+":
    return 1, 0, false
  case "?":
    return 0, 1, true
  }
  if q.HasTo && q.To != 0 {
    return q.From, q.To, true
  }
  return q.From, 0, false
}

func regexIsGreedyOpenRange(q *regexQuantifierNode) bool {
  return q.Greedy &&
    (q.Kind == "+" || q.Kind == "*" ||
      (q.Kind == "Range" && (!q.HasTo || q.To == 0)))
}

// regexIncreaseQuantifierByOne mirrors transform/utils.js.
func regexIncreaseQuantifierByOne(q *regexQuantifierNode) {
  switch q.Kind {
  case "*":
    q.Kind = "+"
  case "+":
    q.Kind = "Range"
    q.setFrom(2)
    q.deleteTo()
  case "?":
    q.Kind = "Range"
    q.setFrom(1)
    q.setTo(2)
  case "Range":
    q.From++
    if q.HasTo && q.To != 0 {
      q.To++
    }
  }
}

// ---------------------------------------------------------------------------
// quantifierRangeToSymbol
// ---------------------------------------------------------------------------

// a{0,} -> a*, a{1,} -> a+, a{1} -> a
//
// Note: regexp-tree 0.1.27 (the release the upstream rule depended on) has
// no `a{0,1} -> a?` rewrite; that arrived on master only. `{0,1}` stays.
func regexTransformQuantifierRangeToSymbol(re *regexRegExpNode) {
  regexWalk(re, func(node regexNode, slot *regexSlot) {
    rep, ok := node.(*regexRepetitionNode)
    if !ok || rep.Quantifier == nil || rep.Quantifier.Kind != "Range" {
      return
    }
    q := rep.Quantifier
    truthyTo := q.HasTo && q.To != 0
    // a{0,} -> a*
    if q.hasFrom() && q.From == 0 && !truthyTo {
      q.Kind = "*"
      q.deleteFrom()
      return
    }
    // a{1,} -> a+
    if q.hasFrom() && q.From == 1 && !truthyTo {
      q.Kind = "+"
      q.deleteFrom()
      return
    }
    // a{1} -> a
    if q.hasFrom() && q.From == 1 && q.HasTo && q.To == 1 {
      slot.set(rep.Expression)
    }
  })
}

// ---------------------------------------------------------------------------
// charClassClassrangesToChars
// ---------------------------------------------------------------------------

// [a-a] -> [a], [a-b] -> [ab]
func regexTransformClassRangesToChars(re *regexRegExpNode) {
  regexWalk(re, func(node regexNode, slot *regexSlot) {
    cr, ok := node.(*regexClassRangeNode)
    if !ok || slot.list == nil {
      return
    }
    if cr.From.codePointIsNaN() || cr.To.codePointIsNaN() {
      return
    }
    if cr.From.CodePoint == cr.To.CodePoint {
      slot.set(cr.From)
      return
    }
    if cr.From.CodePoint == cr.To.CodePoint-1 {
      regexListInsert(slot.list, slot.iter, slot.index+1, cr.To)
      slot.set(cr.From)
    }
  })
}

// ---------------------------------------------------------------------------
// charClassToMeta
// ---------------------------------------------------------------------------

// [0-9] -> [\d], [a-zA-Z_0-9] -> [\w], whitespace batch -> [\s]
func regexTransformClassToMeta(re *regexRegExpNode) {
  hasIFlag := strings.ContainsRune(re.Flags, 'i')
  hasUFlag := strings.ContainsRune(re.Flags, 'u')
  regexWalk(re, func(node regexNode, _ *regexSlot) {
    class, ok := node.(*regexClassNode)
    if !ok {
      return
    }
    regexRewriteNumberRanges(class)
    regexRewriteWordRanges(class, hasIFlag, hasUFlag)
    regexRewriteWhitespaceRanges(class)
  })
}

func regexRewriteNumberRanges(class *regexClassNode) {
  for i, expr := range class.Expressions {
    if cr, ok := expr.(*regexClassRangeNode); ok &&
      cr.From.Value == "0" && cr.To.Value == "9" {
      class.Expressions[i] = &regexCharNode{Value: "\\d", Kind: "meta"}
    }
  }
}

func regexRewriteWordRanges(class *regexClassNode, hasIFlag, hasUFlag bool) {
  numberIdx, lowerIdx, upperIdx, underscoreIdx, u017fIdx, u212aIdx := -1, -1, -1, -1, -1, -1
  for i, expr := range class.Expressions {
    switch {
    case regexIsMetaCharValue(expr, "\\d"):
      numberIdx = i
    case regexIsValueClassRange(expr, "a", "z"):
      lowerIdx = i
    case regexIsValueClassRange(expr, "A", "Z"):
      upperIdx = i
    case regexIsSimpleCharValue(expr, "_"):
      underscoreIdx = i
    case hasIFlag && hasUFlag && regexIsUnicodeCodePoint(expr, 0x017f):
      u017fIdx = i
    case hasIFlag && hasUFlag && regexIsUnicodeCodePoint(expr, 0x212a):
      u212aIdx = i
    }
  }
  if numberIdx < 0 || underscoreIdx < 0 {
    return
  }
  if !((lowerIdx >= 0 && upperIdx >= 0) || (hasIFlag && (lowerIdx >= 0 || upperIdx >= 0))) {
    return
  }
  if hasUFlag && hasIFlag && (u017fIdx < 0 || u212aIdx < 0) {
    return
  }
  removed := map[int]bool{
    lowerIdx: true, upperIdx: true, underscoreIdx: true, u017fIdx: true, u212aIdx: true,
  }
  delete(removed, -1)
  class.Expressions[numberIdx] = &regexCharNode{Value: "\\w", Kind: "meta"}
  kept := class.Expressions[:0]
  for i, expr := range class.Expressions {
    if !removed[i] {
      kept = append(kept, expr)
    }
  }
  class.Expressions = kept
}

// regexWhitespaceClassTests mirrors the upstream whitespaceRangeTests list.
var regexWhitespaceClassTests = []func(regexNode) bool{
  func(n regexNode) bool { return regexIsSimpleCharValue(n, " ") },
  func(n regexNode) bool { return regexIsMetaCharValue(n, "\\f") },
  func(n regexNode) bool { return regexIsMetaCharValue(n, "\\n") },
  func(n regexNode) bool { return regexIsMetaCharValue(n, "\\r") },
  func(n regexNode) bool { return regexIsMetaCharValue(n, "\\t") },
  func(n regexNode) bool { return regexIsMetaCharValue(n, "\\v") },
  func(n regexNode) bool { return regexIsUnicodeCodePoint(n, 0x00a0) },
  func(n regexNode) bool { return regexIsUnicodeCodePoint(n, 0x1680) },
  func(n regexNode) bool { return regexIsUnicodeCodePoint(n, 0x2028) },
  func(n regexNode) bool { return regexIsUnicodeCodePoint(n, 0x2029) },
  func(n regexNode) bool { return regexIsUnicodeCodePoint(n, 0x202f) },
  func(n regexNode) bool { return regexIsUnicodeCodePoint(n, 0x205f) },
  func(n regexNode) bool { return regexIsUnicodeCodePoint(n, 0x3000) },
  func(n regexNode) bool { return regexIsUnicodeCodePoint(n, 0xfeff) },
  func(n regexNode) bool {
    cr, ok := n.(*regexClassRangeNode)
    return ok && regexIsUnicodeCodePoint(cr.From, 0x2000) && regexIsUnicodeCodePoint(cr.To, 0x200a)
  },
}

func regexRewriteWhitespaceRanges(class *regexClassNode) {
  if len(class.Expressions) < len(regexWhitespaceClassTests) {
    return
  }
  for _, test := range regexWhitespaceClassTests {
    matched := false
    for _, expr := range class.Expressions {
      if test(expr) {
        matched = true
        break
      }
    }
    if !matched {
      return
    }
  }
  // Put \s in place of \n.
  for _, expr := range class.Expressions {
    if regexIsMetaCharValue(expr, "\\n") {
      ch := expr.(*regexCharNode)
      ch.Value = "\\s"
      ch.SymbolState = regexFieldAbsent
      ch.CodePointState = regexFieldNaN
      break
    }
  }
  kept := class.Expressions[:0]
  for _, expr := range class.Expressions {
    remove := false
    for _, test := range regexWhitespaceClassTests {
      if test(expr) {
        remove = true
        break
      }
    }
    if !remove {
      kept = append(kept, expr)
    }
  }
  class.Expressions = kept
}

func regexIsSimpleCharValue(n regexNode, value string) bool {
  ch, ok := n.(*regexCharNode)
  return ok && ch.Kind == "simple" && ch.Value == value
}

func regexIsMetaCharValue(n regexNode, value string) bool {
  ch, ok := n.(*regexCharNode)
  return ok && ch.Kind == "meta" && ch.Value == value
}

func regexIsValueClassRange(n regexNode, from, to string) bool {
  cr, ok := n.(*regexClassRangeNode)
  return ok && cr.From.Value == from && cr.To.Value == to
}

func regexIsUnicodeCodePoint(n regexNode, cp int) bool {
  ch, ok := n.(*regexCharNode)
  return ok && ch.Kind == "unicode" && ch.CodePointState == regexFieldValue && ch.CodePoint == cp
}

// ---------------------------------------------------------------------------
// charClassToSingleChar
// ---------------------------------------------------------------------------

// [\d] -> \d, [^\w] -> \W
func regexTransformClassToSingleChar(re *regexRegExpNode) {
  regexWalk(re, func(node regexNode, slot *regexSlot) {
    class, ok := node.(*regexClassNode)
    if !ok || len(class.Expressions) != 1 {
      return
    }
    if !regexHasSafeExtractionSiblings(slot) {
      return
    }
    member, isChar := class.Expressions[0].(*regexCharNode)
    if !isChar || member.Value == "\\b" {
      return
    }
    value := member.Value
    if class.Negative {
      if !regexIsInvertibleMeta(value) {
        return
      }
      value = regexInverseMeta(value)
    }
    escaped := member.EscapedState == regexFieldValue && member.Escaped
    slot.set(&regexCharNode{
      Value: value, Kind: member.Kind,
      Escaped:      escaped || regexSingleCharShouldEscape(value),
      EscapedState: regexFieldValue, // upstream always writes the key
    })
  })
}

// regexHasSafeExtractionSiblings blocks extraction (and ungrouping) when
// the previous Alternative sibling ends in a decimal spelling that a bare
// digit would extend: \1[0] must not become \10.
func regexHasSafeExtractionSiblings(slot *regexSlot) bool {
  if _, inAlt := slot.parent.(*regexAlternativeNode); !inAlt || slot.list == nil || slot.index == 0 {
    return true
  }
  switch prev := (*slot.list)[slot.index-1].(type) {
  case *regexBackreferenceNode:
    if prev.Kind == "number" {
      return false
    }
  case *regexCharNode:
    // SAFETY: upstream only guards kind "decimal" because regexp-tree
    // labels all legacy \NNN escapes decimal; this parser labels them
    // "oct", so both kinds guard.
    if prev.Kind == "decimal" || prev.Kind == "oct" {
      return false
    }
  }
  return true
}

func regexIsInvertibleMeta(value string) bool {
  if len(value) != 2 || value[0] != '\\' {
    return false
  }
  return strings.ContainsRune("dwsDWS", rune(value[1]))
}

func regexInverseMeta(value string) string {
  r := rune(value[1])
  if strings.ContainsRune("dws", r) {
    return "\\" + strings.ToUpper(string(r))
  }
  return "\\" + strings.ToLower(string(r))
}

// Note: \{ and \} stay escaped so a[{]2[}] does not turn into a{2}.
func regexSingleCharShouldEscape(value string) bool {
  return len(value) == 1 && strings.ContainsAny(value, "*[()+?$./{}|")
}

// ---------------------------------------------------------------------------
// charEscapeUnescape
// ---------------------------------------------------------------------------

// \e -> e, [\(] -> [(]
func regexTransformEscapeUnescape(re *regexRegExpNode) {
  regexWalk(re, func(node regexNode, slot *regexSlot) {
    ch, ok := node.(*regexCharNode)
    if !ok || ch.EscapedState != regexFieldValue || !ch.Escaped {
      return
    }
    if regexShouldUnescape(ch, slot) {
      ch.Escaped = false
      ch.EscapedState = regexFieldAbsent
    }
  })
}

func regexShouldUnescape(ch *regexCharNode, slot *regexSlot) bool {
  parentType := slot.parentType()
  if parentType != "CharacterClass" && parentType != "ClassRange" {
    return !regexPreservesEscape(ch, slot)
  }
  return !regexPreservesInCharClass(ch, slot)
}

// \], \\, \^ (leading, in a positive class), \- keep their escapes inside
// classes.
func regexPreservesInCharClass(ch *regexCharNode, slot *regexSlot) bool {
  switch ch.Value {
  case "^":
    class, ok := slot.parent.(*regexClassNode)
    return ok && slot.index == 0 && !class.Negative
  case "-":
    return true
  case "]", "\\":
    return true
  }
  return false
}

func regexPreservesEscape(ch *regexCharNode, slot *regexSlot) bool {
  value := ch.Value
  if value == "{" {
    return regexPreservesOpeningCurlyBraceEscape(slot)
  }
  if value == "}" {
    return regexPreservesClosingCurlyBraceEscape(slot)
  }
  return len(value) == 1 && strings.ContainsAny(value, "*[()+?^$./\\|")
}

// regexConsumeNumbers counts adjacent plain digit chars starting at
// startIndex, walking right (or left when rtl).
func regexConsumeNumbers(list []regexNode, startIndex int, rtl bool) int {
  i := startIndex
  count := 0
  for {
    inBounds := i >= 0 && i < len(list)
    if !inBounds {
      break
    }
    ch, ok := list[i].(*regexCharNode)
    if !ok || ch.Kind != "simple" ||
      (ch.EscapedState == regexFieldValue && ch.Escaped) ||
      len(ch.Value) != 1 || ch.Value[0] < '0' || ch.Value[0] > '9' {
      break
    }
    count++
    if rtl {
      i--
    } else {
      i++
    }
  }
  return count
}

func regexIsPlainSimpleChar(n regexNode, value string) bool {
  ch, ok := n.(*regexCharNode)
  return ok && ch.Kind == "simple" &&
    !(ch.EscapedState == regexFieldValue && ch.Escaped) &&
    ch.Value == value
}

// Avoid \{3} or \{3,} or \{3,4} turning into a quantifier.
func regexPreservesOpeningCurlyBraceEscape(slot *regexSlot) bool {
  if slot.list == nil || slot.index < 0 {
    return false
  }
  list := *slot.list
  index := slot.index
  nbFollowing := regexConsumeNumbers(list, index+1, false)
  i := index + nbFollowing + 1
  if nbFollowing == 0 {
    return false
  }
  if i < len(list) && regexIsPlainSimpleChar(list[i], "}") {
    return true
  }
  if i < len(list) && regexIsPlainSimpleChar(list[i], ",") {
    nbFollowing = regexConsumeNumbers(list, i+1, false)
    i = i + nbFollowing + 1
    return i < len(list) && regexIsPlainSimpleChar(list[i], "}")
  }
  return false
}

// Avoid {3\} or {3,\} turning into a quantifier.
func regexPreservesClosingCurlyBraceEscape(slot *regexSlot) bool {
  if slot.list == nil || slot.index < 0 {
    return false
  }
  list := *slot.list
  index := slot.index
  nbPreceding := regexConsumeNumbers(list, index-1, true)
  i := index - nbPreceding - 1
  if nbPreceding > 0 && i >= 0 && i < len(list) && regexIsPlainSimpleChar(list[i], "{") {
    return true
  }
  if i >= 0 && i < len(list) && regexIsPlainSimpleChar(list[i], ",") {
    nbPreceding = regexConsumeNumbers(list, i-1, true)
    i = i - nbPreceding - 1
    return nbPreceding > 0 && i >= 0 && i < len(list) && regexIsPlainSimpleChar(list[i], "{")
  }
  return false
}

// ---------------------------------------------------------------------------
// charClassClassrangesMerge
// ---------------------------------------------------------------------------

// [a-ec] -> [a-e], [\w\da-f] -> [\w], [abcdef] -> [a-f]
func regexTransformClassRangesMerge(re *regexRegExpNode) {
  hasIUFlags := strings.ContainsRune(re.Flags, 'i') && strings.ContainsRune(re.Flags, 'u')
  regexWalk(re, func(node regexNode, _ *regexSlot) {
    class, ok := node.(*regexClassNode)
    if !ok {
      return
    }
    var metas []string
    for _, expr := range class.Expressions {
      if regexIsMergeMeta(expr, "") {
        metas = append(metas, expr.(*regexCharNode).Value)
      }
    }
    sort.SliceStable(class.Expressions, func(i, j int) bool {
      return regexSortCharClassCompare(class.Expressions[i], class.Expressions[j]) < 0
    })
    exprs := &class.Expressions
    for i := 0; i < len(*exprs); i++ {
      expr := (*exprs)[i]
      var prevExpr, nextExpr regexNode
      if i > 0 {
        prevExpr = (*exprs)[i-1]
      }
      if i+1 < len(*exprs) {
        nextExpr = (*exprs)[i+1]
      }
      if regexFitsInMetas(expr, metas, hasIUFlags) ||
        regexCombinesWithPrecedingClassRange(expr, prevExpr) ||
        regexCombinesWithFollowingClassRange(expr, nextExpr) {
        *exprs = append((*exprs)[:i], (*exprs)[i+1:]...)
        i--
        continue
      }
      merged := regexCharCombinesWithPrecedingChars(expr, i, exprs)
      if merged > 0 {
        *exprs = append((*exprs)[:i-merged+1], (*exprs)[i+1:]...)
        i -= merged
      }
    }
  })
}

// regexSortCharClassCompare ports sortCharClass; a NaN comparison result is
// mapped to 0 (JavaScript's engines treat a NaN comparator result as "keep
// order" in their stable sorts).
func regexSortCharClassCompare(a, b regexNode) float64 {
  av := regexClassSortValue(a)
  bv := regexClassSortValue(b)
  if av == bv {
    _, aIsRange := a.(*regexClassRangeNode)
    _, bIsRange := b.(*regexClassRangeNode)
    if aIsRange && !bIsRange {
      return -1
    }
    if bIsRange && !aIsRange {
      return 1
    }
    if aIsRange && bIsRange {
      diff := regexClassSortValue(a.(*regexClassRangeNode).To) - regexClassSortValue(b.(*regexClassRangeNode).To)
      if math.IsNaN(diff) {
        return 0
      }
      return diff
    }
    if (regexIsMergeMeta(a, "") && regexIsMergeMeta(b, "")) ||
      (regexIsControlChar(a) && regexIsControlChar(b)) {
      if a.(*regexCharNode).Value < b.(*regexCharNode).Value {
        return -1
      }
      return 1
    }
  }
  diff := av - bv
  if math.IsNaN(diff) {
    return 0
  }
  return diff
}

func regexClassSortValue(n regexNode) float64 {
  switch expr := n.(type) {
  case *regexCharNode:
    if expr.Value == "-" {
      return math.Inf(1)
    }
    if expr.Kind == "control" {
      return math.Inf(1)
    }
    if expr.Kind == "meta" && expr.codePointIsNaN() {
      return -1
    }
    if expr.codePointIsNaN() {
      return math.NaN()
    }
    return float64(expr.CodePoint)
  case *regexUnicodePropertyNode:
    return -1
  case *regexClassRangeNode:
    // Upstream reads the raw from.codePoint here (no meta special case),
    // so a range with a meta endpoint sorts as NaN — order preserved.
    if expr.From.codePointIsNaN() {
      return math.NaN()
    }
    return float64(expr.From.CodePoint)
  }
  return math.NaN()
}

// regexIsMergeMeta reports a Char of kind meta whose value is one of
// \d \w \s \D \W \S (or the specific value when given).
func regexIsMergeMeta(n regexNode, value string) bool {
  ch, ok := n.(*regexCharNode)
  if !ok || ch.Kind != "meta" {
    return false
  }
  if value != "" {
    return ch.Value == value
  }
  return len(ch.Value) == 2 && ch.Value[0] == '\\' &&
    strings.ContainsRune("dwsDWS", rune(ch.Value[1]))
}

func regexIsControlChar(n regexNode) bool {
  ch, ok := n.(*regexCharNode)
  return ok && ch.Kind == "control"
}

func regexFitsInMetas(n regexNode, metas []string, hasIUFlags bool) bool {
  for _, meta := range metas {
    if regexFitsInMeta(n, meta, hasIUFlags) {
      return true
    }
  }
  return false
}

func regexFitsInMeta(n regexNode, meta string, hasIUFlags bool) bool {
  if cr, ok := n.(*regexClassRangeNode); ok {
    return regexFitsInMeta(cr.From, meta, hasIUFlags) && regexFitsInMeta(cr.To, meta, hasIUFlags)
  }
  // Special containments between meta chars.
  if meta == "\\S" && (regexIsMergeMeta(n, "\\w") || regexIsMergeMeta(n, "\\d")) {
    return true
  }
  if meta == "\\D" && (regexIsMergeMeta(n, "\\W") || regexIsMergeMeta(n, "\\s")) {
    return true
  }
  if meta == "\\w" && regexIsMergeMeta(n, "\\d") {
    return true
  }
  if meta == "\\W" && regexIsMergeMeta(n, "\\s") {
    return true
  }
  ch, ok := n.(*regexCharNode)
  if !ok || ch.codePointIsNaN() {
    return false
  }
  switch meta {
  case "\\s":
    return regexFitsInMetaS(ch)
  case "\\S":
    return !regexFitsInMetaS(ch)
  case "\\d":
    return regexFitsInMetaD(ch)
  case "\\D":
    return !regexFitsInMetaD(ch)
  case "\\w":
    return regexFitsInMetaW(ch, hasIUFlags)
  case "\\W":
    return !regexFitsInMetaW(ch, hasIUFlags)
  }
  return false
}

func regexFitsInMetaS(ch *regexCharNode) bool {
  cp := ch.CodePoint
  return cp == 0x0009 || cp == 0x000a || cp == 0x000b || cp == 0x000c ||
    cp == 0x000d || cp == 0x0020 || cp == 0x00a0 || cp == 0x1680 ||
    (cp >= 0x2000 && cp <= 0x200a) ||
    cp == 0x2028 || cp == 0x2029 || cp == 0x202f || cp == 0x205f ||
    cp == 0x3000 || cp == 0xfeff
}

func regexFitsInMetaD(ch *regexCharNode) bool {
  return ch.CodePoint >= 0x30 && ch.CodePoint <= 0x39
}

func regexFitsInMetaW(ch *regexCharNode, hasIUFlags bool) bool {
  cp := ch.CodePoint
  return regexFitsInMetaD(ch) ||
    (cp >= 0x41 && cp <= 0x5a) || (cp >= 0x61 && cp <= 0x7a) ||
    ch.Value == "_" ||
    (hasIUFlags && (cp == 0x017f || cp == 0x212a))
}

func regexCombinesWithPrecedingClassRange(expr, preceding regexNode) bool {
  cr, ok := preceding.(*regexClassRangeNode)
  if !ok {
    return false
  }
  if regexFitsInClassRange(expr, cr) {
    // [a-gc] -> [a-g]
    return true
  }
  if ch, isChar := expr.(*regexCharNode); isChar && regexIsMetaWCharOrCode(ch) &&
    !cr.To.codePointIsNaN() && cr.To.CodePoint == ch.CodePoint-1 {
    // [a-de] -> [a-e]
    cr.To = ch
    return true
  }
  if exprRange, isRange := expr.(*regexClassRangeNode); isRange &&
    !exprRange.From.codePointIsNaN() && !exprRange.To.codePointIsNaN() &&
    !cr.From.codePointIsNaN() && !cr.To.codePointIsNaN() &&
    exprRange.From.CodePoint <= cr.To.CodePoint+1 &&
    exprRange.To.CodePoint >= cr.From.CodePoint-1 {
    // [a-db-f] -> [a-f]
    if exprRange.From.CodePoint < cr.From.CodePoint {
      cr.From = exprRange.From
    }
    if exprRange.To.CodePoint > cr.To.CodePoint {
      cr.To = exprRange.To
    }
    return true
  }
  return false
}

func regexCombinesWithFollowingClassRange(expr, following regexNode) bool {
  cr, ok := following.(*regexClassRangeNode)
  if !ok {
    return false
  }
  // [ab-e] -> [a-e]
  if ch, isChar := expr.(*regexCharNode); isChar && regexIsMetaWCharOrCode(ch) &&
    !cr.From.codePointIsNaN() && cr.From.CodePoint == ch.CodePoint+1 {
    cr.From = ch
    return true
  }
  return false
}

func regexFitsInClassRange(expr regexNode, cr *regexClassRangeNode) bool {
  if cr.From.codePointIsNaN() || cr.To.codePointIsNaN() {
    return false
  }
  switch n := expr.(type) {
  case *regexCharNode:
    if n.codePointIsNaN() {
      return false
    }
    return n.CodePoint >= cr.From.CodePoint && n.CodePoint <= cr.To.CodePoint
  case *regexClassRangeNode:
    return regexFitsInClassRange(n.From, cr) && regexFitsInClassRange(n.To, cr)
  }
  return false
}

// regexCharCombinesWithPrecedingChars collapses runs of consecutive chars
// into a range: [abcdef] -> [a-f]. Returns the number of chars merged.
func regexCharCombinesWithPrecedingChars(expr regexNode, index int, exprs *[]regexNode) int {
  ch, ok := expr.(*regexCharNode)
  if !ok || !regexIsMetaWCharOrCode(ch) {
    return 0
  }
  merged := 0
  i := index
  for i > 0 {
    current, curOK := (*exprs)[i].(*regexCharNode)
    preceding, preOK := (*exprs)[i-1].(*regexCharNode)
    if curOK && preOK && regexIsMetaWCharOrCode(preceding) &&
      preceding.CodePoint == current.CodePoint-1 {
      merged++
      i--
    } else {
      break
    }
  }
  if merged > 1 {
    (*exprs)[i] = &regexClassRangeNode{From: (*exprs)[i].(*regexCharNode), To: ch}
    return merged
  }
  return 0
}

func regexIsMetaWCharOrCode(n regexNode) bool {
  ch, ok := n.(*regexCharNode)
  if !ok || ch.codePointIsNaN() {
    return false
  }
  return regexFitsInMetaW(ch, false) ||
    ch.Kind == "unicode" || ch.Kind == "hex" || ch.Kind == "oct" || ch.Kind == "decimal"
}

// ---------------------------------------------------------------------------
// disjunctionRemoveDuplicates
// ---------------------------------------------------------------------------

// (ab|bc|ab) -> (ab|bc)
func regexTransformDisjunctionRemoveDuplicates(re *regexRegExpNode) {
  regexWalk(re, func(node regexNode, slot *regexSlot) {
    disjunction, ok := node.(*regexDisjunctionNode)
    if !ok {
      return
    }
    parts := regexDisjunctionToList(disjunction)
    seen := map[string]bool{}
    unique := parts[:0]
    for _, part := range parts {
      key := "null"
      if part != nil {
        key = regexEqualityKey(part)
      }
      if seen[key] {
        continue
      }
      seen[key] = true
      unique = append(unique, part)
    }
    slot.set(regexListToDisjunction(unique))
  })
}

func regexDisjunctionToList(node *regexDisjunctionNode) []regexNode {
  var list []regexNode
  if left, ok := node.Left.(*regexDisjunctionNode); ok {
    list = append(regexDisjunctionToList(left), node.Right)
  } else {
    list = []regexNode{node.Left, node.Right}
  }
  return list
}

func regexListToDisjunction(list []regexNode) regexNode {
  if len(list) == 0 {
    return nil
  }
  node := list[0]
  for _, right := range list[1:] {
    node = &regexDisjunctionNode{Left: node, Right: right}
  }
  return node
}

// ---------------------------------------------------------------------------
// groupSingleCharsToCharClass
// ---------------------------------------------------------------------------

// (a|b|c) -> ([abc]), (?:a|b|c) -> [abc], top-level a|b|c -> [abc]
//
// Upstream fires on the Disjunction and replaces through the parent path:
// a capturing group keeps the group and swaps its expression, while a
// non-capturing group is itself replaced by the class. This port fires at
// the slots it can reach (the RegExp body and each Group), which visits the
// same parent set.
func regexTransformGroupSingleCharsToClass(re *regexRegExpNode) {
  if disjunction, ok := re.Body.(*regexDisjunctionNode); ok {
    if class := regexSingleCharsClass(disjunction); class != nil {
      re.Body = class
    }
  }
  regexWalk(re, func(node regexNode, slot *regexSlot) {
    group, ok := node.(*regexGroupNode)
    if !ok {
      return
    }
    disjunction, isDisjunction := group.Expression.(*regexDisjunctionNode)
    if !isDisjunction {
      return
    }
    class := regexSingleCharsClass(disjunction)
    if class == nil {
      return
    }
    if group.Capturing {
      group.Expression = class
      return
    }
    slot.set(class)
  })
}

// regexSingleCharsClass builds the replacement CharacterClass for a
// single-char disjunction, or nil when the disjunction does not qualify.
func regexSingleCharsClass(disjunction *regexDisjunctionNode) *regexClassNode {
  charset := map[string]*regexCharNode{}
  var order []string
  if !regexCollectSingleChars(disjunction, charset, &order) || len(charset) == 0 {
    return nil
  }
  sort.SliceStable(order, func(i, j int) bool { return regexUTF16Less(order[i], order[j]) })
  members := make([]regexNode, 0, len(order))
  for _, key := range order {
    members = append(members, charset[key])
  }
  return &regexClassNode{Expressions: members}
}

// regexCollectSingleChars ports shouldProcess: walks a disjunction whose
// parts are single chars or positive flat classes of chars.
func regexCollectSingleChars(expr regexNode, charset map[string]*regexCharNode, order *[]string) bool {
  switch n := expr.(type) {
  case nil:
    return false
  case *regexDisjunctionNode:
    return regexCollectSingleChars(n.Left, charset, order) &&
      regexCollectSingleChars(n.Right, charset, order)
  case *regexCharNode:
    if n.Kind == "meta" && n.SymbolState == regexFieldValue && n.Symbol == "." {
      return false
    }
    if _, exists := charset[n.Value]; !exists {
      *order = append(*order, n.Value)
    }
    charset[n.Value] = n
    return true
  case *regexClassNode:
    if n.Negative {
      return false
    }
    for _, member := range n.Expressions {
      if !regexCollectSingleChars(member, charset, order) {
        return false
      }
    }
    return true
  }
  return false
}

// regexUTF16Less compares strings by UTF-16 code units, matching the
// JavaScript default Array#sort string ordering upstream relies on.
func regexUTF16Less(a, b string) bool {
  ar := []rune(a)
  br := []rune(b)
  for i := 0; i < len(ar) && i < len(br); i++ {
    au := regexUTF16Units(ar[i])
    bu := regexUTF16Units(br[i])
    for j := 0; j < len(au) && j < len(bu); j++ {
      if au[j] != bu[j] {
        return au[j] < bu[j]
      }
    }
    if len(au) != len(bu) {
      return len(au) < len(bu)
    }
  }
  return len(ar) < len(br)
}

func regexUTF16Units(r rune) []uint16 {
  if r < 0x10000 {
    return []uint16{uint16(r)}
  }
  r -= 0x10000
  return []uint16{uint16(0xd800 + r/0x400), uint16(0xdc00 + r%0x400)}
}

// ---------------------------------------------------------------------------
// removeEmptyGroup
// ---------------------------------------------------------------------------

// (?:)a -> a, (?:)+ -> (?:)
func regexTransformRemoveEmptyGroup(re *regexRegExpNode) {
  regexWalk(re, func(node regexNode, slot *regexSlot) {
    group, ok := node.(*regexGroupNode)
    if !ok || group.Capturing || group.Expression != nil {
      return
    }
    switch slot.parent.(type) {
    case *regexRepetitionNode:
      // The group's slot is the repetition's expression; the repetition
      // itself must be replaced by the group in ITS parent slot. The
      // walker cannot reach that slot from here, so this case is handled
      // by the dedicated pass below.
    case *regexRegExpNode:
      // Keep a lone (?:) as the whole pattern.
    default:
      slot.remove()
    }
  })
  // Second, structural pass: (?:)+ -> (?:). Upstream reaches the parent
  // repetition through path.getParent().replace(); this walker replaces
  // Repetition nodes whose expression is an empty non-capturing group.
  regexWalk(re, func(node regexNode, slot *regexSlot) {
    rep, ok := node.(*regexRepetitionNode)
    if !ok {
      return
    }
    if group, isGroup := rep.Expression.(*regexGroupNode); isGroup &&
      !group.Capturing && group.Expression == nil {
      slot.set(group)
    }
  })
}

// ---------------------------------------------------------------------------
// ungroup
// ---------------------------------------------------------------------------

// (?:a) -> a
//
// The Alternative-merge case reproduces an upstream traversal subtlety:
// regexp-tree's merge replaces the parent Alternative with a rebuilt node
// and deletes the old node's registry path, so every later ungroup whose
// parent is that same Alternative silently no-ops for the rest of the pass
// (the next optimizer round picks it up). This port splices in place,
// marks the Alternative dirty, skips further ungroups under it this pass,
// and resumes iteration after the spliced-in segment — reaching the same
// per-pass strings the upstream accept/rollback guard sees.
func regexTransformUngroup(re *regexRegExpNode) {
  dirty := map[*regexAlternativeNode]bool{}
  regexWalk(re, func(node regexNode, slot *regexSlot) {
    group, ok := node.(*regexGroupNode)
    if !ok || group.Capturing || group.Expression == nil {
      return
    }
    parentAlt, parentIsAlt := slot.parent.(*regexAlternativeNode)
    if parentIsAlt && dirty[parentAlt] {
      return
    }
    if !regexHasSafeExtractionSiblings(slot) {
      return
    }
    child := group.Expression
    // Don't optimize /a(?:b|c)/ to /ab|c/; /(?:b|c)/ -> /b|c/ is ok.
    if _, isDisjunction := child.(*regexDisjunctionNode); isDisjunction {
      if _, parentIsRegExp := slot.parent.(*regexRegExpNode); !parentIsRegExp {
        return
      }
    }
    // Don't optimize /(?:ab)+/ to /ab+/; /(?:a)+/ and /(?:[a-d])+/ are ok.
    if _, parentIsRepetition := slot.parent.(*regexRepetitionNode); parentIsRepetition {
      switch child.(type) {
      case *regexCharNode, *regexClassNode:
      default:
        return
      }
    }
    if alt, childIsAlt := child.(*regexAlternativeNode); childIsAlt {
      // A multi-term group body merges only into a surrounding
      // Alternative; under any other parent it stays grouped.
      if parentIsAlt && slot.list != nil {
        list := slot.list
        idx := slot.index
        *list = append((*list)[:idx], append(append([]regexNode{}, alt.Expressions...), (*list)[idx+1:]...)...)
        if slot.iter != nil {
          slot.iter.i += len(alt.Expressions) - 1
        }
        dirty[parentAlt] = true
      }
      return
    }
    slot.set(child)
  })
}

// ---------------------------------------------------------------------------
// combineRepeatingPatterns
// ---------------------------------------------------------------------------

// abcabcabc -> (?:abc){3}
func regexTransformCombineRepeating(re *regexRegExpNode) {
  regexWalk(re, func(node regexNode, _ *regexSlot) {
    alt, ok := node.(*regexAlternativeNode)
    if !ok {
      return
    }
    index := 1
    for index < len(alt.Expressions) {
      index = maxInt(1, regexCombineRepeatingPatternLeft(alt, index))
      if index >= len(alt.Expressions) {
        break
      }
      index = maxInt(1, regexCombineWithPreviousRepetition(alt, index))
      if index >= len(alt.Expressions) {
        break
      }
      index = maxInt(1, regexCombineRepetitionWithPrevious(alt, index))
      index++
    }
  })
}

// abcabc -> (?:abc){2}
func regexCombineRepeatingPatternLeft(alt *regexAlternativeNode, index int) int {
  exprs := alt.Expressions
  child := exprs[index]
  nbPossibleLengths := (index + 1) / 2
  for i := 0; i < nbPossibleLengths; i++ {
    startIndex := index - 2*i - 1
    var leftKey, rightKey string
    var rightNode regexNode
    if i == 0 {
      rightNode = child
      leftKey = regexEqualityKey(exprs[startIndex])
      rightKey = regexEqualityKey(child)
    } else {
      right := &regexAlternativeNode{
        Expressions: append(append([]regexNode{}, exprs[index-i:index]...), child),
      }
      left := &regexAlternativeNode{
        Expressions: append([]regexNode{}, exprs[startIndex:index-i]...),
      }
      rightNode = right
      leftKey = regexEqualityKey(left)
      rightKey = regexEqualityKey(right)
    }
    if leftKey == rightKey {
      var expression regexNode
      if _, isRep := rightNode.(*regexRepetitionNode); i == 0 && !isRep {
        expression = rightNode
      } else {
        expression = &regexGroupNode{Capturing: false, Expression: rightNode}
      }
      replacement := &regexRepetitionNode{
        Expression: expression,
        Quantifier: &regexQuantifierNode{
          Kind: "Range", From: 2, To: 2, HasTo: true, Greedy: true,
          FieldOrder: "ftg",
        },
      }
      // Remove the 2i+1 nodes before child, then replace child.
      alt.Expressions = append(exprs[:startIndex], exprs[index:]...)
      alt.Expressions[startIndex] = replacement
      return startIndex
    }
  }
  return index
}

// (?:abc){2}abc -> (?:abc){3}
func regexCombineWithPreviousRepetition(alt *regexAlternativeNode, index int) int {
  exprs := alt.Expressions
  child := exprs[index]
  for i := 0; i < index; i++ {
    prevRep, isRep := exprs[i].(*regexRepetitionNode)
    if !isRep || !prevRep.Quantifier.Greedy {
      continue
    }
    left := prevRep.Expression
    if group, isGroup := left.(*regexGroupNode); isGroup && !group.Capturing {
      left = group.Expression
    }
    var right regexNode
    if i+1 == index {
      right = child
      if group, isGroup := right.(*regexGroupNode); isGroup && !group.Capturing {
        right = group.Expression
      }
    } else {
      right = &regexAlternativeNode{
        Expressions: append([]regexNode{}, exprs[i+1:index+1]...),
      }
    }
    if left != nil && regexEqualityKey(left) == regexEqualityKey(right) {
      alt.Expressions = append(exprs[:i+1], exprs[index+1:]...)
      regexIncreaseQuantifierByOne(prevRep.Quantifier)
      return i
    }
  }
  return index
}

// abc(?:abc){2} -> (?:abc){3}
func regexCombineRepetitionWithPrevious(alt *regexAlternativeNode, index int) int {
  exprs := alt.Expressions
  childRep, isRep := exprs[index].(*regexRepetitionNode)
  if !isRep || !childRep.Quantifier.Greedy {
    return index
  }
  right := childRep.Expression
  if group, isGroup := right.(*regexGroupNode); isGroup && !group.Capturing {
    right = group.Expression
  }
  var left regexNode
  var rightLength int
  if rightAlt, isAlt := right.(*regexAlternativeNode); isAlt {
    rightLength = len(rightAlt.Expressions)
    if index-rightLength < 0 {
      return index
    }
    left = &regexAlternativeNode{
      Expressions: append([]regexNode{}, exprs[index-rightLength:index]...),
    }
  } else {
    rightLength = 1
    left = exprs[index-1]
    if group, isGroup := left.(*regexGroupNode); isGroup && !group.Capturing {
      left = group.Expression
    }
  }
  if left != nil && right != nil && regexEqualityKey(left) == regexEqualityKey(right) {
    alt.Expressions = append(exprs[:index-rightLength], exprs[index:]...)
    regexIncreaseQuantifierByOne(childRep.Quantifier)
    return index - rightLength
  }
  return index
}

package linthost

import (
  shimast "github.com/microsoft/typescript-go/shim/ast"
  shimscanner "github.com/microsoft/typescript-go/shim/scanner"
)

// listHasInterItemComments reports whether `node` (an object / array literal)
// carries a comment in a gap between its items or brackets. The list printers
// mint fresh comma/line separators that have no slot for such trivia, so a
// reflow would silently delete the comment. When a node nested inside a
// reflowing parent (an array argument of a call) carries one, the parent's
// own top-level comment guard cannot see it (it lives inside a child range),
// so each list printer must check itself and bail to verbatim — reporting the
// span uncovered so the enclosing reflow abstains and the source round-trips.
func listHasInterItemComments(ctx *PrintContext, node *shimast.Node) bool {
  if node == nil {
    return false
  }
  start := shimscanner.SkipTrivia(ctx.Source, node.Pos())
  end := node.End()
  if start < 0 || end < start || end > len(ctx.Source) {
    return false
  }
  return hasNonChildComments(node, ctx.Source, start, end)
}

// Shared helpers for comma-separated list printers.
//
// Object literals, array literals, call arguments, parameter lists,
// named imports, named exports, tuple types, type-parameter lists —
// they all share the same broken/flat shape:
//
//  flat:    OPEN child, child, child CLOSE
//  broken:  OPEN
//               child,
//               child,
//               child,        // optional trailing comma
//           CLOSE
//
// printList captures that shape in one place so every per-node printer
// can stay tiny.
//
// `openTok` and `closeTok` are the literal punctuation strings; the
// helper does not look them up from the source because that lookup
// would couple every list to its own scanner. `space` toggles the
// "single space between OPEN and the first child" used by object
// literals (`{ a }`) but not arrays (`[a]`).
type listShape struct {
  OpenTok  string
  CloseTok string
  Items    []Doc
  Space    bool // emit a space after OPEN / before CLOSE in flat mode
  AddComma bool // emit a trailing comma in broken mode
  // HugLast keeps the final item attached to the parens instead of
  // exploding the whole list. It is set by the call/new argument
  // printer when the last argument is a callback or object literal —
  // see printArgList. When true, the last item is emitted directly
  // against OPEN…CLOSE with no leading/trailing soft break, so a
  // multi-line callback body does not force every preceding argument
  // onto its own line.
  HugLast bool
  // HugLastBreakClose keeps an expression-bodied trailing arrow attached to
  // OPEN through its `=>`, but finishes a broken argument list with the
  // optional trailing comma and CLOSE on a fresh line. Unlike a block-bodied
  // callback, the arrow's expression does not own the call's closing line:
  // `run(() =>\n  nested(),\n)`. Requires HugLast.
  HugLastBreakClose bool
  // HugFirst keeps the FIRST item attached to the open paren and flows
  // the remaining simple items after it, the mirror of HugLast. The
  // call-argument printer sets it for the two-argument
  // `callback, simpleArg` shape Prettier hugs (`foo(() => { … }, x)`).
  // HugLast and HugFirst are mutually exclusive.
  HugFirst bool
  // HugFirstTrailingBreaks tells printListHuggingFirst NOT to flatten the
  // trailing item, letting it render through its own breakable group. The
  // call-argument printer sets it for the React-hook deps shape
  // (`useEffect(() => { … }, [deps])`), whose deps array Prettier breaks
  // one-element-per-line when it overflows rather than pinning it flat on the
  // close line. The short leaf/call trailing args of every other first-arg-hug
  // case still flatten (they ride the close line flat, per Prettier).
  HugFirstTrailingBreaks bool
  // HugFirstForce drops the exploded fallback from a HugFirst list, the mirror
  // of HugLastForce. The call-argument printer sets it for a genuine React-hook
  // deps call (`useEffect(() => { … }, [deps])`: a zero-parameter block-bodied
  // arrow plus an array literal), which Prettier's isReactHookCallWithDepsArray
  // path never explodes — it keeps the callback hugged and lets the open line
  // overflow. Distinct from HugFirstTrailingBreaks, which also fires for a
  // parameterized callback whose empty-array second arg DOES keep the fallback.
  HugFirstForce bool
  // HugLastForce drops the exploded fallback from a HugLast list: the hugged
  // shape is chosen even when its opening line overflows printWidth. The
  // call-argument printer sets it for a test-framework call
  // (`test("very long description", () => { … })`), which Prettier never
  // explodes — the callback always rides the open paren. Requires HugLast.
  HugLastForce bool
  // ForceBreak commits the list to its broken, one-item-per-line shape
  // even when it would fit flat. The object-literal printer sets it to
  // mirror Prettier's objectWrap:"preserve" — an object the source
  // wrote with a newline after `{` stays expanded.
  ForceBreak bool
  // Fill packs the items with Prettier's fill layout — as many per line as
  // fit — instead of one item per line when the list breaks. The array
  // printer sets it for a concisely-printed numeric array. Mutually
  // exclusive with HugLast / HugFirst.
  Fill bool
  // Prefix and Suffix are emitted inside the list's Group, before OpEN and
  // after CLOSE respectively. They let a caller fold surrounding tokens into
  // the same fit-or-break decision: an import declaration sets Prefix to
  // `import ` (or `import D, `) and Suffix to ` from "..."` so the named-brace
  // group's flat-fit check counts the whole declaration line — Prettier never
  // breaks a brace that fits but whose `from` tail overflows is measured here,
  // not in a separate group. Only used on the plain (non-hugging) path.
  Prefix Doc
  Suffix Doc
  // BlankBefore[i] reports whether the source had a blank line before item i
  // (i.e. between item i-1 and item i). When any entry is set the list is
  // forced broken and a single blank line is preserved before that item,
  // mirroring Prettier. Length, when non-nil, equals len(Items); index 0 is
  // ignored (no item precedes the first).
  BlankBefore []bool
}

// blankBeforeItems computes BlankBefore for a node list: entry i is true when
// the source had a blank line (two or more newlines) between item i-1 and
// item i. Returns nil for a list too short to carry one, so callers pass it
// through unconditionally.
func blankBeforeItems(src string, elems []*shimast.Node) []bool {
  if len(elems) < 2 {
    return nil
  }
  out := make([]bool, len(elems))
  for i := 1; i < len(elems); i++ {
    if elems[i-1] == nil || elems[i] == nil {
      continue
    }
    out[i] = blankLineBetweenStatements(src, elems[i-1].End(), elems[i].Pos())
  }
  return out
}

// hasBlankBefore reports whether any item carries a preserved blank line.
func (s listShape) hasBlankBefore() bool {
  for _, b := range s.BlankBefore {
    if b {
      return true
    }
  }
  return false
}

// printList renders the list shape as a Doc tree. Empty lists collapse
// to `OPENCLOSE`. A HugLast list becomes a ConditionalGroup of up to
// three shapes; every other list is the plain fit-or-break Group.
func printList(ctx *PrintContext, shape listShape) Doc {
  if len(shape.Items) == 0 {
    return Text(shape.OpenTok + shape.CloseTok)
  }
  plain := printListPlain(ctx, shape)
  // A source blank line forces the plain broken layout (Prettier never hugs or
  // packs flat across a blank line), so skip the hugging ConditionalGroup.
  if (!shape.HugLast && !shape.HugFirst) || shape.hasBlankBefore() {
    return plain
  }
  // A hugging list offers the engine up to three shapes, in preference
  // order:
  //   1. allFlat — every item on one line, chosen when it fits;
  //   2. hugged  — the callback (last for HugLast, first for HugFirst)
  //      committed to its multi-line shape with the other items inline,
  //      chosen when its opening line fits but the all-flat form does not;
  //   3. plain   — every item exploded onto its own indented line.
  // The all-flat option is dropped when the list cannot render flat
  // (a block-bodied callback argument carries hard line breaks).
  hugged := printListHuggingLast(ctx, shape)
  if shape.HugFirst {
    hugged = printListHuggingFirst(ctx, shape)
  }
  // A test-framework call (HugLastForce) and a genuine React-hook deps call
  // (HugFirstForce, `useEffect(() => { … }, [deps])`) hug their callback
  // unconditionally — Prettier never explodes their arguments, it lets the open
  // line overflow — so drop the exploded fallback. The all-flat option still
  // wins when the whole call fits (an empty-body callback).
  if shape.HugLastForce || shape.HugFirstForce {
    if allFlat, ok := flatten(plain); ok {
      return ConditionalGroup(allFlat, hugged)
    }
    return hugged
  }
  if allFlat, ok := flatten(plain); ok {
    return ConditionalGroup(allFlat, hugged, plain)
  }
  return ConditionalGroup(hugged, plain)
}

// printListPlain renders the open-comma-close list as a single
// fit-or-break Group: flat (`OPEN a, b CLOSE`) when it fits the width
// budget, one item per indented line — with an optional trailing
// comma — when it does not.
func printListPlain(ctx *PrintContext, shape listShape) Doc {
  sep := Concat(Text(","), Line())

  flatPad := Doc{Kind: docNil}
  if shape.Space {
    flatPad = Text(" ")
  }

  trailing := Doc{Kind: docNil}
  if shape.AddComma {
    trailing = IfBreak(Text(","), Doc{Kind: docNil})
  }

  hasBlank := shape.hasBlankBefore()

  var body Doc
  if hasBlank {
    // Per-item body that preserves a single source blank line before an item:
    // `,` then a Literalline (the empty line, no indent, mirroring printBlock)
    // then the normal Line. A blank line forces the group broken.
    parts := make([]Doc, 0, len(shape.Items)*3)
    for i, it := range shape.Items {
      if i > 0 {
        parts = append(parts, Text(","))
        if i < len(shape.BlankBefore) && shape.BlankBefore[i] {
          parts = append(parts, Literalline())
        }
        parts = append(parts, Line())
      }
      parts = append(parts, it)
    }
    body = Concat(parts...)
  } else if shape.Fill {
    // Each non-last fill content carries its own comma — `[el, ","]` — and the
    // separator is just a Line. Prettier measures the pack/break decision on
    // `[content_i, line, content_{i+1}]`, so the next element's comma must be
    // part of its content or the line would pack one element too many. The
    // last element carries no comma here; the trailing comma is the shared
    // ifBreak appended after the body so it tracks the GROUP's break mode (a
    // fill-mode ifBreak would drop the comma when the last item packs flat,
    // making the format non-idempotent).
    parts := make([]Doc, 0, len(shape.Items)*2-1)
    for i, it := range shape.Items {
      if i > 0 {
        parts = append(parts, Line())
      }
      if i < len(shape.Items)-1 {
        parts = append(parts, Concat(it, Text(",")))
      } else {
        parts = append(parts, it)
      }
    }
    body = Fill(parts...)
  } else {
    body = Join(sep, shape.Items)
  }

  openTok := Text(shape.OpenTok)
  closeTok := Text(shape.CloseTok)

  // In flat mode: OPEN [pad] body [pad] CLOSE
  // In broken mode: OPEN \n body, \n CLOSE.
  leadingSep := IfBreak(Hardline(), flatPad)
  trailingSep := IfBreak(Hardline(), flatPad)

  bodyBlock := Indent(ctx.indentUnit(), leadingSep, body, trailing)
  prefix := shape.Prefix
  if prefix.Kind == 0 {
    prefix = Doc{Kind: docNil}
  }
  suffix := shape.Suffix
  if suffix.Kind == 0 {
    suffix = Doc{Kind: docNil}
  }
  doc := Concat(prefix, openTok, bodyBlock, trailingSep, closeTok, suffix)
  group := Group(doc)
  // ForceBreak (object-literal newline preservation) commits the group
  // to its broken shape regardless of fit.
  group.Break = shape.ForceBreak || hasBlank
  return group
}

// printListHuggingLast renders the "last-argument hugging" shape that
// Prettier uses for `foo(a, b, () => { … })`: the leading items flow
// comma-separated and the final item stays attached to the closing
// paren instead of being pushed onto its own indented line.
//
//  hugged: OPEN a, b, OPEN-of-last … CLOSE-of-last CLOSE
//
// The result is a plain Concat, not a Group: the hugged last argument
// is a callback or object literal whose own printer carries the
// fit-or-break decision for its body, so wrapping here would let a
// multi-line body force the `a, b,` prefix to break. printList offers
// this Concat as a ConditionalGroup option; when its opening line would
// overflow printWidth the engine falls back to the plain exploded list.
//
// The hugged final item is forced broken — via forceBreakFirstGroup —
// so the hugged option is genuinely multi-line and distinct from the
// all-flat option. A flat hugged object would otherwise be
// byte-identical to all-flat yet escape its width check. The break
// reaches the first Group in the item's subtree, so an object or array
// nested inside an arrow body (`(x) => ({ … })`) breaks too.
func printListHuggingLast(ctx *PrintContext, shape listShape) Doc {
  last := shape.Items[len(shape.Items)-1]
  lead := shape.Items[:len(shape.Items)-1]
  // Force the hugged item's first Group broken only when the item has
  // no hard line breaks of its own. A block-bodied callback already
  // renders multi-line through its block's hard breaks; descending into
  // it with forceBreakFirstGroup would instead force some unrelated
  // nested Group — a plain statement's call-argument list — broken.
  if _, flat := flatten(last); flat {
    last, _ = forceBreakFirstGroup(last)
  }

  parts := []Doc{Text(shape.OpenTok)}
  for _, item := range lead {
    parts = append(parts, item, Text(", "))
  }
  parts = append(parts, last)
  if shape.HugLastBreakClose {
    if shape.AddComma {
      parts = append(parts, Text(","))
    }
    parts = append(parts, Hardline(), Text(shape.CloseTok))
  } else {
    parts = append(parts, Text(shape.CloseTok))
  }
  return Concat(parts...)
}

// printListHuggingFirst renders the "first-argument hugging" shape
// Prettier uses for `foo(() => { … }, target)`: the first item stays
// attached to the open paren and the remaining simple items flow inline
// after it, so a multi-line callback body does not explode the trailing
// arguments onto their own lines.
//
//  hugged: OPEN OPEN-of-first … CLOSE-of-first, b, c CLOSE
//
// Like printListHuggingLast it returns a plain Concat (the callback's own
// printer owns its body's break) and forces the hugged item's first Group
// broken when the item has no hard line breaks of its own, so the hugged
// option stays distinct from the all-flat option.
func printListHuggingFirst(ctx *PrintContext, shape listShape) Doc {
  first := shape.Items[0]
  rest := shape.Items[1:]
  if _, flat := flatten(first); flat {
    first, _ = forceBreakFirstGroup(first)
  }
  parts := []Doc{Text(shape.OpenTok), first}
  for _, item := range rest {
    // The trailing simple arguments ride the close line flat — Prettier keeps
    // them on one line even when that line overflows (a long zero/one-argument
    // trailing call `}, makeAccumulator(single))` is not broken). Force each
    // flat so its own Group does not break against the close-line width. The
    // React-hook deps array is the exception (HugFirstTrailingBreaks): Prettier
    // renders it through a breakable group, so leave it unflattened to break
    // one-element-per-line when the close line overflows.
    if !shape.HugFirstTrailingBreaks {
      if flat, ok := flatten(item); ok {
        item = flat
      }
    }
    parts = append(parts, Text(", "), item)
  }
  parts = append(parts, Text(shape.CloseTok))
  return Concat(parts...)
}

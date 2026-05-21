package linthost

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
}

// printList renders the list shape as a Doc tree. Empty lists collapse
// to `OPENCLOSE`. A HugLast list becomes a ConditionalGroup of the
// hugged and exploded shapes; every other list is the plain
// fit-or-break Group.
func printList(ctx *PrintContext, shape listShape) Doc {
  if len(shape.Items) == 0 {
    return Text(shape.OpenTok + shape.CloseTok)
  }
  plain := printListPlain(ctx, shape)
  if shape.HugLast {
    // Offer the engine two shapes: the hugged form — leading items
    // inline, the final callback or object literal hugging the parens —
    // and the plain exploded form. The hugged form wins whenever its
    // opening line fits the budget; otherwise every argument takes its
    // own indented line, the shape Prettier falls back to when the hug
    // header would overflow printWidth.
    return ConditionalGroup(printListHuggingLast(ctx, shape), plain)
  }
  return plain
}

// printListPlain renders the open-comma-close list as a single
// fit-or-break Group: flat (`OPEN a, b CLOSE`) when it fits the width
// budget, one item per indented line — with an optional trailing
// comma — when it does not.
func printListPlain(ctx *PrintContext, shape listShape) Doc {
  sep := Concat(Text(","), Line())
  body := Join(sep, shape.Items)

  flatPad := Doc{Kind: docNil}
  if shape.Space {
    flatPad = Text(" ")
  }

  trailing := Doc{Kind: docNil}
  if shape.AddComma {
    trailing = IfBreak(Text(","), Doc{Kind: docNil})
  }

  openTok := Text(shape.OpenTok)
  closeTok := Text(shape.CloseTok)

  // In flat mode: OPEN [pad] body [pad] CLOSE
  // In broken mode: OPEN \n body, \n CLOSE.
  leadingSep := IfBreak(Hardline(), flatPad)
  trailingSep := IfBreak(Hardline(), flatPad)

  bodyBlock := Indent(ctx.indentUnit(), leadingSep, body, trailing)
  doc := Concat(openTok, bodyBlock, trailingSep, closeTok)
  return Group(doc)
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
// this Concat as the first option of a ConditionalGroup; when its
// opening line would overflow printWidth the engine falls back to the
// plain exploded list instead.
func printListHuggingLast(ctx *PrintContext, shape listShape) Doc {
  last := shape.Items[len(shape.Items)-1]
  lead := shape.Items[:len(shape.Items)-1]

  parts := []Doc{Text(shape.OpenTok)}
  for _, item := range lead {
    parts = append(parts, item, Text(", "))
  }
  parts = append(parts, last, Text(shape.CloseTok))
  return Concat(parts...)
}

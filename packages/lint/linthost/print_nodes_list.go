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
// to `OPENCLOSE`. Single-element lists still wrap so trailing-comma
// logic stays uniform.
func printList(ctx *PrintContext, shape listShape) Doc {
  if len(shape.Items) == 0 {
    return Text(shape.OpenTok + shape.CloseTok)
  }
  if shape.HugLast {
    return printListHuggingLast(ctx, shape)
  }
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
  // In broken mode: OPEN \n body, \n CLOSE — using Softline so the
  // flat form collapses cleanly.
  leadingSep := IfBreak(Hardline(), flatPad)
  trailingSep := IfBreak(Hardline(), flatPad)

  bodyBlock := Indent(ctx.indentUnit(), leadingSep, body, trailing)
  doc := Concat(openTok, bodyBlock, trailingSep, closeTok)
  return Group(doc)
}

// printListHuggingLast renders the "last-argument hugging" shape that
// Prettier uses for `foo(a, b, () => { … })`: the leading items still
// flow comma-separated, but the final item stays attached to the
// closing paren instead of being pushed onto its own indented line.
//
//  flat:   OPEN a, b, last CLOSE
//  hugged: OPEN a, b, OPEN-of-last … CLOSE-of-last CLOSE
//
// The result is *not* wrapped in a Group: a huggable last argument is
// almost always a callback or object literal whose own printer already
// carries the fit-or-break decision for its body. Wrapping here would
// let a multi-line body force the whole `a, b,` prefix to break, which
// is the regression this shape exists to avoid.
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

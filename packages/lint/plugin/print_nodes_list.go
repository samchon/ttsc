package main

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
}

// printList renders the list shape as a Doc tree. Empty lists collapse
// to `OPENCLOSE`. Single-element lists still wrap so trailing-comma
// logic stays uniform.
func printList(ctx *PrintContext, shape listShape) Doc {
  if len(shape.Items) == 0 {
    return Text(shape.OpenTok + shape.CloseTok)
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

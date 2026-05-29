package linthost

import "strings"

// Printer engine: lay out a Doc tree under a column budget.
//
// The algorithm is the same fit-or-break decision Prettier and dprint
// use, originally from Wadler's "A Prettier Printer" with Lindig's
// strictness fix:
//
//  1. Walk a stack of (indent, mode, doc) frames.
//  2. When a Group is popped in unknown mode, peek ahead to see whether
//     its flat layout fits within the remaining columns on the current
//     line. The peek uses a separate stack so the main walk is not
//     disturbed.
//  3. If it fits, the group renders flat: Lines collapse to single
//     spaces, Softlines to nothing, IfBreak picks the flat side.
//  4. If it does not fit, the group renders broken: Lines and Softlines
//     emit newline+indent, IfBreak picks the break side, every nested
//     Group is measured again under its own remaining-column budget
//     (this is the strictness fix; a naive "broken propagates to all
//     descendants" rule produces uglier output for nested structures).
//  5. Hardline always emits a newline and forces its enclosing Group
//     into broken mode irrespective of width.
//  6. LineSuffix output is queued in a local buffer and flushed on the
//     next newline emission, so trailing comments stick to their
//     originating source line.
//
// The engine does not modify the input Doc tree, so the same tree can
// be printed multiple times (e.g. for testing under several widths).

// PrintOptions configures the layout pass.
//
// PrintWidth is the column budget per line (Prettier's `printWidth`).
// TabWidth is the indentation increment in columns (Prettier's
// `tabWidth`). UseTabs swaps space indentation for tab characters; when
// it is true the printer emits one tab per `TabWidth` columns and falls
// back to spaces for the remainder, matching dprint's "indent with
// tabs, align with spaces" convention.
//
// EndOfLine is the line terminator: "lf" (default) or "crlf".
//
// StartingColumn is the column the first character of the printed
// output will land in. When the printer is invoked to reflow an
// interior node (e.g. an object literal that begins partway through
// its enclosing source line), fit measurement must charge that
// column against the remaining budget.
//
// BaseIndent is the column continuation lines indent to. It is
// usually the indent of the line containing the printed node — not
// the column of the node itself. The two differ for "right-hand-side"
// reflows such as `const x = { … }`: the `{` may live at column 10
// but its broken-form children should indent to column 2
// (BaseIndent=0 + indentUnit=2), matching every JS formatter's
// convention of indenting relative to the surrounding line's left
// edge.
//
// Asymmetry on the first line: the engine never emits an indent for
// the first character of the printed output. The first line uses
// `StartingColumn` only — fit measurement charges it, but
// `writeIndent` is not called. Every newline after that emits
// `BaseIndent` plus any nested `Indent` contributions, which is what
// makes the close brace of a reflowed list land at `BaseIndent`
// while its children sit at `BaseIndent + indentUnit`.
//
// TrailingComma mirrors Prettier's `trailingComma` setting and controls
// which broken-list shapes the printer emits a trailing comma on:
//
//   - "all"  (default)  every multi-line list gets one.
//   - "es5"             arrays, objects, named imports / exports get one;
//     call arguments, parameter lists, and type-level
//     lists do not — those positions accepted trailing
//     commas only in ES2017+, so es5 mode skips them
//     to match Prettier and avoid oscillating against
//     the formatter on every cascade pass.
//   - "none"            no list gets one.
//
// An empty string is treated as "all", which keeps `DefaultPrintOptions()`
// callers and tests that pre-date this field on their original behavior.
//
// Defaults of 0 keep the engine usable for top-of-file reflow without
// a wrapper.
type PrintOptions struct {
  PrintWidth     int
  TabWidth       int
  UseTabs        bool
  EndOfLine      string
  TrailingComma  string
  StartingColumn int
  BaseIndent     int
}

// DefaultPrintOptions returns the Prettier defaults: 80-column lines,
// 2-space indentation, LF line terminators, trailing commas on every
// multi-line list (the `trailingComma: "all"` default Prettier adopted
// in v2).
func DefaultPrintOptions() PrintOptions {
  return PrintOptions{PrintWidth: 80, TabWidth: 2, UseTabs: false, EndOfLine: "lf", TrailingComma: "all"}
}

// printMode is the per-group choice made by the fit measurement.
type printMode uint8

const (
  modeFlat  printMode = iota // group fits flat
  modeBreak                  // group renders broken
)

// printFrame is one entry on the layout stack.
type printFrame struct {
  indent int
  mode   printMode
  doc    Doc
}

// Print renders the doc tree under the supplied options and returns the
// resulting string. The output never contains a trailing line break the
// doc tree did not request; trailing whitespace inside text fragments
// is preserved verbatim.
func Print(doc Doc, opts PrintOptions) string {
  if opts.PrintWidth <= 0 {
    opts.PrintWidth = 80
  }
  if opts.TabWidth <= 0 {
    opts.TabWidth = 2
  }
  if opts.EndOfLine == "" {
    opts.EndOfLine = "lf"
  }
  newline := "\n"
  if opts.EndOfLine == "crlf" {
    newline = "\r\n"
  }

  var out strings.Builder
  col := opts.StartingColumn
  var lineSuffix []Doc
  stack := []printFrame{{indent: opts.BaseIndent, mode: modeBreak, doc: doc}}

  flushLineSuffix := func() {
    if len(lineSuffix) == 0 {
      return
    }
    // LineSuffix children must land *before* the newline that
    // triggered the flush. Render them synchronously into the
    // output buffer. LineSuffix payloads are leaf-ish by contract
    // (the canonical use is a trailing `// comment` Text), so a
    // recursive Print is bounded and avoids the lifecycle hazard
    // of pushing onto the main stack — which would queue the
    // docs after the caller has already written the newline,
    // inverting the source order.
    pending := lineSuffix
    lineSuffix = nil
    for _, d := range pending {
      s := Print(d, opts)
      out.WriteString(s)
      if idx := strings.LastIndex(s, "\n"); idx >= 0 {
        col = len(s) - idx - 1
      } else {
        col += len(s)
      }
    }
  }

  writeIndent := func(indent int) int {
    if opts.UseTabs {
      tabs := indent / opts.TabWidth
      spaces := indent - tabs*opts.TabWidth
      for i := 0; i < tabs; i++ {
        out.WriteByte('\t')
      }
      for i := 0; i < spaces; i++ {
        out.WriteByte(' ')
      }
      return tabs*opts.TabWidth + spaces
    }
    for i := 0; i < indent; i++ {
      out.WriteByte(' ')
    }
    return indent
  }

  for len(stack) > 0 {
    top := stack[len(stack)-1]
    stack = stack[:len(stack)-1]

    switch top.doc.Kind {
    case docNil:
      // no-op
    case docText:
      out.WriteString(top.doc.Text)
      // Update column. A text fragment may contain embedded
      // newlines (verbatim slices). The column tracker counts
      // from the last newline.
      if idx := strings.LastIndex(top.doc.Text, "\n"); idx >= 0 {
        col = len(top.doc.Text) - idx - 1
      } else {
        col += len(top.doc.Text)
      }
    case docConcat:
      // Push children in reverse so they pop in source order.
      for i := len(top.doc.Children) - 1; i >= 0; i-- {
        stack = append(stack, printFrame{indent: top.indent, mode: top.mode, doc: top.doc.Children[i]})
      }
    case docIndent:
      child := Concat(top.doc.Children...)
      stack = append(stack, printFrame{indent: top.indent + top.doc.Width, mode: top.mode, doc: child})
    case docAlign:
      child := Concat(top.doc.Children...)
      stack = append(stack, printFrame{indent: col, mode: top.mode, doc: child})
    case docGroup:
      // Try flat unless the group is forced broken or its flat form
      // would overflow the remaining width.
      child := Concat(top.doc.Children...)
      if !top.doc.Break && fits(child, opts.PrintWidth-col, top.indent) {
        stack = append(stack, printFrame{indent: top.indent, mode: modeFlat, doc: child})
      } else {
        stack = append(stack, printFrame{indent: top.indent, mode: modeBreak, doc: child})
      }
    case docConditionalGroup:
      // Render the first option whose first line fits the remaining
      // width; fall back to the last option when none do. fitsFirstLine
      // measures only up to an option's first break, so an option whose
      // later lines wrap — a hugged callback body — is still eligible.
      options := top.doc.Children
      if len(options) > 0 {
        chosen := options[len(options)-1]
        for i := 0; i < len(options)-1; i++ {
          if fitsFirstLine(options[i], opts.PrintWidth-col) {
            chosen = options[i]
            break
          }
        }
        stack = append(stack, printFrame{indent: top.indent, mode: top.mode, doc: chosen})
      }
    case docIfBreak:
      pick := top.doc.Children[1] // flat
      if top.mode == modeBreak {
        pick = top.doc.Children[0]
      }
      stack = append(stack, printFrame{indent: top.indent, mode: top.mode, doc: pick})
    case docLineSuffix:
      lineSuffix = append(lineSuffix, top.doc.Children...)
    case docLine:
      if top.mode == modeFlat {
        out.WriteByte(' ')
        col++
      } else {
        flushLineSuffix()
        out.WriteString(newline)
        col = writeIndent(top.indent)
      }
    case docSoftline:
      if top.mode == modeFlat {
        // renders to nothing
      } else {
        flushLineSuffix()
        out.WriteString(newline)
        col = writeIndent(top.indent)
      }
    case docHardline:
      flushLineSuffix()
      out.WriteString(newline)
      col = writeIndent(top.indent)
    case docLiteralline:
      flushLineSuffix()
      out.WriteString(newline)
      col = 0
    }
  }

  // Drain any line suffix that never met a break. They flow inline.
  // Keep `col` in sync with what we emit so any future post-drain
  // emission can rely on the invariant; today the drain is the last
  // statement, but the bookkeeping discipline shouldn't depend on
  // that.
  for _, d := range lineSuffix {
    s := Print(d, opts)
    out.WriteString(s)
    if idx := strings.LastIndex(s, "\n"); idx >= 0 {
      col = len(s) - idx - 1
    } else {
      col += len(s)
    }
  }
  _ = col

  return out.String()
}

// fits reports whether `doc` renders flat within `remaining` columns,
// where the current indent is `indent`. The peek is iterative and
// stops at the first break-forcing event:
//
//   - a Hardline / Literalline: the doc cannot render flat.
//   - a Text that overflows: the doc does not fit.
//   - a Line / Softline encountered in *flat* mode: counts as space
//     (Line) or empty (Softline) and the walk continues.
//   - a Line / Softline encountered while the engine has already
//     committed the enclosing group to break mode: the peek returns
//     true immediately because the upstream caller will not place this
//     doc on the current line at all (the newline absorbs the
//     remaining budget).
//
// The implementation is a small interpreter that mirrors the main loop,
// but it only tracks remaining columns and only handles the subset of
// kinds that matter for measurement.
func fits(doc Doc, remaining int, indent int) bool {
  if remaining < 0 {
    return false
  }
  type frame struct {
    mode printMode
    doc  Doc
  }
  stack := []frame{{mode: modeFlat, doc: doc}}
  for len(stack) > 0 {
    top := stack[len(stack)-1]
    stack = stack[:len(stack)-1]
    switch top.doc.Kind {
    case docNil:
    case docText:
      remaining -= len(top.doc.Text)
      if remaining < 0 {
        return false
      }
      // A Text whose payload spans multiple lines cannot render
      // flat — by definition its flat form is multi-line. Returning
      // true here would let the surrounding group commit to a flat
      // layout that already contains a newline, defeating the entire
      // fit-or-break decision. Force the caller to broken mode.
      if strings.Contains(top.doc.Text, "\n") {
        return false
      }
    case docConcat:
      for i := len(top.doc.Children) - 1; i >= 0; i-- {
        stack = append(stack, frame{mode: top.mode, doc: top.doc.Children[i]})
      }
    case docIndent, docAlign:
      for i := len(top.doc.Children) - 1; i >= 0; i-- {
        stack = append(stack, frame{mode: top.mode, doc: top.doc.Children[i]})
      }
    case docGroup:
      // A forced-broken group cannot contribute a flat layout; treat it
      // like a hard line break for the enclosing measurement.
      if top.doc.Break {
        return false
      }
      // Measure nested groups in flat mode too — that is the
      // standard Wadler choice: the outer group's "does my
      // flat form fit" question is answered by treating every
      // inner group as flat.
      for i := len(top.doc.Children) - 1; i >= 0; i-- {
        stack = append(stack, frame{mode: modeFlat, doc: top.doc.Children[i]})
      }
    case docConditionalGroup:
      // A conditional group's flat form is its first (flattest) option.
      if len(top.doc.Children) > 0 {
        stack = append(stack, frame{mode: top.mode, doc: top.doc.Children[0]})
      }
    case docIfBreak:
      pick := top.doc.Children[1]
      if top.mode == modeBreak {
        pick = top.doc.Children[0]
      }
      stack = append(stack, frame{mode: top.mode, doc: pick})
    case docLineSuffix:
      // Line suffix never contributes to flat width — it queues
      // for a future break. Skip.
    case docLine:
      if top.mode == modeFlat {
        remaining--
        if remaining < 0 {
          return false
        }
      } else {
        return true
      }
    case docSoftline:
      if top.mode == modeBreak {
        return true
      }
    case docHardline, docLiteralline:
      return false
    }
  }
  return true
}

// fitsFirstLine reports whether the first line of `doc` — every column
// up to its first line break — renders within `remaining` columns. It
// drives ConditionalGroup option selection: an option is eligible when
// its opening line fits, even if its later lines wrap.
//
// The walk treats every top-level break point as broken — an IfBreak
// takes its break branch, and a Line / Softline / Hardline ends the
// measurement — so it counts exactly the columns the option would place
// on the line the group starts on. A nested ConditionalGroup
// contributes its own first option.
//
// A nested Group is the exception: a Group with no hard break renders
// flat when it fits, so its Line separators collapse to spaces and stay
// on the first line. The walk measures such a Group's flattened width
// rather than stopping at its first Line; only a Group that carries a
// Hardline (flatten reports it cannot render flat) ends the first line
// at its break.
func fitsFirstLine(doc Doc, remaining int) bool {
  if remaining < 0 {
    return false
  }
  stack := []Doc{doc}
  for len(stack) > 0 {
    top := stack[len(stack)-1]
    stack = stack[:len(stack)-1]
    switch top.Kind {
    case docText:
      if idx := strings.IndexByte(top.Text, '\n'); idx >= 0 {
        // A multi-line Text ends the first line at its first newline.
        return remaining-idx >= 0
      }
      remaining -= len(top.Text)
      if remaining < 0 {
        return false
      }
    case docGroup:
      // A Group that can render flat keeps its Lines on the first line
      // as spaces — measure the flattened form. One that cannot (a
      // Hardline or forced break inside) breaks, so descend and let the
      // Line/Hardline case end the first line at that break.
      if flat, ok := flatten(top); ok {
        stack = append(stack, flat)
      } else {
        for i := len(top.Children) - 1; i >= 0; i-- {
          stack = append(stack, top.Children[i])
        }
      }
    case docConcat, docIndent, docAlign:
      for i := len(top.Children) - 1; i >= 0; i-- {
        stack = append(stack, top.Children[i])
      }
    case docConditionalGroup:
      if len(top.Children) > 0 {
        stack = append(stack, top.Children[0])
      }
    case docIfBreak:
      // Measuring in break mode: take the broken branch.
      stack = append(stack, top.Children[0])
    case docLine, docSoftline, docHardline, docLiteralline:
      // The first break ends the first line; what fit so far fits.
      return true
    case docNil, docLineSuffix:
      // No first-line width contribution.
    }
  }
  return true
}

// flatten returns the all-flat rendering of `doc`: every Group rendered
// flat, every IfBreak resolved to its flat branch, every Line collapsed
// to a single space and every Softline to nothing. The second result is
// false when the doc cannot render flat at all — it carries a Hardline,
// a Literalline, a forced-broken Group, a multi-line Text or a queued
// LineSuffix — and the caller must then drop the flat layout option.
func flatten(doc Doc) (Doc, bool) {
  switch doc.Kind {
  case docText:
    if strings.Contains(doc.Text, "\n") {
      return Doc{}, false
    }
    return doc, true
  case docLine:
    return Text(" "), true
  case docNil, docSoftline:
    return Doc{Kind: docNil}, true
  case docHardline, docLiteralline, docLineSuffix:
    return Doc{}, false
  case docIfBreak:
    return flatten(doc.Children[1])
  case docConditionalGroup:
    if len(doc.Children) == 0 {
      return Doc{Kind: docNil}, true
    }
    return flatten(doc.Children[0])
  case docGroup:
    if doc.Break {
      return Doc{}, false
    }
    return flattenChildren(doc.Children)
  case docConcat, docIndent, docAlign:
    return flattenChildren(doc.Children)
  }
  return doc, true
}

// flattenChildren flattens each child and concatenates the results,
// short-circuiting to (zero, false) when any child cannot render flat.
func flattenChildren(children []Doc) (Doc, bool) {
  out := make([]Doc, 0, len(children))
  for _, c := range children {
    fc, ok := flatten(c)
    if !ok {
      return Doc{}, false
    }
    out = append(out, fc)
  }
  return Concat(out...), true
}

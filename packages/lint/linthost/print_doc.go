package linthost

// Pretty-printer doc IR.
//
// This file defines the abstract layout language consumed by the printer
// engine in print_engine.go. The design is a Go port of the Wadler /
// Lindig algebra of pretty-printers that Prettier and dprint implement:
// a node-level printer translates an AST node into a tree of Doc
// values, and the engine lays the tree out under a width budget,
// breaking groups whose flat form would overflow.
//
// Doc is intentionally a sum type encoded as a tagged struct rather than
// an interface. The hot path of the engine is a tight loop over a slice
// of (indent, mode, doc) frames; an interface dispatch per node would
// dominate the cost. The tag is a small enum (DocKind) and each field is
// only read by the case that owns it.
//
// Layout contract:
//
//   - DocText is verbatim output. The printer never reflows or wraps it.
//     The caller is responsible for keeping its width meaningful — a
//     text fragment longer than printWidth still flows verbatim, but it
//     will force surrounding groups to break.
//   - DocLine renders as either a single space or a newline + indent,
//     depending on the surrounding group's chosen mode. Use this for
//     soft separators (e.g. between call arguments).
//   - DocSoftline is the empty-or-newline variant: flat mode emits
//     nothing, break mode emits a newline + indent.
//   - DocHardline always emits a newline and propagates "break" upward to
//     every enclosing group. Use it for declarations that must stand on
//     their own line regardless of width.
//   - DocLiteralline is a hardline that does NOT emit indentation after
//     the newline. Used for template-literal interior lines where the
//     original spacing must be preserved.
//   - DocGroup is the fit-or-break primitive: the engine measures the
//     group's flat width; if it fits in the remaining column budget the
//     group renders flat (Lines collapse to spaces, Softlines to
//     nothing), otherwise it breaks (Lines and Softlines emit
//     newline+indent).
//   - DocIndent adds N columns of indentation to every newline emitted
//     by its child doc. Nesting composes: an Indent inside another
//     Indent adds the two amounts.
//   - DocAlign is like Indent but the increment is the current output
//     column rather than a fixed offset. Used to align continuation
//     lines under an opening token (e.g. inside a call expression's
//     arguments).
//   - DocIfBreak renders one doc when the surrounding group breaks and
//     another when it stays flat. The canonical use is a trailing comma
//     that should appear only in multi-line lists.
//   - DocConcat is a sequence of child docs. The printer flattens nested
//     concats inline.
//   - DocLineSuffix queues output until the next hardline/softline that
//     actually breaks; used for trailing line comments that must stick
//     to their source line.
//   - DocConditionalGroup offers an ordered list of layout options; the
//     engine renders the first whose first line fits the width budget
//     and uses the last option as the unconditional fallback.
//
// The doc tree is built by helper constructors (Text, Line, Group, …)
// below. Constructors take their children as variadic or slice
// arguments so call sites read like a layout DSL.

// DocKind is the discriminant tag for a Doc node. Only the variant
// fields relevant to that kind are populated; all others stay at their
// zero value.
type DocKind uint8

const (
  docNil DocKind = iota
  docText
  docLine
  docSoftline
  docHardline
  docLiteralline
  docGroup
  docIndent
  docAlign
  docIfBreak
  docConcat
  docLineSuffix
  docConditionalGroup
  docFill
)

// Doc is one node in the layout tree. Only the fields relevant to the
// kind are populated; the rest stay at their zero value.
//
// Doc is a value type. Helper constructors return a fresh Doc, so the
// caller never needs to copy. The engine reads Doc trees but never
// mutates them, so concurrent prints over a shared tree are safe.
//
// The `Width` field carries the column increment for `docIndent`
// nodes. It is named `Width` rather than `Indent` to avoid a
// collision with the `Indent()` constructor, which would otherwise
// shadow the field name at every constructor body.
type Doc struct {
  Kind     DocKind
  Text     string
  Children []Doc
  Width    int
  // Break, meaningful only on a docGroup, forces the group to render
  // broken regardless of whether its flat form would fit. A
  // ConditionalGroup option uses it to commit its last argument — a
  // hugged object literal — to the multi-line shape.
  Break bool
  // IfBreak pairs: BreakChild stored in Children[0], FlatChild in Children[1].
}

// Text constructs a verbatim text doc.
func Text(s string) Doc { return Doc{Kind: docText, Text: s} }

// Line is the soft separator: space when flat, newline+indent when broken.
func Line() Doc { return Doc{Kind: docLine} }

// Softline is the empty-or-newline separator.
func Softline() Doc { return Doc{Kind: docSoftline} }

// Hardline forces a newline and propagates break upward.
func Hardline() Doc { return Doc{Kind: docHardline} }

// Literalline is a hardline that emits the newline without applying
// indentation. The next characters appear in column 0 of the new line.
func Literalline() Doc { return Doc{Kind: docLiteralline} }

// Group wraps a child doc in a fit-or-break decision. Variadic args are
// concatenated.
func Group(parts ...Doc) Doc { return Doc{Kind: docGroup, Children: parts} }

// ConditionalGroup picks the first option whose first line fits the
// remaining width budget, falling back to the last option when none
// fit. Where Group makes a single flat-or-break decision, a
// ConditionalGroup lets a printer offer several distinct shapes — a
// call's hugged vs. exploded argument list — and have the engine choose
// between them. The last option must always be a safe fallback.
func ConditionalGroup(options ...Doc) Doc {
  return Doc{Kind: docConditionalGroup, Children: options}
}

// Fill renders an alternating [content, separator, content, separator, …,
// content] sequence with Wadler/Prettier "fill" semantics: it places as many
// contents on a line as fit, breaking a separator to a new line only when the
// next content (with its separator) would overflow. Used for concisely-printed
// numeric arrays (`[1, 2, 3, … ]` packed several per line), where a plain
// one-item-per-line break would waste space. `parts` must have odd length
// (content at even indices, separators at odd).
func Fill(parts ...Doc) Doc { return Doc{Kind: docFill, Children: parts} }

// Indent adds `width` columns of indentation to every newline emitted by
// the child doc. Nesting composes.
func Indent(width int, parts ...Doc) Doc {
  return Doc{Kind: docIndent, Width: width, Children: parts}
}

// Align makes every newline emitted by the child doc align to the
// current output column rather than to a fixed indent.
func Align(parts ...Doc) Doc { return Doc{Kind: docAlign, Children: parts} }

// IfBreak emits `whenBroken` when the surrounding group breaks and
// `whenFlat` when it stays flat. The two arguments are stored as
// Children[0] and Children[1] respectively.
func IfBreak(whenBroken, whenFlat Doc) Doc {
  return Doc{Kind: docIfBreak, Children: []Doc{whenBroken, whenFlat}}
}

// Concat sequences child docs. Empty Concat is the layout no-op.
func Concat(parts ...Doc) Doc {
  if len(parts) == 1 {
    return parts[0]
  }
  return Doc{Kind: docConcat, Children: parts}
}

// LineSuffix queues output until the next line break. Used for trailing
// line comments that must appear after the current source line ends.
//
// The payload is expected to be single-line: it is emitted verbatim at the
// line break and is NOT re-indented across any embedded newlines.
func LineSuffix(parts ...Doc) Doc {
  return Doc{Kind: docLineSuffix, Children: parts}
}

// Join interleaves `sep` between the entries of `parts` and returns the
// flattened concat. Empty input returns a no-op doc. Single-entry input
// returns the entry verbatim.
func Join(sep Doc, parts []Doc) Doc {
  switch len(parts) {
  case 0:
    return Doc{Kind: docNil}
  case 1:
    return parts[0]
  }
  out := make([]Doc, 0, len(parts)*2-1)
  for i, p := range parts {
    if i > 0 {
      out = append(out, sep)
    }
    out = append(out, p)
  }
  return Concat(out...)
}

// IsNil reports whether the doc is the zero-value no-op. Helpful when a
// helper returns "nothing to print" — the engine ignores nil docs.
func (d Doc) IsNil() bool { return d.Kind == docNil }

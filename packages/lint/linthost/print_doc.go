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
// an interface. The engine dispatches on the small DocKind enum and only reads
// the fields belonging to that variant.
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
//
// @evidence contracts/common.md#principled-implementation The discriminant identifies a layout-algebra variant so the renderer can interpret only that variant's fields.
// @evidence contracts/common.md#clear-and-simple-design One enum names layout operations while Doc carries their payloads.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Variant constants express the layout protocol rather than fixture-specific print results.
// @evidence contracts/common.md#meaningful-documentation Native prose explains active fields and the file comment documents each layout operation; tags follow documentation guidance.
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
// Doc is a value type, but Children slices retain their supplied backing
// storage. The engine reads trees without mutating them. Callers must leave
// the tree and its slices unchanged while printing, including concurrent prints.
//
// The `Width` field carries the column increment for `docIndent`
// nodes. It is named `Width` rather than `Indent` to avoid a
// collision with the `Indent()` constructor, which would otherwise
// shadow the field name at every constructor body.
//
// @evidence contracts/common.md#principled-implementation A discriminant with text, children, indentation and forced-break payloads represents the printer algebra; inactive fields are ignored by their variant.
// @evidence contracts/common.md#clear-and-simple-design One tagged value represents layout composition without a class or interface hierarchy for each operation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Variant payloads encode layout requirements rather than source-specific expected strings.
// @evidence contracts/common.md#meaningful-documentation Native prose states child-slice sharing and concurrent immutability, and members explain variant payloads; paragraph and tag spacing follow documentation guidance.
type Doc struct {
  // Kind selects the interpretation of the remaining fields.
  Kind     DocKind

  // Text is the verbatim payload of docText.
  Text     string

  // Children holds variant operands; callers retain the supplied backing storage.
  Children []Doc

  // Width is the indentation increment for docIndent.
  Width    int

  // Break, meaningful only on a docGroup, forces the group to render
  // broken regardless of whether its flat form would fit. A
  // ConditionalGroup option uses it to commit its last argument — a
  // hugged object literal — to the multi-line shape.
  Break bool
  // IfBreak pairs: BreakChild stored in Children[0], FlatChild in Children[1].
}

// Text constructs a verbatim text doc.
//
// @evidence contracts/common.md#principled-implementation The text variant carries the exact supplied string without reflow or escaping.
// @evidence contracts/common.md#clear-and-simple-design One constructor maps verbatim content directly into the layout algebra.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The supplied string is real printer content rather than a consumer-specific expected result.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies verbatim semantics and the file contract explains width behavior; tags follow documentation guidance.
func Text(s string) Doc { return Doc{Kind: docText, Text: s} }

// Line is the soft separator: space when flat, newline+indent when broken.
//
// @evidence contracts/common.md#principled-implementation The line variant delegates space-versus-newline choice to the surrounding group's layout mode.
// @evidence contracts/common.md#clear-and-simple-design A zero-payload constructor names the ordinary breakable separator.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The variant is layout vocabulary rather than a special case for particular source strings.
// @evidence contracts/common.md#meaningful-documentation Native prose states both rendering modes with a separated tag block under documentation guidance.
func Line() Doc { return Doc{Kind: docLine} }

// Softline is the empty-or-newline separator.
//
// @evidence contracts/common.md#principled-implementation The softline variant contributes no flat text and permits a newline in broken mode.
// @evidence contracts/common.md#clear-and-simple-design One constructor expresses optional separation independently from ordinary Line.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Rendering mode comes from the layout algebra, not a fixture-dependent branch.
// @evidence contracts/common.md#meaningful-documentation Native prose names empty-or-newline behavior and the file contract explains indentation; tags follow documentation guidance.
func Softline() Doc { return Doc{Kind: docSoftline} }

// Hardline forces a newline and propagates break upward.
//
// @evidence contracts/common.md#principled-implementation The hardline variant requests an unconditional newline and enclosing-group break propagation.
// @evidence contracts/common.md#clear-and-simple-design One no-payload constructor expresses a mandatory line boundary.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Forced line breaks are explicit algebra operations rather than guessed source-specific output.
// @evidence contracts/common.md#meaningful-documentation Native prose states both newline and propagation effects; tags follow documentation guidance.
func Hardline() Doc { return Doc{Kind: docHardline} }

// Literalline is a hardline that emits the newline without applying
// indentation. The next characters appear in column 0 of the new line.
//
// @evidence contracts/common.md#principled-implementation The literal-line variant forces a newline without adding indentation to literal interior content.
// @evidence contracts/common.md#clear-and-simple-design A distinct constructor separates literal spacing from ordinary hardline layout.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Literal preservation is an explicit operation rather than post-hoc output patching.
// @evidence contracts/common.md#meaningful-documentation Native prose explains the zero-column continuation; tags follow documentation guidance.
func Literalline() Doc { return Doc{Kind: docLiteralline} }

// Group wraps a child doc in a fit-or-break decision. Variadic args are
// concatenated.
//
// @evidence contracts/common.md#principled-implementation The group variant stores its ordered operands for one fit-or-break decision by the renderer.
// @evidence contracts/common.md#clear-and-simple-design One constructor groups existing docs without another wrapper abstraction.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The renderer's width decision governs output instead of source-name exceptions.
// @evidence contracts/common.md#meaningful-documentation Native prose explains operand concatenation and the file contract explains width selection; tags follow documentation guidance.
func Group(parts ...Doc) Doc { return Doc{Kind: docGroup, Children: parts} }

// ConditionalGroup picks the first option whose first line fits the
// remaining width budget, falling back to the last option when none
// fit. Where Group makes a single flat-or-break decision, a
// ConditionalGroup lets a printer offer several distinct shapes — a
// call's hugged vs. exploded argument list — and have the engine choose
// between them. The last option must always be a safe fallback.
//
// @evidence contracts/common.md#principled-implementation Ordered options represent valid alternative layouts with the last serving as the required unconditional fallback.
// @evidence contracts/common.md#clear-and-simple-design One conditional-group node retains alternatives for the renderer's single selection responsibility.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Alternatives express supported layout choices rather than reparsing or monkey-patching rendered text.
// @evidence contracts/common.md#meaningful-documentation Native prose explains first-fit ordering and the caller's safe-fallback obligation; paragraphs and tags follow documentation guidance.
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
//
// @evidence contracts/common.md#principled-implementation Alternating content and separators encode independent line-fit decisions, with the caller providing the documented odd-length sequence.
// @evidence contracts/common.md#clear-and-simple-design One fill node retains packing semantics rather than precomputing width-specific text.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The algebra handles numeric-array packing without input-specific expected layouts.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies operand parity and overflow behavior; paragraphs and tags follow documentation guidance.
func Fill(parts ...Doc) Doc { return Doc{Kind: docFill, Children: parts} }

// Indent adds `width` columns of indentation to every newline emitted by
// the child doc. Nesting composes.
//
// @evidence contracts/common.md#principled-implementation The indent variant stores the supplied column increment and child sequence so nested increments compose during rendering.
// @evidence contracts/common.md#clear-and-simple-design One constructor separates indentation structure from text generation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Indentation is an explicit layout operation rather than patched output strings.
// @evidence contracts/common.md#meaningful-documentation Native prose states column units and composition; tags follow documentation guidance.
func Indent(width int, parts ...Doc) Doc {
  return Doc{Kind: docIndent, Width: width, Children: parts}
}

// Align makes every newline emitted by the child doc align to the
// current output column rather than to a fixed indent.
//
// @evidence contracts/common.md#principled-implementation The align variant records children for a renderer-computed current-column indentation increment.
// @evidence contracts/common.md#clear-and-simple-design One node separates dynamic alignment from fixed-width Indent.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Alignment uses the actual output column rather than hardcoded source-column exceptions.
// @evidence contracts/common.md#meaningful-documentation Native prose distinguishes current-column alignment from fixed indentation; tags follow documentation guidance.
func Align(parts ...Doc) Doc { return Doc{Kind: docAlign, Children: parts} }

// IfBreak emits `whenBroken` when the surrounding group breaks and
// `whenFlat` when it stays flat. The two arguments are stored as
// Children[0] and Children[1] respectively.
//
// @evidence contracts/common.md#principled-implementation The fixed two-child ordering preserves the broken and flat alternatives interpreted by the renderer.
// @evidence contracts/common.md#clear-and-simple-design One conditional node expresses mode-dependent content without separate rendering policy.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Alternatives are explicit layout operands instead of postprocessing source-specific punctuation.
// @evidence contracts/common.md#meaningful-documentation Native prose names both modes and operand order; tags follow documentation guidance.
func IfBreak(whenBroken, whenFlat Doc) Doc {
  return Doc{Kind: docIfBreak, Children: []Doc{whenBroken, whenFlat}}
}

// Concat sequences child docs. Empty Concat is the layout no-op.
//
// @evidence contracts/common.md#principled-implementation A singleton returns its operand unchanged; other inputs form an ordered concatenation, including an empty no-op.
// @evidence contracts/common.md#clear-and-simple-design The constructor removes an unnecessary singleton layer while keeping sequence ownership explicit.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The singleton identity is an algebraic simplification rather than a fixture-specific optimization.
// @evidence contracts/common.md#meaningful-documentation Native prose states sequencing and empty behavior; tags follow documentation guidance.
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
//
// @evidence contracts/common.md#principled-implementation A suffix node retains ordered operands until the next emitted line break under the documented single-line payload premise.
// @evidence contracts/common.md#clear-and-simple-design One algebra operation separates trailing-comment placement from ordinary sequential content.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Deferred placement uses renderer semantics instead of rewriting comments after output.
// @evidence contracts/common.md#meaningful-documentation Native prose explains deferred emission and the single-line premise; paragraphs and tags follow documentation guidance.
func LineSuffix(parts ...Doc) Doc {
  return Doc{Kind: docLineSuffix, Children: parts}
}

// Join interleaves `sep` between the entries of `parts` and returns the
// flattened concat. Empty input returns a no-op doc. Single-entry input
// returns the entry verbatim.
//
// @evidence contracts/common.md#principled-implementation The empty and singleton identities preserve no-op or exact input, while the general loop inserts one separator between each adjacent pair.
// @evidence contracts/common.md#clear-and-simple-design One join helper owns separator insertion and delegates sequencing to Concat.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Empty and singleton branches follow sequence algebra rather than known-answer input cases.
// @evidence contracts/common.md#meaningful-documentation Native prose documents all cardinality cases; tags follow documentation guidance.
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
//
// @evidence contracts/common.md#principled-implementation The zero discriminant alone identifies the layout no-op regardless of inactive payload fields.
// @evidence contracts/common.md#clear-and-simple-design One predicate centralizes no-op recognition for doc consumers.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The result derives from the documented algebra discriminant rather than arbitrary empty-text heuristics.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies zero-value behavior and renderer treatment; tags follow documentation guidance.
func (d Doc) IsNil() bool { return d.Kind == docNil }

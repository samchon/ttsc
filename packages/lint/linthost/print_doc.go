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
//   - docText is verbatim output. The printer never reflows or wraps it.
//     The caller is responsible for keeping its width meaningful — a
//     text fragment longer than printWidth still flows verbatim, but it
//     will force surrounding groups to break.
//   - docLine renders as either a single space or a newline + indent,
//     depending on the surrounding group's chosen mode. Use this for
//     soft separators (e.g. between call arguments).
//   - docSoftline is the empty-or-newline variant: flat mode emits
//     nothing, break mode emits a newline + indent.
//   - docHardline always emits a newline and propagates "break" upward to
//     every enclosing group. Use it for declarations that must stand on
//     their own line regardless of width.
//   - docLiteralline is a hardline that does NOT emit indentation after
//     the newline. Used for template-literal interior lines where the
//     original spacing must be preserved.
//   - docGroup is the fit-or-break primitive: the engine measures the
//     group's flat width; if it fits in the remaining column budget the
//     group renders flat (Lines collapse to spaces, Softlines to
//     nothing), otherwise it breaks (Lines and Softlines emit
//     newline+indent).
//   - docIndent adds N columns to child newline indentation; nested increments
//     compose. Literal lines intentionally skip that indentation.
//   - docAlign replaces child indentation with the current output column.
//     It aligns continuation lines under an opening token, except literal
//     lines that intentionally emit no indentation.
//   - docIfBreak renders one doc when the surrounding group breaks and
//     another when it stays flat. The canonical use is a trailing comma
//     that should appear only in multi-line lists.
//   - docConcat is a sequence of child docs. The printer flattens nested
//     concats inline.
//   - docLineSuffix queues output until the next hardline/softline that
//     actually breaks; used for trailing line comments that must stick
//     to their source line.
//   - docConditionalGroup offers an ordered list of layout options; the
//     engine renders the first whose first line fits the width budget
//     and uses the last option as the unconditional fallback.
//   - docFill packs alternating content and separator docs, breaking a
//     separator only when the next content would overflow the line.
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
// @evidenceExclude contracts/portability.md#os-neutral-implementation DocKind is a declaration of data shape and performs no filesystem, path or process operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms DocKind is a declaration of data shape and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work DocKind is a declaration of data shape and coordinates no computation that could be shared.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources DocKind is a declaration of data shape; the code that holds its values owns their lifetime.
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
// @evidenceExclude contracts/portability.md#os-neutral-implementation Doc is a declaration of data shape and performs no filesystem, path or process operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms Doc is a declaration of data shape and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Doc is a declaration of data shape and coordinates no computation that could be shared.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Doc is a declaration of data shape; the code that holds its values owns their lifetime.
type Doc struct {
  // Kind selects the interpretation of the remaining fields.
  Kind DocKind

  // Text is the verbatim payload of docText.
  Text string

  // Children holds variant operands; callers retain the supplied backing storage.
  Children []Doc

  // Width is the indentation increment for docIndent.
  Width int

  // Break, meaningful only on a docGroup, forces the group to render
  // broken regardless of whether its flat form would fit. A
  // A ConditionalGroup option can contain a forced-broken group, for example
  // a hugged final object or array argument, to preserve its multiline shape.
  Break bool
  // IfBreak pairs: BreakChild stored in Children[0], FlatChild in Children[1].
}

// Text constructs a verbatim text doc.
//
// @evidence contracts/common.md#principled-implementation The text variant carries the exact supplied string without reflow or escaping.
// @evidence contracts/common.md#clear-and-simple-design One constructor maps verbatim content directly into the layout algebra.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The supplied string is real printer content rather than a consumer-specific expected result.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies verbatim semantics and the file contract explains width behavior; tags follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Text performs no filesystem or process operation of its own.
// @evidenceExclude contracts/performance.md#efficient-algorithms This constructor chooses no text-processing algorithm: copying the string descriptor and Kind is constant work, with no byte traversal or rendered output allocation. The printer owns later width measurement and output writing.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Text constructs a value, not a request coordinator or memoized render. The immutable string bytes are already shared; renderer width/options and layout effects belong to the printing owner.
// @evidence contracts/performance.md#bound-retention-and-release-resources The returned Doc keeps the supplied string storage reachable without copying its bytes; a substring may retain a larger backing string. The caller owns Doc/tree lifetime, and release of all references permits reclamation. No historical text cache, handle or task is created here.
func Text(s string) Doc { return Doc{Kind: docText, Text: s} }

// Line is the soft separator: space when flat, newline+indent when broken.
//
// @evidence contracts/common.md#principled-implementation The line variant delegates space-versus-newline choice to the surrounding group's layout mode.
// @evidence contracts/common.md#clear-and-simple-design A zero-payload constructor names the ordinary breakable separator.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The variant is layout vocabulary rather than a special case for particular source strings.
// @evidence contracts/common.md#meaningful-documentation Native prose states both rendering modes with a separated tag block under documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Line performs no filesystem or process operation of its own.
// @evidenceExclude contracts/performance.md#efficient-algorithms Line has no loop of its own and runs a fixed number of steps.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Line keeps no cache and shares no in-flight computation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Line acquires no handle or task and retains nothing beyond the receiver's own fields.
func Line() Doc { return Doc{Kind: docLine} }

// Softline is the empty-or-newline separator.
//
// @evidence contracts/common.md#principled-implementation The softline variant contributes no flat text and permits a newline in broken mode.
// @evidence contracts/common.md#clear-and-simple-design One constructor expresses optional separation independently from ordinary Line.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Rendering mode comes from the layout algebra, not a fixture-dependent branch.
// @evidence contracts/common.md#meaningful-documentation Native prose names empty-or-newline behavior and the file contract explains indentation; tags follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Softline performs no filesystem or process operation of its own.
// @evidenceExclude contracts/performance.md#efficient-algorithms Softline has no loop of its own and runs a fixed number of steps.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Softline keeps no cache and shares no in-flight computation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Softline acquires no handle or task and retains nothing beyond the receiver's own fields.
func Softline() Doc { return Doc{Kind: docSoftline} }

// Hardline forces a newline and propagates break upward.
//
// @evidence contracts/common.md#principled-implementation The hardline variant requests an unconditional newline and enclosing-group break propagation.
// @evidence contracts/common.md#clear-and-simple-design One no-payload constructor expresses a mandatory line boundary.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Forced line breaks are explicit algebra operations rather than guessed source-specific output.
// @evidence contracts/common.md#meaningful-documentation Native prose states both newline and propagation effects; tags follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Hardline performs no filesystem or process operation of its own.
// @evidenceExclude contracts/performance.md#efficient-algorithms Hardline has no loop of its own and runs a fixed number of steps.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Hardline keeps no cache and shares no in-flight computation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Hardline acquires no handle or task and retains nothing beyond the receiver's own fields.
func Hardline() Doc { return Doc{Kind: docHardline} }

// Literalline is a hardline that emits the newline without applying
// indentation. The next characters appear in column 0 of the new line.
//
// @evidence contracts/common.md#principled-implementation The literal-line variant forces a newline without adding indentation to literal interior content.
// @evidence contracts/common.md#clear-and-simple-design A distinct constructor separates literal spacing from ordinary hardline layout.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Literal preservation is an explicit operation rather than post-hoc output patching.
// @evidence contracts/common.md#meaningful-documentation Native prose explains the zero-column continuation; tags follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Literalline performs no filesystem or process operation of its own.
// @evidenceExclude contracts/performance.md#efficient-algorithms Literalline has no loop of its own and runs a fixed number of steps.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Literalline keeps no cache and shares no in-flight computation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Literalline acquires no handle or task and retains nothing beyond the receiver's own fields.
func Literalline() Doc { return Doc{Kind: docLiteralline} }

// Group wraps a child doc in a fit-or-break decision. Variadic args are
// concatenated.
//
// @evidence contracts/common.md#principled-implementation The group variant stores its ordered operands for one fit-or-break decision by the renderer.
// @evidence contracts/common.md#clear-and-simple-design One constructor groups existing docs without another wrapper abstraction.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The renderer's width decision governs output instead of source-name exceptions.
// @evidence contracts/common.md#meaningful-documentation Native prose explains operand concatenation and the file contract explains width selection; tags follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Group performs no filesystem or process operation of its own.
// @evidenceExclude contracts/performance.md#efficient-algorithms Group has no loop of its own and runs a fixed number of steps.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Group keeps no cache and shares no in-flight computation.
// @evidence contracts/performance.md#bound-retention-and-release-resources The returned group shares the supplied child backing slice and all reachable child payloads; the caller owns tree lifetime and must keep that storage immutable while printing. The constructor copies no child records and stores no historical groups, handle or task.
func Group(parts ...Doc) Doc { return Doc{Kind: docGroup, Children: parts} }

// ConditionalGroup picks the first option whose first line fits the
// remaining width budget, falling back to the last option when none
// fit. Where Group makes a single flat-or-break decision, a
// ConditionalGroup lets a printer offer distinct shapes, such as a hugged
// versus expanded argument list, and have the engine choose
// between them. The last option must always be a safe fallback.
//
// @evidence contracts/common.md#principled-implementation Ordered options represent valid alternative layouts with the last serving as the required unconditional fallback.
// @evidence contracts/common.md#clear-and-simple-design One conditional-group node retains alternatives for the renderer's single selection responsibility.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Alternatives express supported layout choices rather than reparsing or monkey-patching rendered text.
// @evidence contracts/common.md#meaningful-documentation Native prose explains first-fit ordering and the caller's safe-fallback obligation; paragraphs and tags follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation ConditionalGroup performs no filesystem or process operation of its own.
// @evidenceExclude contracts/performance.md#efficient-algorithms ConditionalGroup has no loop of its own and runs a fixed number of steps.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work ConditionalGroup keeps no cache and shares no in-flight computation.
// @evidence contracts/performance.md#bound-retention-and-release-resources The returned conditional group shares the supplied option slice and reachable alternative trees, including unused alternatives, until its owner releases them. The caller owns that storage and must keep it immutable during printing; this constructor adds no historical-option cache, handle or task.
func ConditionalGroup(options ...Doc) Doc {
  return Doc{Kind: docConditionalGroup, Children: options}
}

// Fill renders an alternating [content, separator, content, separator, …,
// content] sequence with Wadler/Prettier "fill" semantics: it places as many
// contents on a line as fit. A separator breaks when the current content or
// the current content plus separator and next content exceeds the budget.
// Used for concisely-printed
// numeric arrays (`[1, 2, 3, … ]` packed several per line), where a plain
// one-item-per-line break would waste space. `parts` must have odd length
// (content at even indices, separators at odd).
//
// @evidence contracts/common.md#principled-implementation Alternating content and separators encode independent line-fit decisions, with the caller providing the documented odd-length sequence.
// @evidence contracts/common.md#clear-and-simple-design One fill node retains packing semantics rather than precomputing width-specific text.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The algebra handles numeric-array packing without input-specific expected layouts.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies operand parity and overflow behavior; paragraphs and tags follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Fill performs no filesystem or process operation of its own.
// @evidenceExclude contracts/performance.md#efficient-algorithms Fill has no loop of its own and runs a fixed number of steps.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Fill keeps no cache and shares no in-flight computation.
// @evidence contracts/performance.md#bound-retention-and-release-resources The returned fill Doc shares the supplied alternating operand slice and reachable child payloads. Its caller owns tree lifetime and keeps those operands immutable during printing; this constructor creates no historical fill cache, handle or task.
func Fill(parts ...Doc) Doc { return Doc{Kind: docFill, Children: parts} }

// Indent adds width columns to indentation for breakable and hard newlines
// in its children; nested increments compose. Literalline intentionally writes
// no indentation and resets the output column to zero.
//
// @evidence contracts/common.md#principled-implementation The indent variant stores the supplied column increment and child sequence so nested increments compose during rendering.
// @evidence contracts/common.md#clear-and-simple-design One constructor separates indentation structure from text generation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Indentation is an explicit layout operation rather than patched output strings.
// @evidence contracts/common.md#meaningful-documentation Native prose states column units and composition; tags follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Indent performs no filesystem or process operation of its own.
// @evidenceExclude contracts/performance.md#efficient-algorithms Indent has no loop of its own and runs a fixed number of steps.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Indent keeps no cache and shares no in-flight computation.
// @evidence contracts/performance.md#bound-retention-and-release-resources The returned Doc shares caller child backing storage and reachable payloads without copying them. The caller owns tree lifetime and printing immutability; this constructor retains no historical indentation nodes and starts no handle or task.
func Indent(width int, parts ...Doc) Doc {
  return Doc{Kind: docIndent, Width: width, Children: parts}
}

// Align makes indented newlines in its children resume at the current output
// column at this node. It replaces the indentation target rather than adding
// that column to the parent's indentation. Literalline still emits no indent.
//
// @evidence contracts/common.md#principled-implementation The align variant records children for a renderer-computed absolute current-column indentation target.
// @evidence contracts/common.md#clear-and-simple-design One node separates dynamic alignment from fixed-width Indent.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Alignment uses the actual output column rather than hardcoded source-column exceptions.
// @evidence contracts/common.md#meaningful-documentation Native prose distinguishes current-column alignment from fixed indentation; tags follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Align performs no filesystem or process operation of its own.
// @evidenceExclude contracts/performance.md#efficient-algorithms Align has no loop of its own and runs a fixed number of steps.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Align keeps no cache and shares no in-flight computation.
// @evidence contracts/performance.md#bound-retention-and-release-resources The returned alignment Doc shares supplied child backing storage and reachable payloads for the caller-owned tree lifetime. That storage stays immutable while printing; the constructor keeps no historical aligned trees and acquires no handle or task.
func Align(parts ...Doc) Doc { return Doc{Kind: docAlign, Children: parts} }

// IfBreak emits `whenBroken` when the surrounding group breaks and
// `whenFlat` when it stays flat. The two arguments are stored as
// Children[0] and Children[1] respectively.
//
// @evidence contracts/common.md#principled-implementation The fixed two-child ordering preserves the broken and flat alternatives interpreted by the renderer.
// @evidence contracts/common.md#clear-and-simple-design One conditional node expresses mode-dependent content without separate rendering policy.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Alternatives are explicit layout operands instead of postprocessing source-specific punctuation.
// @evidence contracts/common.md#meaningful-documentation Native prose names both modes and operand order; tags follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation IfBreak performs no filesystem or process operation of its own.
// @evidenceExclude contracts/performance.md#efficient-algorithms IfBreak has no loop of its own and runs a fixed number of steps.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work IfBreak keeps no cache and shares no in-flight computation.
// @evidence contracts/performance.md#bound-retention-and-release-resources The returned Doc owns one two-record child slice while the copied branch Docs still share their nested slices and string storage. The caller owns tree lifetime and printing immutability; releasing the tree permits reclamation of its owned slice. No historical alternatives, handle or task are retained here.
func IfBreak(whenBroken, whenFlat Doc) Doc {
  return Doc{Kind: docIfBreak, Children: []Doc{whenBroken, whenFlat}}
}

// Concat sequences child docs. Empty Concat is the layout no-op.
//
// @evidence contracts/common.md#principled-implementation A singleton returns its operand unchanged; other inputs form an ordered concatenation, including an empty no-op.
// @evidence contracts/common.md#clear-and-simple-design The constructor removes an unnecessary singleton layer while keeping sequence ownership explicit.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The singleton identity is an algebraic simplification rather than a fixture-specific optimization.
// @evidence contracts/common.md#meaningful-documentation Native prose states sequencing and empty behavior; tags follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Concat performs no filesystem or process operation of its own.
// @evidenceExclude contracts/performance.md#efficient-algorithms Concat has no loop of its own and runs a fixed number of steps.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Concat keeps no cache and shares no in-flight computation.
// @evidence contracts/performance.md#bound-retention-and-release-resources Multiple operands keep their supplied backing slice reachable through the returned Doc; singleton returns the same child value with its shared nested payloads, and empty input retains any supplied empty-slice backing storage. The caller owns tree lifetime and printing immutability. This constructor stores no historical concatenations, handle or task.
func Concat(parts ...Doc) Doc {
  if len(parts) == 1 {
    return parts[0]
  }
  return Doc{Kind: docConcat, Children: parts}
}

// LineSuffix queues output before the next emitted line break, or drains it
// at the end when no break occurs. Used for trailing
// line comments that must appear after the current source line ends.
//
// The payload is expected to be single-line: it is emitted verbatim at the
// line break and is NOT re-indented across any embedded newlines.
//
// @evidence contracts/common.md#principled-implementation A suffix node retains ordered operands until the next emitted line break or the final drain under the documented single-line payload premise.
// @evidence contracts/common.md#clear-and-simple-design One algebra operation separates trailing-comment placement from ordinary sequential content.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Deferred placement uses renderer semantics instead of rewriting comments after output.
// @evidence contracts/common.md#meaningful-documentation Native prose explains deferred emission and the single-line premise; paragraphs and tags follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation LineSuffix performs no filesystem or process operation of its own.
// @evidenceExclude contracts/performance.md#efficient-algorithms LineSuffix has no loop of its own and runs a fixed number of steps.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work LineSuffix keeps no cache and shares no in-flight computation.
// @evidence contracts/performance.md#bound-retention-and-release-resources The returned suffix shares supplied child backing storage and reachable payloads. The caller owns immutable-during-print tree lifetime; the renderer separately owns its pending suffix queue and drains it at a break or completion. This constructor stores no historical suffixes, handle or task.
func LineSuffix(parts ...Doc) Doc {
  return Doc{Kind: docLineSuffix, Children: parts}
}

// Join interleaves `sep` between the entries of `parts` and returns the
// ordered concatenation; nested operands are not flattened by this helper.
// Empty input returns a no-op doc. Single-entry input
// returns the entry verbatim.
//
// @evidence contracts/common.md#principled-implementation The empty and singleton identities preserve no-op or exact input, while the general loop inserts one separator between each adjacent pair.
// @evidence contracts/common.md#clear-and-simple-design One join helper owns separator insertion and delegates sequencing to Concat.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Empty and singleton branches follow sequence algebra rather than known-answer input cases.
// @evidence contracts/common.md#meaningful-documentation Native prose documents all cardinality cases; tags follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Join builds an in-memory document and touches no filesystem path or process.
// @evidence contracts/performance.md#efficient-algorithms One pass that builds the separator-interleaved slice with exact capacity, O(parts).
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Join keeps no cache and shares no computation.
// @evidence contracts/performance.md#bound-retention-and-release-resources For n>1 the result owns exactly 2n-1 Doc records, while their nested slices and strings remain shared with operands/separator. Singleton returns the operand unchanged; empty input retains no child storage. The caller owns tree lifetime/printing immutability; no historical join cache, handle or task is created.
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

// IsNil reports whether Kind is the no-op discriminant, regardless of any
// inactive payload fields. A zero-value Doc is one such value; the renderer
// ignores every docNil variant.
//
// @evidence contracts/common.md#principled-implementation The zero discriminant alone identifies the layout no-op regardless of inactive payload fields.
// @evidence contracts/common.md#clear-and-simple-design One predicate centralizes no-op recognition for doc consumers.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The result derives from the documented algebra discriminant rather than arbitrary empty-text heuristics.
// @evidence contracts/common.md#meaningful-documentation Native prose identifies zero-value behavior and renderer treatment; tags follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Doc.IsNil performs no filesystem or process operation of its own.
// @evidenceExclude contracts/performance.md#efficient-algorithms Doc.IsNil has no loop of its own and runs a fixed number of steps.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Doc.IsNil keeps no cache and shares no in-flight computation.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Doc.IsNil acquires no handle or task and retains nothing beyond the receiver's own fields.
func (d Doc) IsNil() bool { return d.Kind == docNil }

package rule

import "encoding/json"

// HintScope names the syntactic region a hint is offered in. It exists because
// a line prefix alone cannot tell `@evidence` in a doc comment from
// `@Injectable` above a class: both lines end in `@`, and a corpus that ignored
// the difference would offer doc-comment tags in every decorator position.
//
// One value ships today. The field is present anyway: a hint with no scope
// would mean "anywhere on any line", which is never what a rule meant, and
// widening that default later would break every corpus already published.
type HintScope string

const (
  // HintScopeJSDoc offers the hint inside a `/** */` documentation comment.
  HintScopeJSDoc HintScope = "jsdoc"
)

// HintTrigger is the declarative answer to "does this hint apply at the
// cursor?".
//
// It must be declarative because the rule that produced it is gone. The lint
// engine is a separate process that reloads the Program on every invocation, so
// nothing can ask a rule a question per keystroke. A Go predicate is the obvious
// API and is exactly the one that cannot ship: it does not survive the process
// boundary. Every editor-assistance system that lets a rule answer live does so
// in-process on a shared AST; this host cannot, so the corpus travels instead of
// the question.
//
// The host matches a trigger against the current line up to the cursor: the hint
// applies when the cursor sits inside Scope and the line prefix contains After.
// Text following the LAST occurrence of After is the filter the editor matches
// against, and the range the completion replaces. Two consequences to design
// around:
//
// After must end exactly where the completed token begins — `"@evidence "` with
// its trailing space, not `"@evidence"` — or the token swallows the separator
// and nothing filters.
//
// When several triggers match one line the longest After wins and only its hints
// are offered; equal lengths merge. That is what makes a corpus layerable: `"@"`,
// `"@evidence "`, and `"@evidence docs/spec.md#"` can all be published at once
// without the broad one drowning the narrow ones.
type HintTrigger struct {
  Scope HintScope `json:"scope"`
  After string    `json:"after"`
}

// Hint is one completion an editor may offer.
//
// It is a value, not a behavior: the host serializes the corpus and hands it to
// the LSP proxy, which answers from cache long after the lint process exited. A
// closure, a channel, or an AST node cannot be carried here, and that constraint
// is the whole shape of the type.
type Hint struct {
  // Insert is the text replacing the token being completed. Plain text,
  // inserted verbatim: there is no snippet expansion, so `$` and tabs are
  // literal.
  Insert string `json:"insert"`

  // Label is what the editor lists and filters on. Empty means Insert, which
  // is the common case. Set it only when the two genuinely differ, and
  // remember the filter is what the user typed AFTER the trigger: a Label
  // repeating the trigger text will not prefix-match anything.
  Label string `json:"label,omitempty"`

  // Detail is a short annotation rendered beside Label. Use it for the fact
  // distinguishing two similar entries — a heading's text, a count. It is not
  // documentation: editors truncate it, so a sentence is wasted.
  Detail string `json:"detail,omitempty"`

  // Trigger is where this hint applies. A zero Trigger is dropped by the host
  // rather than offered everywhere: a hint with no scope is one nobody asked
  // for, surfacing in every decorator and every string literal.
  Trigger HintTrigger `json:"trigger"`
}

// HintContext is the read-only handle the host passes to Hints.
//
// It carries State because a rule value is stateless: contributors register
// `myRule{}`, not a pointer with fields, and the host owns everything Check
// produced. Without State here, Hints could only ever return constants.
type HintContext struct {
  // Identity names the Program this corpus is built for, as during Check.
  Identity ProjectIdentity

  // State is the value the rule passed to ProjectContext.SetState.
  // Type-assert it back, exactly as a file rule does with
  // ProjectRuleResult.State. The host calls Hints only for a rule that passed
  // and published, so a failed assertion means the rule published something
  // other than it believes.
  State any

  // Severity and Options are the resolved configuration Check ran under,
  // repeated so a rule shaping its corpus by option need not stash a decoded
  // struct inside State.
  Severity Severity
  Options  json.RawMessage
}

// DecodeOptions unmarshals the configured options into out. A missing options
// tuple leaves out unchanged and returns nil.
func (c *HintContext) DecodeOptions(out interface{}) error {
  if c == nil || len(c.Options) == 0 {
    return nil
  }
  return json.Unmarshal(c.Options, out)
}

// HintRule is an optional marker a ProjectRule implements to publish editor
// completions for the Program it just indexed.
//
// The host calls Hints at most once per Program, always after Check, and only
// when a consumer asks for the corpus — never during `ttsc check`. It is not
// called unless Check passed and published state, the same gate a file rule
// writes by hand against ProjectRulePassed. A rule configured off is never
// asked, so `off` means no hints with no code in the rule, and a rule's options
// shape its corpus for free because the corpus is a projection of the state
// Check built under them.
//
// Pull, not push. Report is push because a finding is discovered mid-walk and
// belongs to the node under it. A corpus is the opposite: a projection of
// FINISHED state. A rule pushing hints while building that state would publish
// the anchors it had found so far rather than the ones the document has.
//
// The corpus outlives the process, so slice order is the only ranking channel
// there is — the host preserves it and derives the editor's sort key from it.
// Return what should be offered first, first. Nothing else about a Hint
// influences ordering, by design: a sort key field would be a second, silently
// conflicting answer to a question the slice already answers.
//
// This embeds ProjectRule rather than standing alone as OptionsRule does,
// because a per-file corpus is not a coherent thing. File rules run in a
// parallel walk, so their hints would arrive — and therefore rank —
// nondeterministically, and a corpus keyed to one file cannot answer a keystroke
// in another. A contributor wanting hints from file-level facts registers a
// ProjectRule alongside, which is what those facts wanted anyway.
type HintRule interface {
  ProjectRule
  Hints(ctx *HintContext) []Hint
}

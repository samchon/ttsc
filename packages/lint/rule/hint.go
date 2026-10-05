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
//
// @evidence contracts/common.md#principled-implementation A string scope identifies the syntactic region independently from the trigger text; the host recognizes the published JSDoc value.
// @evidence contracts/common.md#clear-and-simple-design Scope is one named discriminant shared by triggers rather than an executable predicate crossing processes.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The JSDoc discriminant is protocol vocabulary, not a hardcoded consumer identity.
// @evidence contracts/common.md#meaningful-documentation Native prose explains the decorator ambiguity and widening constraint; separated paragraphs and tags follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation HintScope is a declaration of data shape and performs no filesystem, path or process operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms HintScope is a declaration of data shape and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work HintScope is a declaration of data shape and coordinates no computation that could be shared.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources HintScope is a declaration of data shape; the code that holds its values owns their lifetime.
type HintScope string

const (
  // HintScopeJSDoc offers the hint inside a `/** */` documentation comment.
  HintScopeJSDoc HintScope = "jsdoc"
)

// HintTrigger is the declarative answer to "does this hint apply at the
// cursor?".
//
// The corpus crosses the sidecar protocol as JSON. A Go predicate cannot be
// serialized into the language-server proxy, which matches cached trigger
// values locally for each cursor request. A resident sidecar may keep the rule
// and Program alive; local matching does not depend on their process lifetime.
//
// The host matches a trigger against the current line up to the cursor: the hint
// applies when the cursor sits inside Scope and the line prefix contains After.
// Text following the LAST occurrence of After is the filter the editor matches
// against, and the range the completion replaces. Two consequences to design
// around:
//
// After must end exactly where the completed token begins: `"@evidence "` with
// its trailing space, not `"@evidence"`, or the token swallows the separator
// and nothing filters.
//
// When several triggers match one line, the occurrence nearest the cursor wins.
// At that occurrence, the longest After wins, and only hints with that same
// trigger merge. That keeps a corpus layerable while preventing an earlier,
// longer trigger from drowning a later one.
//
// @evidence contracts/common.md#principled-implementation Scope and literal prefix are serializable inputs to the host's cursor matching and replacement semantics.
// @evidence contracts/common.md#clear-and-simple-design The trigger carries only region and delimiter, leaving ranking and insertion to their owning values.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Declarative matching uses a supported protocol instead of installing a foreign editor callback.
// @evidence contracts/common.md#meaningful-documentation Native prose describes last-occurrence selection, delimiter placement and tie-breaking; paragraph and tag spacing follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation HintTrigger is a declaration of data shape and performs no filesystem, path or process operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms HintTrigger is a declaration of data shape and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work HintTrigger is a declaration of data shape and coordinates no computation that could be shared.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources HintTrigger is a declaration of data shape; the code that holds its values owns their lifetime.
type HintTrigger struct {
  // Scope restricts matching to a host-recognized syntactic region.
  Scope HintScope `json:"scope"`

  // After is the literal prefix whose following text is replaced.
  After string `json:"after"`
}

// Hint is one completion an editor may offer.
//
// It is a value, not a behavior: the host serializes the corpus and hands it to
// the LSP proxy, which answers cursor requests from its cached values. A
// closure, a channel, or an AST node cannot be carried here, and that constraint
// is the whole shape of the type.
//
// @evidence contracts/common.md#principled-implementation Plain strings and a declarative trigger survive serialization and let the editor apply insertion without retained AST pointers.
// @evidence contracts/common.md#clear-and-simple-design Insertion, display and applicability are distinct members of a single completion value.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The supported value protocol carries no closure or patched editor implementation.
// @evidence contracts/common.md#meaningful-documentation Members explain literal insertion, label fallback, detail truncation and zero-trigger rejection; member, paragraph and tag separation follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation Hint is a declaration of data shape and performs no filesystem, path or process operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms Hint is a declaration of data shape and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Hint is a declaration of data shape and coordinates no computation that could be shared.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Hint is a declaration of data shape; the code that holds its values owns their lifetime.
type Hint struct {
  // Insert is the text replacing the token being completed. Plain text,
  // inserted verbatim: there is no snippet expansion, so `$` and tabs are
  // literal.
  Insert string `json:"insert"`

  // Label is the editor display text. Empty means Insert, which is the common
  // case. Matching and client-side filtering use Insert even when Label differs,
  // so a friendly display label need not repeat a typed path prefix.
  Label string `json:"label,omitempty"`

  // Detail is a short annotation rendered beside Label. Use it for the fact
  // distinguishing two similar entries, such as heading text or a count. It is not
  // documentation: editors truncate it, so a sentence is wasted.
  Detail string `json:"detail,omitempty"`

  // Trigger is where this hint applies. A zero Trigger is dropped by the host
  // rather than offered everywhere: a hint with no scope is one nobody asked
  // for, surfacing in every decorator and every string literal.
  Trigger HintTrigger `json:"trigger"`
}

// HintContext contains the resolved projection inputs the host passes to Hints.
// Contributors treat these inputs as read-only.
//
// State carries the value Check published for this Program. Hints can project
// that value without storing Program data in the registered rule object;
// registration itself accepts both value and pointer rule implementations.
//
// @evidence contracts/common.md#principled-implementation Program identity, published state and resolved settings give the projection the same binding that Check established.
// @evidence contracts/common.md#clear-and-simple-design The context groups the read-only projection inputs without adding another state owner.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The completed result supplies identity, published state and settings through the supported context; publication synthesizes no replacement Program and patches no host state.
// @evidence contracts/common.md#meaningful-documentation Native comments explain state assertion and resolved configuration; paragraphs, member spacing and tags follow documentation guidance.
// @evidence contracts/portability.md#os-neutral-implementation Identity retains the checked Program's host-resolved native logical/physical paths, cwd and optional origins. This input container preserves those channels; ProjectIdentity and the host own native resolution and spelling, and projection does not infer path case policy or recast paths as protocol URLs.
// @evidenceExclude contracts/performance.md#efficient-algorithms HintContext is a declaration of data shape and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work HintContext is a declaration of data shape and coordinates no computation that could be shared.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources HintContext is a declaration of data shape; the code that holds its values owns their lifetime.
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
//
// @evidence contracts/common.md#principled-implementation Nil or empty context leaves the caller's defaults intact; otherwise encoding/json decodes the raw options and returns its error.
// @evidence contracts/common.md#clear-and-simple-design A guard and one standard decoder keep option decoding local to the context.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Options are decoded by the public JSON API without rule-specific bypasses.
// @evidence contracts/common.md#meaningful-documentation The native method comment states the absent-options effect; prose and tags are separated according to documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation HintContext.DecodeOptions performs no filesystem or process operation of its own.
// @evidence contracts/performance.md#efficient-algorithms The absence check is constant work; present options delegate validation and decoding to encoding/json, with work driven by JSON bytes and destination shape and storage allocated as required by decoded values. A destination custom unmarshaler can add its own work; absence of a wrapper loop does not make decoding fixed-cost.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Decoding updates the supplied destination, preserves its omitted defaults and can invoke destination-defined unmarshaling effects. Equal JSON alone does not make different destinations or calls interchangeable; this helper owns no cross-request result cache.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Decoded values and their allocations belong to the caller-supplied destination; custom unmarshaler retention is owned by that implementation. This helper neither stores destination history nor acquires native handles or tasks, and its receiver owner controls the existing raw option bytes.
func (c *HintContext) DecodeOptions(out interface{}) error {
  if c == nil || len(c.Options) == 0 {
    return nil
  }
  return json.Unmarshal(c.Options, out)
}

// HintRule is an optional marker a ProjectRule implements to publish editor
// completions for the Program it just indexed.
//
// The host calls Hints after Check for a requested projection of one project
// evaluation cycle, never during `ttsc check`. Resident requests can start a
// new cycle while reusing the loaded Program, so a corpus is not cached for
// the entire Program lifetime. Hints is called only if Check passed and
// published state, the same gate a file rule writes by hand against
// ProjectRulePassed. A rule configured off is never
// asked, so `off` means no hints with no code in the rule, and a rule's options
// shape its corpus for free because the corpus is a projection of the state
// Check built under them.
//
// Pull, not push. Report is push because a finding is discovered mid-walk and
// belongs to the node under it. A corpus is the opposite: a projection of
// FINISHED state. A rule pushing hints while building that state would publish
// the anchors it had found so far rather than the ones the document has.
//
// The serialized corpus is independent of the sidecar lifetime. Slice order
// is its ranking channel: the host preserves it and derives the editor's sort
// key from it. Return what should be offered first, first. Nothing else about a Hint
// influences ordering, by design: a sort key field would be a second, silently
// conflicting answer to a question the slice already answers.
//
// This embeds ProjectRule rather than standing alone as OptionsRule does,
// because a per-file corpus is not a coherent thing. File rules run in a
// parallel walk, so their hints would arrive and rank
// nondeterministically, and a corpus keyed to one file cannot answer a keystroke
// in another. A contributor wanting hints from file-level facts registers a
// ProjectRule alongside, which is what those facts wanted anyway.
//
// @evidence contracts/common.md#principled-implementation Embedding ProjectRule ties a hint corpus to completed Program state rather than nondeterministic per-file dispatch.
// @evidence contracts/common.md#clear-and-simple-design One optional projection method extends the existing project-rule lifecycle.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The extension is a supported marker interface rather than a replacement of host dispatch.
// @evidence contracts/common.md#meaningful-documentation Native prose explains demand-driven invocation, passed-state gating and slice ranking; distinct paragraphs and tags follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation HintRule is a declaration of data shape and performs no filesystem, path or process operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms HintRule is a declaration of data shape and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work HintRule is a declaration of data shape and coordinates no computation that could be shared.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources HintRule is a declaration of data shape; the code that holds its values owns their lifetime.
type HintRule interface {
  ProjectRule

  // Hints returns completions in preferred display order for the passed Program.
  //
  // @evidence contracts/common.md#principled-implementation The ordered slice is a projection of the supplied checked state and defines the corpus ranking.
  // @evidence contracts/common.md#clear-and-simple-design A single method returns the complete corpus instead of exposing partially built entries.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts Completion publication uses the declared interface and does not alter editor internals.
  // @evidence contracts/common.md#meaningful-documentation The method comment states ordering and Program scope with a separated tag block under documentation guidance.
  // @evidenceExclude contracts/portability.md#os-neutral-implementation HintRule.Hints is a method signature without a body; each implementation owns any filesystem or process behavior.
  // @evidenceExclude contracts/performance.md#efficient-algorithms HintRule.Hints is a method signature without a body; each implementation chooses its own algorithm.
  // @evidenceExclude contracts/performance.md#reuse-equivalent-work HintRule.Hints is a method signature without a body; each implementation decides what, if anything, to share.
  // @evidenceExclude contracts/performance.md#bound-retention-and-release-resources HintRule.Hints is a method signature without a body; each implementation owns any retained state.
  Hints(ctx *HintContext) []Hint
}

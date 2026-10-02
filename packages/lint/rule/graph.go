package rule

import "encoding/json"

// GraphNodeKind names what a published graph node is.
//
// The vocabulary is fixed by the host rather than chosen by the contributor,
// because a consumer has to know what it received: a kind it does not recognize
// is a node it cannot rank, colour, or contain. A contributor publishing an
// unrecognized kind has its node dropped, and the drop is a declared outcome
// rather than a silent one.
//
// It is deliberately not evidence-specific. These are the shapes an artifact an
// author can cite actually has — a document and its sections, a data model and
// its fields, an API operation — and any contributor that can materialize one
// publishes it here.
//
// @evidence contracts/common.md#principled-implementation A named string discriminant expresses the finite artifact vocabulary that host consumers recognize.
// @evidence contracts/common.md#clear-and-simple-design One shared kind type separates artifact classification from addresses and presentation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Artifact kinds are supported protocol constants rather than contributor-specific dispatch patches.
// @evidence contracts/common.md#meaningful-documentation Native prose explains vocabulary ownership and unknown-kind rejection; separated paragraphs and tags follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation GraphNodeKind is a declaration of data shape and performs no filesystem, path or process operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms GraphNodeKind is a declaration of data shape and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work GraphNodeKind is a declaration of data shape and coordinates no computation that could be shared.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources GraphNodeKind is a declaration of data shape; the code that holds its values owns their lifetime.
type GraphNodeKind string

const (
  // GraphNodeMarkdownDocument is a whole Markdown document.
  GraphNodeMarkdownDocument GraphNodeKind = "markdown_document"
  // GraphNodeMarkdownSection is one heading and the span it opens. It carries
  // the heading's text, never the section's content.
  GraphNodeMarkdownSection GraphNodeKind = "markdown_section"
  // GraphNodePrismaModel is a Prisma model declaration.
  GraphNodePrismaModel GraphNodeKind = "prisma_model"
  // GraphNodePrismaColumn is a scalar field of a Prisma model.
  GraphNodePrismaColumn GraphNodeKind = "prisma_column"
  // GraphNodePrismaRelation is a relation field of a Prisma model. It is its
  // own kind because a relation has two sides and only one usually carries the
  // declaration, which a column never does.
  GraphNodePrismaRelation GraphNodeKind = "prisma_relation"
  // GraphNodeSwaggerOperation is one method-and-path operation of an API
  // document.
  GraphNodeSwaggerOperation GraphNodeKind = "swagger_operation"
)

// GraphNodeKinds returns every kind a consumer accepts, in declaration order.
//
// A consumer seeds its vocabulary from this rather than from a list of its own:
// a kind added to the block above and not to a consumer's map is a node drawn
// or ranked as something it is not.
//
// @evidence contracts/common.md#principled-implementation The returned literal slice enumerates the declared protocol kinds in their documented order.
// @evidence contracts/common.md#clear-and-simple-design One function supplies the vocabulary so consumers need not maintain independent lists.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Enumeration contains protocol discriminants without consumer-specific branches or foreign mutation.
// @evidence contracts/common.md#meaningful-documentation The native comment explains ordering and the consumer consistency reason; prose and tags are separated under documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation GraphNodeKinds performs no filesystem or process operation of its own.
// @evidence contracts/performance.md#efficient-algorithms Constructing the fixed six-kind literal takes constant work and six returned slice slots; no input-dependent scan or artifact traversal occurs.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Each call returns independently mutable slice slots containing the immutable protocol strings. Sharing a cached backing slice would let one caller corrupt another caller vocabulary; consumers own any reused lookup set derived from this fixed list.
// @evidence contracts/performance.md#bound-retention-and-release-resources The caller owns one six-slot output allocation and its retention; protocol strings are static values. The function retains no historical outputs and acquires no native handle or task.
func GraphNodeKinds() []GraphNodeKind {
  return []GraphNodeKind{
    GraphNodeMarkdownDocument,
    GraphNodeMarkdownSection,
    GraphNodePrismaModel,
    GraphNodePrismaColumn,
    GraphNodePrismaRelation,
    GraphNodeSwaggerOperation,
  }
}

// GraphNode is one artifact a declaration's documentation can cite.
//
// It is a value, not a behavior, for the same reason Hint is: the host
// serializes the set and hands values to a consumer independently of whether
// the sidecar exits or remains resident. The values contain no callable code.
//
// The node is an index entry, never content. A section carries its heading and
// where it starts; the text under that heading is read from the file when
// someone actually needs it, exactly as a function body is.
//
// @evidence contracts/common.md#principled-implementation Address, kind, containment and optional source position form a serializable artifact index while aliases refer to the same identity.
// @evidence contracts/common.md#clear-and-simple-design The record exposes identity and navigation facts without mixing in diagnostic policy or document content.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Addresses are produced by the owning rule's grammar rather than fabricated by consumers or patched host internals.
// @evidence contracts/common.md#meaningful-documentation Members explain parent handling, address ownership, aliases and 1-based positions; paragraphs, member gaps and tags follow documentation guidance.
// @evidence contracts/portability.md#os-neutral-implementation File carries the producer-spelled native source path and Line its one-based position, while Address, Parent and Aliases belong to the producer's citation grammar. This record preserves those separate channels without deriving paths from addresses, folding filesystem case or manufacturing a source file for a fileless artifact.
// @evidenceExclude contracts/performance.md#efficient-algorithms GraphNode is a declaration of data shape and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work GraphNode is a declaration of data shape and coordinates no computation that could be shared.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources GraphNode is a declaration of data shape; the code that holds its values owns their lifetime.
type GraphNode struct {
  // Address is the identity a citation names, verbatim: `docs/sale.md#pricing`,
  // `prisma:Sale.price`, `POST:/orders/{orderId}`.
  //
  // The rule that produced it owns the grammar. A consumer keys on the string
  // and parses none of it: the address forms come from a Markdown anchor
  // generator, a Prisma parser, and an OpenAPI normalizer, and re-deriving any
  // of them outside the rule that owns it would be a second implementation of a
  // published contract.
  Address string `json:"address"`

  // Kind is what this node is. A node whose kind is not in GraphNodeKinds is
  // dropped by the consumer.
  Kind GraphNodeKind `json:"kind"`

  // Readable is the human-facing name, such as heading text or a model name.
  // Empty when the artifact has none beyond its address.
  Readable string `json:"readable,omitempty"`

  // Parent is the Address of the node containing this one: a section's document
  // or enclosing section, a column's model. Empty at the top of a containment
  // chain. A parent naming no published node is dropped rather than fabricated.
  Parent string `json:"parent,omitempty"`

  // File is where the artifact lives, as the rule spells it. Empty when the
  // artifact has no file. An API operation is named by method and path, and
  // which document declared it is not part of its identity.
  File string `json:"file,omitempty"`

  // Line is the 1-based line the node starts on, or 0 when it has no position.
  Line int `json:"line,omitempty"`

  // Aliases are the additional addresses this same node answers to, when the
  // rule exposes it by more than one path. They resolve to this node rather
  // than to copies of it, so an artifact reachable twice is one node.
  Aliases []string `json:"aliases,omitempty"`
}

// GraphContext contains resolved inputs the host passes to GraphNodes.
// Contributors treat them as read-only.
//
// State carries Check's published value for the current evaluation cycle,
// allowing projection without storing Program data in the registered rule.
// Registration accepts both value and pointer implementations, as with Hints.
//
// @evidence contracts/common.md#principled-implementation Identity, exact published state and resolved settings bind graph projection to the Program Check evaluated.
// @evidence contracts/common.md#clear-and-simple-design One projection context carries inputs without introducing a second mutable state owner.
// @evidence contracts/common.md#prohibited-implementation-shortcuts The supported context transports state instead of reaching into foreign host internals.
// @evidence contracts/common.md#meaningful-documentation Native member comments identify Program binding, state and settings; the tag block and member boundaries follow documentation guidance.
// @evidence contracts/portability.md#os-neutral-implementation Identity preserves the host-resolved Program's separate logical/physical native paths, cwd and optional origins. ProjectIdentity and the host own resolution and spelling policy; this container neither infers filesystem case nor converts those channels to citation addresses or protocol URLs.
// @evidenceExclude contracts/performance.md#efficient-algorithms GraphContext is a declaration of data shape and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work GraphContext is a declaration of data shape and coordinates no computation that could be shared.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources GraphContext is a declaration of data shape; the code that holds its values owns their lifetime.
type GraphContext struct {
  // Identity names the Program these nodes were built for, as during Check.
  Identity ProjectIdentity

  // State is the value the rule passed to ProjectContext.SetState.
  State any

  // Severity and Options are the resolved configuration Check ran under.
  Severity Severity
  Options  json.RawMessage
}

// DecodeOptions unmarshals the configured options into out. A missing options
// tuple leaves out unchanged and returns nil.
//
// @evidence contracts/common.md#principled-implementation The nil-or-empty guard preserves caller defaults, while encoding/json handles present options and reports decoding errors.
// @evidence contracts/common.md#clear-and-simple-design The context delegates JSON semantics to one standard decoder after its absence guard.
// @evidence contracts/common.md#prohibited-implementation-shortcuts No artifact-specific option bypass or foreign mutation is used.
// @evidence contracts/common.md#meaningful-documentation The native method comment states empty-options behavior with a separated tag block under documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation GraphContext.DecodeOptions performs no filesystem or process operation of its own.
// @evidence contracts/performance.md#efficient-algorithms The absence check is constant work; present options delegate validation and decoding to encoding/json, with work driven by JSON bytes and destination shape and storage allocated as required by decoded values. A destination custom unmarshaler can add its own work; absence of a wrapper loop does not make decoding fixed-cost.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work Decoding updates the supplied destination, preserves its omitted defaults and can invoke destination-defined unmarshaling effects. Equal JSON alone does not make different destinations or calls interchangeable; this helper owns no cross-request result cache.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources Decoded values and their allocations belong to the caller-supplied destination; custom unmarshaler retention is owned by that implementation. This helper neither stores destination history nor acquires native handles or tasks, and its receiver owner controls the existing raw option bytes.
func (c *GraphContext) DecodeOptions(out interface{}) error {
  if c == nil || len(c.Options) == 0 {
    return nil
  }
  return json.Unmarshal(c.Options, out)
}

// GraphRule is an optional marker a ProjectRule implements to publish the
// artifacts a declaration's documentation can cite.
//
// The gate is HintRule's, for the same reasons: called at most once per Program,
// always after Check, only when a consumer asks — never during `ttsc check` —
// and never unless Check passed and published state. A rule configured off is
// never asked, so `off` means no nodes with no code in the rule.
//
// Pull, not push. A set of artifacts is a projection of FINISHED state; a rule
// pushing nodes while building that state would publish the ones it had found
// so far rather than the ones the project has.
//
// What crosses this boundary is what an artifact *is*, never what the rule
// decided about it. No coverage, no cardinality, no policy, no diagnostic:
// those are the linter's product and it already delivers them as compile
// errors. A consumer that received them would hold a second, unmaintained
// answer to a question the linter already answers.
//
// @evidence contracts/common.md#principled-implementation ProjectRule embedding permits a complete graph projection only from the checked Program state, keeping diagnostic results in their separate channel.
// @evidence contracts/common.md#clear-and-simple-design One optional method extends project checking with artifact publication rather than duplicating coverage evaluation.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Graph publication is a supported marker interface with no host replacement or synthesized coverage result.
// @evidence contracts/common.md#meaningful-documentation Native prose specifies publication gating and the artifact-versus-diagnostic boundary; paragraphs and tag spacing follow documentation guidance.
// @evidenceExclude contracts/portability.md#os-neutral-implementation GraphRule is a declaration of data shape and performs no filesystem, path or process operation.
// @evidenceExclude contracts/performance.md#efficient-algorithms GraphRule is a declaration of data shape and chooses no algorithm or processing strategy.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work GraphRule is a declaration of data shape and coordinates no computation that could be shared.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources GraphRule is a declaration of data shape; the code that holds its values owns their lifetime.
type GraphRule interface {
  ProjectRule

  // GraphNodes returns the artifacts this rule materialized, in any order.
  // Containment is expressed by Parent rather than by position.
  //
  // @evidence contracts/common.md#principled-implementation The returned artifacts carry explicit parent addresses, so containment does not depend on result ordering.
  // @evidence contracts/common.md#clear-and-simple-design One complete slice represents the checked state projection without incremental publication callbacks.
  // @evidence contracts/common.md#prohibited-implementation-shortcuts Artifacts use the supported projection method rather than fabricated diagnostic acknowledgments.
  // @evidence contracts/common.md#meaningful-documentation The native comment states arbitrary order and explicit containment with a separated tag block under documentation guidance.
  // @evidenceExclude contracts/portability.md#os-neutral-implementation GraphRule.GraphNodes is a method signature without a body; each implementation owns any filesystem or process behavior.
  // @evidenceExclude contracts/performance.md#efficient-algorithms GraphRule.GraphNodes is a method signature without a body; each implementation chooses its own algorithm.
  // @evidenceExclude contracts/performance.md#reuse-equivalent-work GraphRule.GraphNodes is a method signature without a body; each implementation decides what, if anything, to share.
  // @evidenceExclude contracts/performance.md#bound-retention-and-release-resources GraphRule.GraphNodes is a method signature without a body; each implementation owns any retained state.
  GraphNodes(ctx *GraphContext) []GraphNode
}

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
// serializes the set and hands it to a consumer that reads it long after the
// lint process exited. What travels is what the consumer can answer from.
//
// The node is an index entry, never content. A section carries its heading and
// where it starts; the text under that heading is read from the file when
// someone actually needs it, exactly as a function body is.
type GraphNode struct {
  // Address is the identity a citation names, verbatim — `docs/sale.md#pricing`,
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

  // Readable is the human-facing name — a heading's own text, a model's name.
  // Empty when the artifact has none beyond its address.
  Readable string `json:"readable,omitempty"`

  // Parent is the Address of the node containing this one: a section's document
  // or enclosing section, a column's model. Empty at the top of a containment
  // chain. A parent naming no published node is dropped rather than fabricated.
  Parent string `json:"parent,omitempty"`

  // File is where the artifact lives, as the rule spells it. Empty when the
  // artifact has no file — an API operation is named by method and path, and
  // which document declared it is not part of its identity.
  File string `json:"file,omitempty"`

  // Line is the 1-based line the node starts on, or 0 when it has no position.
  Line int `json:"line,omitempty"`

  // Aliases are the additional addresses this same node answers to, when the
  // rule exposes it by more than one path. They resolve to this node rather
  // than to copies of it, so an artifact reachable twice is one node.
  Aliases []string `json:"aliases,omitempty"`
}

// GraphContext is the read-only handle the host passes to GraphNodes.
//
// It mirrors HintContext exactly, and for the same reason: a rule value is
// stateless, so without State here a projection could only ever return
// constants.
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
type GraphRule interface {
  ProjectRule

  // GraphNodes returns the artifacts this rule materialized, in any order.
  // Containment is expressed by Parent rather than by position.
  GraphNodes(ctx *GraphContext) []GraphNode
}

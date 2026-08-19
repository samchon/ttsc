package graph

import (
  "encoding/json"
  "os"
  "sort"
  "strings"
)

// Artifact is one thing a declaration's documentation can cite that is not a
// TypeScript declaration — a document section, a data model field, an API
// operation.
//
// It is the wire shape `@ttsc/lint`'s `graph-nodes` verb prints, restated here
// rather than imported: `packages/lint` is its own Go module and deliberately
// carries no requirement on this one, with its reason written in that manifest.
// What binds the two is the JSON contract, so the keys below are the contract
// and the Go field names are not — the same rule DumpNode already states.
//
// Nothing here is a judgement. The rule that materialized these decides what is
// covered, what is a legitimate exclusion, and what is missing, and it delivers
// those as compile errors. The graph reports; the linter judges.
type Artifact struct {
  Address  string   `json:"address"`
  Kind     string   `json:"kind"`
  Readable string   `json:"readable,omitempty"`
  Parent   string   `json:"parent,omitempty"`
  File     string   `json:"file,omitempty"`
  Line     int      `json:"line,omitempty"`
  Aliases  []string `json:"aliases,omitempty"`
}

// artifactNodeKinds maps a published artifact kind onto this graph's node kind.
//
// The vocabulary is closed on purpose. A kind the graph does not model is a node
// a consumer would rank, contain, and display as something it is not, so it is
// dropped rather than guessed at — and the capability claim is what tells a
// consumer the producer looked at all.
var artifactNodeKinds = map[string]NodeKind{
  "markdown_document": NodeMarkdownDocument,
  "markdown_section":  NodeMarkdownSection,
  "prisma_model":      NodePrismaModel,
  "prisma_column":     NodePrismaColumn,
  "prisma_relation":   NodePrismaRelation,
  "swagger_operation": NodeSwaggerOperation,
}

// IsArtifactKind reports whether a node kind names a published artifact rather
// than a TypeScript declaration.
//
// It is what keeps an artifact out of the places that assume a declaration: an
// id built from the `path#name:kind` grammar, and a tour seed. A document
// section is neither the shape of a declaration nor an answer to "what is this
// project and how does it run".
func IsArtifactKind(kind NodeKind) bool {
  for _, mapped := range artifactNodeKinds {
    if mapped == kind {
      return true
    }
  }
  return false
}

// LoadArtifacts reads the artifact set a plugin published, or nil when no path
// was given.
//
// A missing file is not an error: the caller names a path a plugin may or may
// not have produced, and a project that publishes nothing is the common case. A
// file that exists and does not parse is an error, because that is a producer
// the caller was told to expect.
func LoadArtifacts(path string) ([]Artifact, error) {
  if strings.TrimSpace(path) == "" {
    return nil, nil
  }
  data, err := os.ReadFile(path)
  if err != nil {
    if os.IsNotExist(err) {
      return nil, nil
    }
    return nil, err
  }
  return ParseArtifacts(data)
}

// ParseArtifacts decodes a published set from the bytes it was read as.
//
// Split from LoadArtifacts for a caller that has to hash the same bytes it
// parses. Reading the file twice — once to state what it holds and once to
// decode it — lets an overwrite land between the two, leaving a session whose
// recorded identity describes a set it is not holding.
func ParseArtifacts(data []byte) ([]Artifact, error) {
  var artifacts []Artifact
  if err := json.Unmarshal(data, &artifacts); err != nil {
    return nil, err
  }
  return artifacts, nil
}

// ApplyArtifacts adds the published artifacts to a built graph as nodes, records
// each one's parent, and resolves every documentation tag whose target names one
// into a doc-ref edge.
//
// The address is the node id verbatim. That is deliberate and has a real
// benefit: the token an author wrote in a tag is the handle an agent submits
// back. It also means these ids do not follow the `path#name:kind` grammar —
// `prisma:Sale.price` carries no path because a Prisma model name is unique
// across the schema folder, and `POST:/orders` has no file at all — which is why
// a consumer parsing an id has to gate on the kind first.
//
// An address that collides with an existing node loses: a checker-resolved
// declaration is a fact of this Program, and a published artifact is not.
func ApplyArtifacts(g *Graph, artifacts []Artifact) {
  if g == nil || len(artifacts) == 0 {
    return
  }
  // Sorted so the emitted node and edge order is a function of the addresses
  // rather than of the order a plugin happened to walk its documents.
  sorted := make([]Artifact, len(artifacts))
  copy(sorted, artifacts)
  sort.SliceStable(sorted, func(i, j int) bool { return sorted[i].Address < sorted[j].Address })

  // Every address an artifact answers to, including its aliases, so a citation
  // written against either spelling resolves to the one node.
  byAddress := map[string]string{}
  for _, artifact := range sorted {
    kind, known := artifactNodeKinds[artifact.Kind]
    if !known || artifact.Address == "" {
      continue
    }
    if _, exists := g.Nodes[artifact.Address]; exists {
      continue
    }
    node := &Node{
      ID:     artifact.Address,
      Name:   artifact.Address,
      Simple: artifact.Readable,
      Kind:   kind,
      File:   artifact.File,
    }
    if artifact.Line > 0 {
      node.ArtifactLine = artifact.Line
    }
    g.Nodes[artifact.Address] = node
    byAddress[artifact.Address] = artifact.Address
  }

  // Aliases are registered after every address, and only where nothing claims
  // the spelling. An alias is an additional name for one artifact, never a
  // rename of another: registering it in the same pass let one artifact's alias
  // overwrite an earlier artifact's own address, and a citation of that address
  // then resolved to the wrong node — a confident wrong answer, which is worse
  // than the token it replaced.
  for _, artifact := range sorted {
    if _, published := g.Nodes[artifact.Address]; !published {
      continue
    }
    for _, alias := range artifact.Aliases {
      if alias == "" || alias == artifact.Address {
        continue
      }
      if _, claimed := byAddress[alias]; claimed {
        continue
      }
      byAddress[alias] = artifact.Address
    }
  }

  // Containment rides the node rather than an edge, because `contains` is
  // synthesized by the TypeScript memory layer for declarations and a second
  // producer of the same relation would put two answers in the graph. A parent
  // naming nothing published is cleared: the child is still a real artifact and
  // sits at the top of its chain, and fabricating the parent is what must not
  // happen.
  for _, artifact := range sorted {
    node, exists := g.Nodes[artifact.Address]
    if !exists || artifact.Parent == "" {
      continue
    }
    if parent, resolved := byAddress[artifact.Parent]; resolved && parent != artifact.Address {
      node.ArtifactParent = parent
    }
  }

  // A tag's target is its leading token, the same rule the reverse index uses.
  // A tag naming nothing published resolves to nothing and stays what it always
  // was: text on the node, for the linter to judge.
  //
  // The edges are appended with a dedup of their own rather than through
  // addEdge. This runs after the build, and the build releases the scratch it no
  // longer reads — `seen` among it — so the shared helper would write to a map
  // that is deliberately nil. Two declarations citing one address are two edges;
  // one declaration citing it twice, under two tag names, is one.
  seen := map[edgeKey]struct{}{}
  for _, edge := range g.Edges {
    seen[edgeKey{from: edge.From, to: edge.To, kind: wireEdgeKind(edge.Kind, edge.Origin)}] = struct{}{}
  }
  for _, tag := range g.DocTags {
    if tag == nil {
      continue
    }
    target := leadingToken(tag.Text)
    if target == "" {
      continue
    }
    address, resolved := byAddress[target]
    if !resolved {
      continue
    }
    key := edgeKey{from: tag.Target, to: address, kind: wireEdgeKind(EdgeDocRef, "")}
    if _, exists := seen[key]; exists {
      continue
    }
    seen[key] = struct{}{}
    g.Edges = append(g.Edges, &Edge{From: tag.Target, To: address, Kind: EdgeDocRef, Pos: -1, End: -1})
  }
}

// leadingToken is the first whitespace-delimited word of a tag's text, which is
// the address a citation names. Everything after it is prose the author wrote
// for a human.
func leadingToken(text string) string {
  trimmed := strings.TrimSpace(text)
  if trimmed == "" {
    return ""
  }
  if space := strings.IndexAny(trimmed, " \t"); space >= 0 {
    return trimmed[:space]
  }
  return trimmed
}

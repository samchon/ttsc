package evidence

import (
  "sort"
  "strings"

  shimast "github.com/microsoft/typescript-go/shim/ast"
)

const graphRuleName = "evidence/graph"

const singularRuleName = "evidence/singular"

const documentedRuleName = "evidence/documented"

const todoRuleName = "evidence/todo"

const reviewRuleName = "evidence/review"

type artifactKind string

const (
  artifactMarkdown   artifactKind = "markdown"
  artifactPrisma     artifactKind = "prisma"
  artifactSwagger    artifactKind = "swagger"
  artifactTypeScript artifactKind = "typescript"
)

type tagKind string

const (
  tagEvidence tagKind = "evidence"
  tagExclude  tagKind = "evidenceExclude"
)

type graphConfig struct {
  Claims []claimSpec
}

type claimSpec struct {
  Index    int
  Type     artifactKind
  Name     string
  Disabled bool
  // Root is the author's spelling of the directory this population resolves
  // against, empty when the ttsc project root is the base. It is kept beside
  // the resolved Base because the two are produced at different times: the
  // spelling decodes from options alone, while the resolution needs a project
  // identity the decoder never sees.
  Root  string
  Base  populationBase
  Files globSet
  // ExclusionCarriers narrows where this claim's @evidenceExclude may sit.
  // Empty keeps the historical behavior, where an exclusion is eligible
  // anywhere in Files. Declared, only a carrier file hosts one, so every
  // exclusion a claim owns is read by opening one file.
  ExclusionCarriers globSet
  Symbols           symbolSet
  References        []referenceSpec
}

type referenceSpec struct {
  Index  int
  Type   artifactKind
  Policy referencePolicy
  Root   string
  Base   populationBase
  Files  globSet
  Source string
  // Package moves the base that Files resolves against from the project to an
  // installed package. With no globs it also becomes the selection itself: the
  // package's declaration entry defines the population by reachability, while
  // identity still belongs to the file that declares each symbol.
  Package string
  Symbols symbolSet
}

// referencePolicy is a reference-local strengthening of the ordinary
// acknowledgement contract, declared flat on the public reference object. Its
// zero value preserves every previous graph behavior, so a reference written
// before these options existed decodes into the same model it always did.
type referencePolicy struct {
  // NoExclude refuses @evidenceExclude as an acknowledgement of this
  // population, leaving its targets owing positive evidence.
  NoExclude bool
  // UniqueEvidence allows at most one positive semantic claim host per
  // selected unit.
  UniqueEvidence bool
  // SingleEvidencePerSymbol requires exactly one distinct selected unit from
  // every selected semantic claim host, including the hosts carrying no tag.
  SingleEvidencePerSymbol bool
  // RequireReview demands that every acknowledgement of this population carry
  // an `@evidenceReview` whose fingerprint matches the cited scope's current
  // content, so a review expires when the thing it reviewed moves.
  RequireReview bool
}

// evidenceReview is one verification statement bound to its host and target.
//
// It is a sibling of evidenceDeclaration rather than a variant of it. Nothing
// that counts acknowledgements may reach a review, so the two never share a
// slice, a map, or a type. Target is the token as written and is compared
// against a declaration's target rather than resolved again: the citation and
// its review spell one address, and resolving twice would let a review answer a
// scope its citation does not name.
type evidenceReview struct {
  // HostID is the source-position identity, kept only so a carrier with no
  // semantic identity can still be matched. It must not be the primary key: a
  // merged identity's halves sit at different positions and therefore carry
  // different HostIDs, so matching on it alone refuses a review written on
  // `namespace I` for a citation on `interface I` — placement the graph
  // elsewhere calls not worth a diagnostic, and which `evidence/review` accepts.
  HostID string
  // SemanticHostIDs are the selected graph identities this review is written on,
  // which is what a citation is matched by.
  SemanticHostIDs []string
  // Reviews names which acknowledgement this review answers for. It is part of
  // the match, never inferred: verifying a citation and verifying an exclusion
  // are opposite questions, so a review of one must not discharge the other.
  Reviews     tagKind
  Type        artifactKind
  Target      string
  Fingerprint string
  Description string
  Path        string
  Line        int
}

func (review *evidenceReview) location() string {
  return review.Path + ":" + decimal(review.Line)
}

// entrySelected reports whether this reference materializes by traversal.
func (reference referenceSpec) entrySelected() bool {
  return reference.Package != "" && len(reference.Files.Patterns) == 0
}

type symbolSet map[string]bool

func (set symbolSet) contains(symbol string) bool {
  return set[symbol]
}

func (set symbolSet) intersects(other symbolSet) bool {
  for symbol := range set {
    if other[symbol] {
      return true
    }
  }
  return false
}

func (set symbolSet) names() string {
  order := []string{"file", "h1", "h2", "h3", "h4", "operation", "model", "column", "relation", "type", "function", "property"}
  names := make([]string, 0, len(set))
  known := map[string]bool{}
  for _, name := range order {
    known[name] = true
    if set[name] {
      names = append(names, name)
    }
  }
  other := []string{}
  for name := range set {
    if !known[name] {
      other = append(other, name)
    }
  }
  sort.Strings(other)
  names = append(names, other...)
  return strings.Join(names, ", ")
}

type evidenceUnit struct {
  ID       string
  ParentID string
  Target   string
  // Identity is Target before joining, kept so an entry-relative address can
  // be rebuilt segment by segment. Rewriting the joined string instead would
  // let a literal dot inside a name collapse into qualification.
  Identity []string
  // Aliases are the additional addresses this unit answers to when an entry
  // exposes it by more than one path. They resolve to this same unit, so a
  // symbol reachable twice is still one coverage obligation.
  Aliases  []string
  Type     artifactKind
  Symbol   string
  Path     string
  Line     int
  Readable string
  // Hidden names the documentation tag by which this declaration withdrew
  // itself from the public surface, empty when it did not. Such a unit is
  // never selected and never hosts a declaration; it is retained only so a
  // citation of it can be told why the target it names is not there.
  Hidden string
  // ValueSpace marks a unit reached only through a value: a function, a
  // variable, a class member, or a member of an interface merged with a class.
  //
  // A type-only export exposes no value, so it exposes none of these either.
  // The collector answers that for an export written in the declaring file,
  // where it knows the declaration kind in hand. A re-export naming another
  // module arrives at traversal time with no such context, which is what this
  // field supplies: the same question, asked once at materialization and
  // answered wherever reachability arrives through a type-only edge.
  //
  // It is read together with TypeSpace rather than alone, because a merged
  // identity is written by more than one collector and a plain assignment would
  // let source order decide.
  ValueSpace bool
  // TypeSpace marks a unit some declaration of which is reached without a
  // value, and it wins over ValueSpace.
  //
  // One identity can be spelled by two collectors: `interface Order { member }`
  // beside `namespace Order { export const member }` is one `property` unit
  // written once by the member collector and once by the variable one. A
  // type-only export exposes the interface half, so the unit survives, and the
  // answer must not depend on which half the author wrote first.
  TypeSpace bool
  // Digest is this unit's content, hashed after normalization and with every
  // position a tag can live in removed.
  //
  // How much "its content" is depends on the artifact, and the difference is
  // load-bearing rather than incidental. A Markdown heading owns the lines
  // between it and the next heading, so a subsection's body belongs to the
  // subsection. A TypeScript unit owns its whole declaration text, which
  // **contains** every nested member's text, because that is what a declaration
  // is: there is no reading of `interface ISale` that excludes the members it
  // declares, callables included.
  //
  // So a nested change moves both its own unit's digest and every enclosing
  // unit's. `scopeIndex` composes ancestors and descendants anyway, so detection
  // is unaffected, but nothing here may assume a unit's digest is independent of
  // its subtree. A feature built on that assumption was reverted once already.
  //
  // Removing the documentation comment is what stops the review from
  // invalidating itself: writing an `@evidenceReview` inside a unit that is
  // itself cited would otherwise change the digest that the review's own
  // fingerprint is checked against, and the repair would never terminate.
  //
  // Empty when the loader for this artifact kind cannot see the unit's
  // content. A reference over such a population refuses `requireReview` at
  // decode rather than comparing against nothing.
  Digest string
}

func (unit *evidenceUnit) location() string {
  if unit.Line <= 0 {
    return unit.Path
  }
  return unit.Path + ":" + decimal(unit.Line)
}

type evidenceDeclaration struct {
  ID     string
  HostID string
  // SemanticHostIDs names the selected graph identities that physically host
  // this declaration. HostID remains the source-position identity used only
  // for same-block duplicate detection; policy cardinality must not confuse a
  // declaration position with the public symbol identity it represents.
  SemanticHostIDs []string
  Type            artifactKind
  Tag             tagKind
  Target          string
  Reason          string
  Hosts           symbolSet
  // ExclusionCarrier permits only @evidenceExclude to participate without a
  // selected host kind. File matching, target resolution, and claim-reference
  // ownership still decide the obligations it can discharge.
  ExclusionCarrier bool
  Path             string
  Line             int
  Sequence         int
}

func (declaration *evidenceDeclaration) location() string {
  return declaration.Path + ":" + decimal(declaration.Line)
}

func (declaration *evidenceDeclaration) valid() bool {
  return declaration.Target != "" && declaration.Reason != ""
}

type artifactInventory struct {
  // Address is the population-relative identity used for units and
  // declarations. It differs from Path when a configured root moves the
  // address space while diagnostics remain project-relative.
  Address string
  // Path is the location a diagnostic names: project-relative, ascending with
  // `..` when the file sits above the project root. It is not the key this
  // inventory is filed under — that key carries the population base as well,
  // because one file reached through two roots owns two sets of targets.
  Path         string
  Type         artifactKind
  Units        []*evidenceUnit
  Declarations []*evidenceDeclaration
  // Reviews are the verification statements this artifact carries, kept apart
  // from Declarations so no consumer counting acknowledgements can reach one.
  Reviews  []*evidenceReview
  Problems []inventoryProblem
  // LoadFailed distinguishes an unreadable or rejected artifact from a
  // healthy artifact that legitimately materializes no selected units.
  // Coverage is a completeness claim, so a failed inventory cannot be used
  // to derive missing acknowledgements or an empty-population diagnostic.
  LoadFailed bool
  // FailureBase is set only on a synthetic health marker for a population
  // whose root or walk could not be inspected completely. The marker never
  // participates in glob matching; it carries loader health across the same
  // immutable inventory boundary as the artifacts the loader did reach.
  FailureBase string
  // Imports indexes the local names a TypeScript module brings into scope, so
  // an inline-link target can be resolved the way TypeScript resolves a name:
  // from the citing file's own bindings rather than from a global table.
  Imports map[string]importBinding
  // Exports is the module's public surface as importers see it, which is what
  // an entry traversal follows. It records reachability only; a re-export
  // still creates no unit of its own.
  Exports []moduleExport
  // UnitNodes maps a unit ID to every declaration node that spells it.
  //
  // A unit is an identity, not a declaration: declaration merging and overload
  // sets give one identity several nodes. Which of them a rule then cares
  // about is the rule's own business — this records only that they belong to
  // one identity. The graph scanner uses the association transiently to bind a
  // physical JSDoc declaration to semantic claim-host identities, then releases
  // it; callers with no such use leave it nil.
  UnitNodes map[string][]*shimast.Node
}

func (inventory *artifactInventory) recordUnitNode(id string, node *shimast.Node) {
  if inventory == nil || inventory.UnitNodes == nil || node == nil {
    return
  }
  inventory.UnitNodes[id] = append(inventory.UnitNodes[id], node)
}

type inventoryProblem struct {
  Symbol  string
  Message string
}

type claimState struct {
  Spec         claimSpec
  Paths        []string
  Hosts        []*evidenceUnit
  Declarations []*evidenceDeclaration
  Reviews      []*evidenceReview
  References   []referenceState
  Healthy      bool
  // OutsideCarrier names declarations this claim selected from a file its
  // ExclusionCarriers does not match. Only exclusions are judged by it, and
  // it stays empty when the claim declares no carrier.
  OutsideCarrier map[string]bool
}

type referenceState struct {
  Spec   referenceSpec
  Paths  []string
  Units  []*evidenceUnit
  Scopes []*evidenceUnit
  // Population is every unit this reference's files materialized, selected or
  // not. Units and Scopes are both narrowed by the `symbol` selector, so
  // neither can answer what a cited scope structurally contains, and a review
  // fingerprint has to be a property of the cited address rather than of the
  // reference that asked for it.
  Population []*evidenceUnit
  // Published names the module-and-address pairs a citation may use, for a
  // population selected by walking module exports. Left empty when the
  // population's addresses belong to the files that declare them.
  Published []publishedAddress
  // Hidden are the units this reference would have selected had their
  // declarations not withdrawn themselves from the public surface. They carry
  // no obligation; they exist so a citation of one names its cause.
  Hidden       []*evidenceUnit
  UnitsByScope map[string][]*evidenceUnit
  Healthy      bool
}

func decimal(value int) string {
  if value == 0 {
    return "0"
  }
  negative := value < 0
  if negative {
    value = -value
  }
  digits := make([]byte, 0, 12)
  for value > 0 {
    digits = append([]byte{byte('0' + value%10)}, digits...)
    value /= 10
  }
  if negative {
    return "-" + string(digits)
  }
  return string(digits)
}

// markSpace records which space this declaration of the unit is reached
// through, letting type-space win.
//
// A plain assignment made the answer depend on which half of a merged identity
// the author wrote first, in the one shape where two collectors write one unit:
// an interface member beside a namespace member of the same name. The
// suppression it feeds is a silent one, so the divergence was a build going
// green or red on declaration order with no message either way.
//
// Every site goes through here, including the ones that can only ever be value
// space. A site that assigns the field directly is correct until the day its
// address collides with a type-space one, and that is exactly the day nobody is
// looking at it.
func (unit *evidenceUnit) markSpace(valueSpace bool) {
  if valueSpace {
    unit.ValueSpace = true
    return
  }
  unit.TypeSpace = true
}

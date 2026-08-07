package evidence

import (
  "sort"
  "sync"

  "github.com/samchon/ttsc/packages/lint/rule"
)

// graphCorpus is what a passing Check publishes for Hints to project.
//
// It carries the inventories Check already built rather than the paths to
// rebuild them from. The graph loads Markdown and Swagger to do its own job, so
// handing that result forward costs a build nothing; reloading inside Hints
// would read every source a second time to answer a question the rule had just
// finished answering.
//
// What the editor path does pay is Check itself. A hints request runs a fresh
// project cycle (`linthost/hints.go:74`), so every source the graph reads is
// read again there — including an HTTP(S) Swagger reference, which is fetched.
// That cost is inherent to answering from a current index rather than a stale
// one, and it is bounded the same way a build is: a source that fails to load
// is reported by Check, which fails the rule, which withdraws the corpus.
type graphCorpus struct {
  Config   graphConfig
  Markdown map[string]*artifactInventory
  Prisma   map[string]*artifactInventory
  Swagger  map[string]*artifactInventory
}

// graphCycleState is the immutable graph corpus plus the one piece of mutable
// coordination file rules need during this Program cycle.
//
// The host exposes project state, not a lifecycle identifier, to contributor
// file rules. Keeping the diagnostic gate here gives every parallel file walk
// one cycle-scoped rendezvous and lets the host discard it on the next watch
// rebuild. The mutex owns only a set membership check; graph data remains
// immutable.
type graphCycleState struct {
  Corpus      graphCorpus
  Diagnostics programDiagnosticGate
}

type programDiagnosticGate struct {
  mutex    sync.Mutex
  reported map[string]bool
}

func (gate *programDiagnosticGate) first(key string) bool {
  if gate == nil {
    return true
  }
  gate.mutex.Lock()
  defer gate.mutex.Unlock()
  if gate.reported == nil {
    gate.reported = map[string]bool{}
  }
  if gate.reported[key] {
    return false
  }
  gate.reported[key] = true
  return true
}

// Hints projects the configured evidence population into editor completions.
//
// A target has to be reproduced exactly, and the anchor an author cannot recall
// is the one this offers. The corpus is a value: the host serializes it and the
// LSP proxy answers from cache long after the lint process exited, so nothing
// here can be computed per keystroke.
//
// The corpus is available only while the graph passes, and that is a host gate
// rather than a choice made here. `linthost/hints.go:147-149` skips a rule whose
// snapshot is not `ProjectRulePassed` or whose state is nil, and
// `projectReporter.Report` sets `failed = true` unconditionally
// (`linthost/project_engine.go:68-77`). So the cycle that reports an unmet
// obligation is the cycle that withdraws the completions — which is the cycle an
// author is most likely to be writing a citation in. Nothing in this package can
// widen that; it widens upstream, by letting a project rule publish state it
// reported against.
func (graphRule) Hints(ctx *rule.HintContext) []rule.Hint {
  if ctx == nil {
    return nil
  }
  cycle, published := ctx.State.(*graphCycleState)
  if !published || cycle == nil {
    return nil
  }
  corpus := cycle.Corpus
  hints := []rule.Hint{}
  for _, audience := range evidenceHintAudiences(corpus.Config) {
    units := selectedCompletionUnits(
      corpus.Config,
      corpus.Markdown,
      corpus.Prisma,
      corpus.Swagger,
      audience,
    )
    routes := selectsTypeScriptReference(corpus.Config, audience)
    if routes {
      hints = append(hints, typeScriptRouteHint(audience.Trigger))
    }
    for _, unit := range units {
      hints = append(hints, rule.Hint{
        Insert:  unit.Target,
        Detail:  unit.Readable,
        Trigger: audience.Trigger,
      })
    }
  }
  return hints
}

// hintAudience is one tag position and the obligations writable at it.
//
// A trigger is not enough on its own. `@evidence ` and `@evidence(produces) `
// are different positions offering different populations, and the difference is
// the reference policy rather than anything about the text.
type hintAudience struct {
  Trigger   rule.HintTrigger
  Exclusion bool
  Role      string
}

// evidenceHintAudiences names every tag position a target can be written in.
//
// Each `After` ends where the target begins, which is what makes the text the
// author has typed so far the editor's filter. The trailing space also keeps
// them apart: `"@evidence "` occurs inside neither `"@evidenceExclude "` nor
// `"@evidence(produces) "`, because the character following `@evidence` is `E`
// in the first and `(` in the second.
//
// A configured relation earns its own position because it is a position an
// author must type: a reference declaring one is discharged by `@evidence(role)`
// and by nothing else, so completing only the role-free tag would hand the
// author a target the obligation refuses, and completing nothing after the
// relation would leave the tag the rule demands as the one tag with no help at
// all. Offering the plain position only the role-free obligations is the same
// rule read from the other side.
func evidenceHintAudiences(config graphConfig) []hintAudience {
  audiences := []hintAudience{
    {Trigger: rule.HintTrigger{Scope: rule.HintScopeJSDoc, After: "@evidence "}},
    {
      Trigger:   rule.HintTrigger{Scope: rule.HintScopeJSDoc, After: "@evidenceExclude "},
      Exclusion: true,
    },
  }
  roles := []string{}
  seen := map[string]bool{}
  for _, claim := range config.Claims {
    for _, reference := range claim.References {
      if role := reference.Policy.Role; role != "" && !seen[role] {
        seen[role] = true
        roles = append(roles, role)
      }
    }
  }
  sort.Strings(roles)
  for _, role := range roles {
    audiences = append(audiences, hintAudience{
      Trigger: rule.HintTrigger{
        Scope: rule.HintScopeJSDoc,
        After: "@evidence(" + role + ") ",
      },
      Role: role,
    })
  }
  return audiences
}

// typeScriptRouteHint routes the author into TypeScript's own completion.
//
// The host merges a corpus into the upstream response and cannot remove from
// it, so narrowing TypeScript's symbol list is not available to us. Putting the
// author inside that list is: once the brace opens, the language service
// answers every keystroke after it, against the import scope at the cursor —
// which a corpus built once per Program could never know.
//
// The inserted text is deliberately unclosed. `Insert` is verbatim with no
// snippet expansion, so the cursor lands where the text ends; `{@link }` would
// park it one character past the only position where completion fires. A
// missing brace is visible and one keystroke, and the target grammar catches it
// if forgotten. A cursor in the wrong place is silent.
func typeScriptRouteHint(trigger rule.HintTrigger) rule.Hint {
  return rule.Hint{
    Insert:  "{@link ",
    Label:   "{@link",
    Detail:  "TypeScript symbol, resolved through this file's imports",
    Trigger: trigger,
  }
}

// selectsTypeScriptReference reports whether any claim cites TypeScript.
//
// The entry is withheld otherwise, because a graph citing only Markdown cannot
// resolve an inline-link target — offering the grammar there would hand the
// author an unresolved-target diagnostic for taking a suggestion.
//
// The condition is necessarily global. A corpus answers a keystroke with no
// file context, so it cannot tell which claim owns the file the cursor is in;
// a repository mixing a TypeScript-citing claim with a Markdown-only one offers
// the entry in both. Narrowing that needs a per-file corpus, which the contract
// deliberately does not have.
func selectsTypeScriptReference(config graphConfig, audience hintAudience) bool {
  for _, claim := range config.Claims {
    for _, reference := range claim.References {
      if reference.Type == artifactTypeScript &&
        audience.accepts(reference) {
        return true
      }
    }
  }
  return false
}

// accepts reports whether a reference can be discharged from this position.
//
// A relation constrains positive evidence only, which is why the exclusion
// position ignores it: an exclusion states that the claim does not cover the
// target rather than how it does, and `noEvidenceExclude` is what decides
// whether a reference accepts one at all.
func (audience hintAudience) accepts(reference referenceSpec) bool {
  if audience.Exclusion {
    return !reference.Policy.NoExclude
  }
  return reference.Policy.Role == audience.Role
}

// selectedCompletionUnits collects the units some configured reference selects,
// in the order they should be offered.
//
// Slice order is the corpus's only ranking channel, so it answers what an
// author cannot supply from memory. A heading's generated anchor is neither
// visible in the project tree nor guessable from its text, so selected headings
// come first; a Markdown file path is typed as easily as it is read, so file
// targets follow; Swagger operations come last, being both few and mechanical.
//
// Order therefore serves the author who is still browsing, and the filter
// serves the one who is not. No hint sets Label, so the editor lists and
// filters on the target itself: typing `docs/pricing` narrows to that
// document's anchors, which is the flow this ranking is for — an author writes
// a citation because they are implementing a document they have already chosen.
//
// Labelling a heading by its text would invert that. `sale` would match and
// `docs/pricing` would match nothing, two documents sharing a heading would
// become indistinguishable entries, and the listed text would stop being the
// inserted text — three costs to serve recall-by-title, which Detail already
// serves by being visible. Leaving Label empty keeps what is shown and what is
// written identical by construction.
//
// TypeScript units are absent on purpose. TypeScript's own language service
// completes symbols inside `{@link}` against the scope at the cursor, which a
// corpus built once per Program cannot know — offering one here would duplicate
// a correct list with a worse one.
func selectedCompletionUnits(
  config graphConfig,
  markdown map[string]*artifactInventory,
  prisma map[string]*artifactInventory,
  swagger map[string]*artifactInventory,
  audience hintAudience,
) []*evidenceUnit {
  ranked := map[string][]*evidenceUnit{}
  seen := map[string]bool{}
  for _, claim := range config.Claims {
    for _, reference := range claim.References {
      if !audience.accepts(reference) {
        continue
      }
      inventories := inventoriesOf(
        reference.Type,
        markdown,
        prisma,
        swagger,
        map[string]*artifactInventory{},
      )
      for _, path := range matchingReferencePaths(inventories, reference) {
        inventory := inventories[path]
        if inventory == nil {
          continue
        }
        for _, unit := range inventory.Units {
          if unit.Hidden != "" ||
            !reference.Symbols.contains(unit.Symbol) ||
            seen[unit.ID] {
            continue
          }
          seen[unit.ID] = true
          group := completionRank(unit)
          ranked[group] = append(ranked[group], unit)
        }
      }
    }
  }
  units := []*evidenceUnit{}
  for _, group := range []string{"heading", "file", "operation", "model"} {
    tier := ranked[group]
    sort.SliceStable(tier, func(left int, right int) bool {
      if tier[left].Path != tier[right].Path {
        return tier[left].Path < tier[right].Path
      }
      return tier[left].Line < tier[right].Line
    })
    units = append(units, tier...)
  }
  return units
}

func completionRank(unit *evidenceUnit) string {
  switch {
  case unit.Type == artifactSwagger:
    return "operation"
  case unit.Type == artifactPrisma:
    return "model"
  case unit.Symbol == "file":
    return "file"
  default:
    return "heading"
  }
}

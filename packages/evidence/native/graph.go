package evidence

import (
  "os"
  "path/filepath"
  "sort"
  "strings"

  "github.com/samchon/ttsc/packages/lint/rule"
)

type graphRule struct{}

func (graphRule) Name() string { return graphRuleName }

func (graphRule) NeedsTypeChecker() bool { return false }

func (graphRule) Check(ctx *rule.ProjectContext) {
  if ctx == nil {
    return
  }
  typeScriptInventories.beginCycle()
  cycle := &graphCycleState{}
  // SetState survives a later project finding and belongs only to this
  // Program cycle. File rules can therefore coordinate diagnostics even when
  // the graph itself fails, while Hints remains protected by the host's
  // passed-only publication gate.
  ctx.SetState(cycle)
  config, problems := decodeGraphConfig(ctx.Options)
  if len(problems) != 0 {
    reportProblems(ctx, problems)
    return
  }
  config = enabledGraphConfig(config)
  if len(config.Claims) == 0 {
    cycle.Corpus = graphCorpus{Config: config}
    return
  }
  root := evidenceProjectRoot(ctx.Identity)
  if root == "" {
    ctx.Report("Evidence graph could not resolve the project root. Run ttsc with a project config or explicit project root so project-relative evidence globs have one stable base.")
    return
  }
  info, err := os.Stat(root)
  if err != nil || !info.IsDir() {
    ctx.Report("Evidence graph project root '" + root + "' is not a readable directory. Fix the ttsc project identity before evaluating evidence globs.")
    return
  }
  // Every population is anchored before anything is read, so a loader, a
  // diagnostic, and the corpus the editor receives all speak of one resolved
  // base rather than each re-deriving it from the author's spelling.
  resolveGraphBases(root, &config)

  // A claim with no selected own unit has nothing that can own an
  // acknowledgement. Materialize only claim-side populations first, so an
  // inactive claim cannot make its reference loaders perform work or report
  // diagnostics.
  typescript := loadTypeScriptInventories(
    root,
    ctx.Sources,
    claimPopulationConfig(config, artifactTypeScript),
  )
  markdownClaims, markdownClaimProblems := loadMarkdownInventories(
    root,
    claimPopulationConfig(config, artifactMarkdown),
  )
  prismaClaims, prismaClaimProblems := loadPrismaInventories(
    root,
    claimPopulationConfig(config, artifactPrisma),
  )
  problems = append(problems, markdownClaimProblems...)
  problems = append(problems, prismaClaimProblems...)
  config = activeGraphConfig(config, markdownClaims, prismaClaims, typescript)
  governed := map[string]bool{}
  extendTypeScriptInventories(root, ctx.Sources, config, typescript, governed)
  markdown, markdownProblems := loadMarkdownInventories(root, config)
  prisma, prismaProblems := loadPrismaInventories(root, config)
  swagger, swaggerProblems := loadSwaggerInventories(root, config)
  problems = append(problems, markdownProblems...)
  problems = append(problems, prismaProblems...)
  problems = append(problems, swaggerProblems...)
  problems = append(problems, unreadableTypeScriptTags(typescript, governed)...)
  loader := newTypeScriptLoader(root, typescript)
  states, stateProblems := materializeClaimStates(
    config,
    markdown,
    prisma,
    swagger,
    typescript,
    loader,
  )
  problems = append(problems, stateProblems...)
  problems = append(problems, evaluateEvidenceGraph(states, loader)...)
  reportProblems(ctx, problems)
  if len(problems) == 0 {
    // Published only on a clean evaluation, because the host reads state
    // from a rule that passed and reporting anything marks this one failed
    // (`linthost/hints.go:147-149`, `linthost/project_engine.go:68-77`).
    // Setting it unconditionally would not widen the gate; it would only
    // hide where the gate is.
    cycle.Corpus = graphCorpus{
      Config:   config,
      Markdown: markdown,
      Prisma:   prisma,
      Swagger:  swagger,
    }
  }
}

func init() {
  rule.RegisterProject(graphRule{})
}

func evidenceProjectRoot(identity rule.ProjectIdentity) string {
  for _, candidate := range []string{
    identity.PhysicalProjectRoot,
    identity.LogicalProjectRoot,
    identity.ExplicitProjectRoot,
    identity.InvocationCwd,
  } {
    if candidate == "" {
      continue
    }
    absolute, err := filepath.Abs(candidate)
    if err == nil {
      return filepath.Clean(absolute)
    }
  }
  return ""
}

// claimPopulationConfig removes every reference and other artifact kind from
// the loader input used to decide activation.
//
// This is a loading boundary, not merely an evaluation filter: a claim cannot
// become inactive because a failed reference was inspected before the claim's
// own selected host population was known.
func claimPopulationConfig(
  config graphConfig,
  kind artifactKind,
) graphConfig {
  claims := make([]claimSpec, 0, len(config.Claims))
  for _, claim := range config.Claims {
    if claim.Type != kind {
      continue
    }
    claim.References = nil
    claims = append(claims, claim)
  }
  return graphConfig{Claims: claims}
}

// activeGraphConfig omits healthy claim populations that contain no own unit
// selected by the claim's symbol set.
//
// TypeScript, Prisma, and Markdown are the three claim-capable artifact kinds.
// A healthy zero-file match is empty and therefore inactive, including when a
// typo caused it. Unhealthy or unreadable populations stay active because
// failed input cannot prove the selected population is empty.
func activeGraphConfig(
  config graphConfig,
  markdown map[string]*artifactInventory,
  prisma map[string]*artifactInventory,
  typescript map[string]*artifactInventory,
) graphConfig {
  active := make([]claimSpec, 0, len(config.Claims))
  for _, claim := range config.Claims {
    inventories := inventoriesOf(
      claim.Type,
      markdown,
      prisma,
      map[string]*artifactInventory{},
      typescript,
    )
    if claimIsInactive(claim, inventories) {
      continue
    }
    active = append(active, claim)
  }
  config.Claims = active
  return config
}

func claimIsInactive(
  claim claimSpec,
  inventories map[string]*artifactInventory,
) bool {
  switch claim.Type {
  case artifactMarkdown, artifactPrisma, artifactTypeScript:
  default:
    return false
  }
  paths := matchingInventoryPaths(inventories, claim.Base, claim.Files)
  if !populationIsHealthy(inventories, claim.Base, paths) ||
    unreadableBaseProblem(claim.Base, claim.Type) != "" {
    return false
  }
  for _, path := range paths {
    for _, unit := range inventories[path].Units {
      if unit.Hidden == "" && claim.Symbols.contains(unit.Symbol) {
        return false
      }
    }
  }
  return true
}

func materializeClaimStates(
  config graphConfig,
  markdown map[string]*artifactInventory,
  prisma map[string]*artifactInventory,
  swagger map[string]*artifactInventory,
  typescript map[string]*artifactInventory,
  loader *typeScriptLoader,
) ([]claimState, []string) {
  states := make([]claimState, 0, len(config.Claims))
  problems := []string{}
  for _, claim := range config.Claims {
    inventories := inventoriesOf(claim.Type, markdown, prisma, swagger, typescript)
    paths := matchingInventoryPaths(inventories, claim.Base, claim.Files)
    state := claimState{
      Spec:           claim,
      Paths:          paths,
      Healthy:        populationIsHealthy(inventories, claim.Base, paths),
      OutsideCarrier: map[string]bool{},
    }
    carrierPaths := map[string]bool{}
    if len(claim.ExclusionCarriers.Patterns) != 0 {
      // The carriers narrow the claim's own population and never widen
      // it, so a pattern matching a file this claim does not select
      // contributes nothing and leaves the set empty.
      claimPaths := map[string]bool{}
      for _, path := range paths {
        claimPaths[path] = true
      }
      for _, carrier := range matchingInventoryPaths(inventories, claim.Base, claim.ExclusionCarriers) {
        if claimPaths[carrier] {
          carrierPaths[carrier] = true
        }
      }
      // A carrier set that selects nothing would silently refuse every
      // exclusion the claim writes, so the misspelling is reported where
      // it was made rather than as a placement finding on each tag.
      if len(carrierPaths) == 0 && len(paths) != 0 {
        problems = append(
          problems,
          claimLabel(claim)+" declares evidenceExcludeCarriers "+describePopulation(claim.Base, claim.ExclusionCarriers)+", which selects none of its "+decimal(len(paths))+" claim file(s). Point the patterns at a file this claim already selects, or drop the property to accept an exclusion anywhere in the population.",
        )
      }
    }
    if len(paths) == 0 && state.Healthy {
      problems = append(
        problems,
        claimLabel(claim)+" matched no "+string(claim.Type)+" files for "+describePopulation(claim.Base, claim.Files)+". Fix the globs or the root they resolve against; '*' stays within one segment, '**' crosses segments, and a bare directory is not recursive.",
      )
    }
    hostsByID := map[string]bool{}
    for _, path := range paths {
      for _, unit := range inventories[path].Units {
        if unit.Hidden != "" ||
          !claim.Symbols.contains(unit.Symbol) ||
          hostsByID[unit.ID] {
          continue
        }
        hostsByID[unit.ID] = true
        state.Hosts = append(state.Hosts, unit)
      }
      state.Declarations = append(
        state.Declarations,
        inventories[path].Declarations...,
      )
      // Reviews travel beside declarations and never among them. They carry no
      // obligation of their own; they are looked up by host and target when a
      // reference demands one.
      state.Reviews = append(state.Reviews, inventories[path].Reviews...)
      if len(claim.ExclusionCarriers.Patterns) != 0 && !carrierPaths[path] {
        for _, declaration := range inventories[path].Declarations {
          state.OutsideCarrier[declaration.ID] = true
        }
      }
    }
    sortUnits(state.Hosts)
    for _, reference := range claim.References {
      referenceInventories := inventoriesOf(
        reference.Type,
        markdown,
        prisma,
        swagger,
        typescript,
      )
      if reference.Type == artifactTypeScript && reference.entrySelected() {
        entryState, entryProblems := materializeEntryReference(
          claim,
          reference,
          loader,
        )
        problems = append(problems, entryProblems...)
        state.References = append(state.References, entryState)
        continue
      }
      if reference.Type == artifactTypeScript && reference.Package != "" {
        packageState, packageProblems := materializePackageGlobReference(
          claim,
          reference,
          loader,
        )
        problems = append(problems, packageProblems...)
        state.References = append(state.References, packageState)
        continue
      }
      if reference.Type == artifactTypeScript {
        localState, localProblems := materializeLocalTypeScriptReference(
          claim,
          reference,
          referenceInventories,
          loader,
        )
        problems = append(problems, localProblems...)
        state.References = append(state.References, localState)
        continue
      }
      referencePaths := matchingReferencePaths(
        referenceInventories,
        reference,
      )
      referenceState := referenceState{
        Spec:         reference,
        Paths:        referencePaths,
        UnitsByScope: map[string][]*evidenceUnit{},
        Healthy:      populationIsHealthy(referenceInventories, reference.Base, referencePaths),
      }
      if len(referencePaths) == 0 && referenceState.Healthy {
        if reference.Type == artifactSwagger {
          problems = append(
            problems,
            claimLabel(claim)+" "+referenceLabel(reference)+" matched no swagger source for "+describeReferenceSources(reference)+". Fix the reference location; this obligation cannot materialize evidence units without a source.",
          )
        } else {
          problems = append(
            problems,
            claimLabel(claim)+" "+referenceLabel(reference)+" matched no "+string(reference.Type)+" files for "+describePopulation(reference.Base, reference.Files)+". Fix the reference globs or the root they resolve against; this obligation cannot materialize evidence units without files.",
          )
        }
      }
      selectedInventoryProblem := false
      availableUnits := map[string]*evidenceUnit{}
      selectedUnits := map[string]bool{}
      for _, path := range referencePaths {
        for _, inventoryProblem := range referenceInventories[path].Problems {
          if inventoryProblem.Symbol == "*" ||
            reference.Symbols.contains(inventoryProblem.Symbol) {
            selectedInventoryProblem = true
          }
        }
        for _, unit := range referenceInventories[path].Units {
          // A withdrawn declaration is not an obligation and not an
          // aggregate scope either, so it never enters the map that
          // promotes ancestors. It is still recorded, so a citation
          // naming it is answered with the tag rather than with a
          // target that appears not to exist.
          if unit.Hidden != "" {
            if !selectedUnits[unit.ID] {
              selectedUnits[unit.ID] = true
              referenceState.Hidden = append(
                referenceState.Hidden,
                unit,
              )
            }
            continue
          }
          availableUnits[unit.ID] = unit
          if !reference.Symbols.contains(unit.Symbol) ||
            selectedUnits[unit.ID] {
            continue
          }
          selectedUnits[unit.ID] = true
          referenceState.Units = append(referenceState.Units, unit)
        }
      }
      sortUnits(referenceState.Units)
      scopesByID := map[string]*evidenceUnit{}
      for _, unit := range referenceState.Units {
        for scope := unit; scope != nil; scope = availableUnits[scope.ParentID] {
          referenceState.UnitsByScope[scope.ID] = append(
            referenceState.UnitsByScope[scope.ID],
            unit,
          )
          if scopesByID[scope.ID] == nil {
            scopesByID[scope.ID] = scope
            referenceState.Scopes = append(referenceState.Scopes, scope)
          }
          if scope.ParentID == "" {
            break
          }
        }
      }
      sortUnits(referenceState.Scopes)
      // The complete materialized population is kept because a review
      // fingerprint must not depend on this reference's `symbol` selector.
      // Units and Scopes hold only what this reference selected plus the
      // ancestors of those, so an unselected descendant appears in neither, and
      // composing a scope digest from them made the value a function of the
      // reference rather than of the cited address: a narrowed selector dropped
      // the subtree from the digest, and two references over one scope demanded
      // two different values from a tag that carries one token, which no author
      // could satisfy.
      for _, unit := range availableUnits {
        referenceState.Population = append(referenceState.Population, unit)
      }
      sortUnits(referenceState.Population)
      if len(referencePaths) != 0 &&
        len(referenceState.Units) == 0 &&
        referenceState.Healthy &&
        !selectedInventoryProblem {
        problems = append(
          problems,
          claimLabel(claim)+" "+referenceLabel(reference)+" matched "+decimal(len(referencePaths))+" file(s) but materialized no selected evidence units ("+reference.Symbols.names()+"). Select symbol kinds present in those files or correct the reference globs.",
        )
      }
      state.References = append(state.References, referenceState)
    }
    states = append(states, state)
  }
  return states, problems
}

func evaluateEvidenceGraph(
  states []claimState,
  loader *typeScriptLoader,
) []string {
  problems := []string{}
  targets := map[string]map[string]*evidenceUnit{}
  markdownTargets := map[string]map[string]*evidenceUnit{}
  // Scoped targets are keyed by owning file as well as name, which is what
  // makes import-scope resolution unambiguous: two modules exporting `get`
  // never compete, because resolution already knows which file it landed in.
  scopedTargets := map[scopedTargetKey]map[string]*evidenceUnit{}
  // The same two indexes over the units a documentation tag withdrew. A
  // citation that lands here resolved to a real declaration and must be told
  // that the tag is why the target is not evidence; the alternative is an
  // unresolved-target message that sends the author looking for a typo.
  hiddenTargets := map[string]*evidenceUnit{}
  scopedHidden := map[scopedTargetKey]*evidenceUnit{}
  for _, state := range states {
    for _, reference := range state.References {
      for _, unit := range reference.Hidden {
        for _, address := range append([]string{unit.Target}, unit.Aliases...) {
          hiddenTargets[address] = unit
        }
      }
      for _, address := range reference.Published {
        if address.Unit.Hidden == "" {
          continue
        }
        scopedHidden[scopedTargetKey{
          path:   address.Module,
          target: address.Address,
        }] = address.Unit
      }
      if len(reference.Published) == 0 {
        for _, unit := range reference.Hidden {
          for _, address := range append([]string{unit.Target}, unit.Aliases...) {
            scopedHidden[scopedTargetKey{
              path:   unit.Path,
              target: address,
            }] = unit
          }
        }
      }
      // A traversed address is valid in the module that publishes it, not in
      // the one that declares the symbol. Identity still belongs to the
      // declaring file; only reachability moves, and a declaration several
      // selected modules publish is citable from each of them.
      scopeIDs := map[string]bool{}
      for _, unit := range reference.Scopes {
        scopeIDs[unit.ID] = true
      }
      for _, address := range reference.Published {
        if !scopeIDs[address.Unit.ID] {
          continue
        }
        key := scopedTargetKey{path: address.Module, target: address.Address}
        if scopedTargets[key] == nil {
          scopedTargets[key] = map[string]*evidenceUnit{}
        }
        scopedTargets[key][address.Unit.ID] = address.Unit
      }
      for _, unit := range reference.Scopes {
        for _, address := range append([]string{unit.Target}, unit.Aliases...) {
          if targets[address] == nil {
            targets[address] = map[string]*evidenceUnit{}
          }
          targets[address][unit.ID] = unit
        }
        if unit.Type == artifactMarkdown {
          if markdownTargets[unit.Target] == nil {
            markdownTargets[unit.Target] = map[string]*evidenceUnit{}
          }
          markdownTargets[unit.Target][unit.ID] = unit
        }
        // A population whose addresses came from traversal already indexed
        // every module that publishes this unit. Only a population addressed
        // by its declaring files needs this fallback.
        if unit.Type == artifactTypeScript && len(reference.Published) == 0 {
          for _, address := range append([]string{unit.Target}, unit.Aliases...) {
            key := scopedTargetKey{path: unit.Path, target: address}
            if scopedTargets[key] == nil {
              scopedTargets[key] = map[string]*evidenceUnit{}
            }
            scopedTargets[key][unit.ID] = unit
          }
        }
      }
    }
  }

  declarations := map[string]*evidenceDeclaration{}
  owners := map[string][]claimState{}
  for _, state := range states {
    for _, declaration := range state.Declarations {
      declarations[declaration.ID] = declaration
      seen := false
      for _, owner := range owners[declaration.ID] {
        if owner.Spec.Index == state.Spec.Index {
          seen = true
          break
        }
      }
      if !seen {
        owners[declaration.ID] = append(owners[declaration.ID], state)
      }
    }
  }
  declarationIDs := make([]string, 0, len(declarations))
  for id := range declarations {
    declarationIDs = append(declarationIDs, id)
  }
  sort.Strings(declarationIDs)

  resolved := map[string]string{}
  for _, id := range declarationIDs {
    declaration := declarations[id]
    context := declarationObligationContext(owners[id])
    if !declaration.valid() {
      problems = append(
        problems,
        "Malformed @"+string(declaration.Tag)+" declaration at "+declaration.location()+" for "+context+": target and non-empty reason are mandatory. Write '@"+string(declaration.Tag)+" <target> <reason>'.",
      )
      continue
    }
    if isInlineLinkTarget(declaration.Target) {
      unitID, problem := resolveInlineLinkDeclaration(
        declaration,
        loader,
        scopedTargets,
        scopedHidden,
        context,
      )
      if problem != "" {
        problems = append(problems, problem)
        continue
      }
      resolved[id] = unitID
      continue
    }
    if declaration.Type == artifactTypeScript &&
      looksLikeTypeScriptTarget(declaration.Target, targets, markdownTargets) {
      problems = append(
        problems,
        "Unbraced TypeScript evidence target '"+declaration.Target+"' at "+declaration.location()+" for "+context+": a target naming a symbol is now written as an inline link, so the citing module's import is what resolves it. Write '@"+string(declaration.Tag)+" {@link "+declaration.Target+"} <reason>' and import the symbol; 'import type' is enough.",
      )
      continue
    }
    candidates := declarationCandidates(declaration.Target, targets, markdownTargets)
    // The configuration guard refuses a code population to a claim that
    // cannot address one, but the address map is built from every claim at
    // once — so a Markdown claim could still land on a symbol materialized
    // by some *other* claim's TypeScript reference. Measured: it resolved
    // silently, which left repository-wide name uniqueness load-bearing
    // through a door the guard does not cover. Closing it here rather than
    // by scoping the whole map keeps resolution global for the artifacts
    // that are addressed by path, where a shared map costs nothing.
    if declaration.Type != artifactTypeScript {
      addressable, code := splitCodeCandidates(candidates)
      if len(addressable) == 0 && len(code) != 0 {
        problems = append(
          problems,
          "Code evidence target '"+declaration.Target+"' at "+declaration.location()+" for "+context+": a "+string(declaration.Type)+" claim cannot cite a TypeScript symbol, because a symbol citation resolves through the citing module's imports and this artifact has none. Invert the obligation so the code cites this artifact, or move the citation into TypeScript.",
        )
        continue
      }
      candidates = addressable
    }
    switch len(candidates) {
    case 0:
      // A failed reference population may contain the declaration's target;
      // absence from the partial address map proves nothing until that
      // population is healthy again. Its loader diagnostic already names
      // the repair boundary, so an unresolved-target diagnostic here would
      // be a derivative false claim.
      if declarationResolutionUncertain(owners[id]) {
        continue
      }
      if hidden := hiddenTargets[declaration.Target]; hidden != nil {
        problems = append(
          problems,
          hiddenTargetProblem(declaration, hidden, context),
        )
        continue
      }
      problems = append(
        problems,
        "Unresolved evidence target '"+declaration.Target+"' at "+declaration.location()+" for "+context+": no configured source materializes that evidence unit. Correct the target, or make one of the named references select the source unit this claim actually uses.",
      )
    case 1:
      for unitID := range candidates {
        resolved[id] = unitID
      }
    default:
      descriptions := make([]string, 0, len(candidates))
      for _, unit := range candidates {
        descriptions = append(descriptions, unit.Readable+" at "+unit.location())
      }
      sort.Strings(descriptions)
      problems = append(
        problems,
        "Ambiguous evidence target '"+declaration.Target+"' at "+declaration.location()+" for "+context+": it matches "+strings.Join(descriptions, "; ")+". Rename or qualify the source symbols so the target has exactly one meaning.",
      )
    }
  }

  participates := map[string]bool{}
  uncertain := map[string]bool{}
  outOfScope := map[string][]string{}
  outOfScopeSelections := map[string]symbolSet{}
  // An exclusion outside its claim's declared carriers is a placement
  // finding, not a host-kind one, so it carries its own obligations and the
  // carrier globs its message must name.
  outsideCarrier := map[string][]string{}
  outsideCarrierGlobs := map[string]string{}
  for _, state := range states {
    if len(state.Paths) == 0 {
      continue
    }
    if !state.Healthy {
      for _, declaration := range state.Declarations {
        uncertain[declaration.ID] = true
      }
    }
    // One ledger per claim, because reviews belong to the claim rather than to
    // any one of its references, and built on first use so a claim with no
    // reviewing reference pays nothing.
    var reviewLedgerForClaim *reviewLedger
    for _, reference := range state.References {
      if !reference.Healthy {
        for _, declaration := range state.Declarations {
          uncertain[declaration.ID] = true
        }
      }
      single := reference.Spec.Policy.SingleEvidencePerSymbol
      unique := reference.Spec.Policy.UniqueEvidence
      // An empty population owes nothing and normally ends the reference
      // here. A healthy empty one still judges hosts under
      // singleEvidencePerSymbol, because every selected host then truthfully
      // cites zero units rather than the one it owes.
      if len(reference.Units) == 0 &&
        (!single || !state.Healthy || !reference.Healthy || len(reference.Paths) == 0) {
        continue
      }
      acknowledged := map[string]bool{}
      evidenceByUnit := map[string]*evidenceDeclaration{}
      exclusionByUnit := map[string]*evidenceDeclaration{}
      evidenceByHostAndScope := map[string]map[string]*evidenceDeclaration{}
      selectedHosts := map[string]*evidenceUnit{}
      evidenceUnitsByHost := map[string]map[string]bool{}
      if single || unique {
        for _, host := range state.Hosts {
          selectedHosts[host.ID] = host
          if single {
            evidenceUnitsByHost[host.ID] = map[string]bool{}
          }
        }
      }
      evidenceHostsByUnit := map[string]map[string]bool{}
      if unique {
        for _, unit := range reference.Units {
          evidenceHostsByUnit[unit.ID] = map[string]bool{}
        }
      }
      scopesByID := map[string]*evidenceUnit{}
      for _, scope := range reference.Scopes {
        scopesByID[scope.ID] = scope
      }
      // Built on first use and shared by every citation of this reference. The
      // index spans the whole materialized population, so building it per
      // citation is quadratic, and nil until a citation actually needs it so a
      // reference without the policy pays nothing.
      var reviewScopes *scopeIndex
      for _, declaration := range state.Declarations {
        scopeID := resolved[declaration.ID]
        covered := reference.UnitsByScope[scopeID]
        if len(covered) == 0 {
          continue
        }
        if declaration.Tag == tagExclude && state.OutsideCarrier[declaration.ID] {
          outsideCarrier[declaration.ID] = appendUniqueString(
            outsideCarrier[declaration.ID],
            claimLabel(state.Spec)+" "+referenceLabel(reference.Spec),
          )
          outsideCarrierGlobs[declaration.ID] = describePopulation(state.Spec.Base, state.Spec.ExclusionCarriers)
          continue
        }
        if !declarationEligibleForClaim(declaration, state.Spec) {
          outOfScope[declaration.ID] = appendUniqueString(
            outOfScope[declaration.ID],
            claimLabel(state.Spec)+" "+referenceLabel(reference.Spec),
          )
          if outOfScopeSelections[declaration.ID] == nil {
            outOfScopeSelections[declaration.ID] = symbolSet{}
          }
          for symbol := range state.Spec.Symbols {
            outOfScopeSelections[declaration.ID][symbol] = true
          }
          continue
        }
        // Physical file ownership, resolved reference scope, and host
        // eligibility decide which overlapping claims this declaration
        // belongs to. A declaration may participate in several eligible
        // obligations, but an ineligible overlap must not reject one
        // already owned elsewhere.
        participates[declaration.ID] = true
        if !state.Healthy || !reference.Healthy {
          continue
        }
        if declaration.Tag == tagExclude && reference.Spec.Policy.NoExclude {
          problems = append(
            problems,
            "Forbidden @evidenceExclude for '"+scopesByID[scopeID].Target+"' at "+declaration.location()+" in "+claimLabel(state.Spec)+" "+referenceLabel(reference.Spec)+": noEvidenceExclude requires positive @evidence for this reference. Remove the exclusion and cite the target from a selected "+string(state.Spec.Type)+" host.",
          )
          continue
        }
        if reference.Spec.Policy.RequireReview {
          if reviewScopes == nil {
            // Withdrawn units are absent from Population by construction, and
            // the scope composite still needs their identities so a member
            // leaving the public surface moves the fingerprint.
            reviewScopes = newScopeIndex(
              append(
                append([]*evidenceUnit{}, reference.Population...),
                reference.Hidden...,
              ),
            )
          }
          if reviewLedgerForClaim == nil {
            reviewLedgerForClaim = newReviewLedger(state.Reviews)
          }
          problems = append(problems, reviewProblems(
            declaration,
            scopesByID[scopeID],
            reference,
            state,
            reviewScopes,
            reviewLedgerForClaim,
          )...)
        }
        if declaration.Tag == tagEvidence && declaration.HostID != "" {
          byScope := evidenceByHostAndScope[declaration.HostID]
          if byScope == nil {
            byScope = map[string]*evidenceDeclaration{}
            evidenceByHostAndScope[declaration.HostID] = byScope
          }
          if first := byScope[scopeID]; first != nil {
            problems = append(
              problems,
              "Duplicate @evidence for '"+scopesByID[scopeID].Target+"' on the same host at "+declaration.location()+"; first declared at "+first.location()+".",
            )
          } else {
            byScope[scopeID] = declaration
          }
        }
        if declaration.Tag == tagEvidence && (single || unique) {
          for _, hostID := range declaration.SemanticHostIDs {
            if selectedHosts[hostID] == nil {
              continue
            }
            for _, unit := range covered {
              if single {
                evidenceUnitsByHost[hostID][unit.ID] = true
              }
              if !unique {
                continue
              }
              // A covered unit is a selected unit of this reference,
              // so the counter usually exists. Allocating on demand
              // keeps a future scope map that reaches wider from
              // turning a count into a nil-map panic in the compiler.
              hosts := evidenceHostsByUnit[unit.ID]
              if hosts == nil {
                hosts = map[string]bool{}
                evidenceHostsByUnit[unit.ID] = hosts
              }
              hosts[hostID] = true
            }
          }
        }
        var conflictingUnit *evidenceUnit
        var conflictingDeclaration *evidenceDeclaration
        var duplicateExclusionUnit *evidenceUnit
        var firstExclusion *evidenceDeclaration
        for _, unit := range covered {
          acknowledged[unit.ID] = true
          if declaration.Tag == tagEvidence {
            if first := exclusionByUnit[unit.ID]; first != nil && conflictingUnit == nil {
              conflictingUnit = unit
              conflictingDeclaration = first
            }
            if evidenceByUnit[unit.ID] == nil {
              evidenceByUnit[unit.ID] = declaration
            }
            continue
          }
          if first := evidenceByUnit[unit.ID]; first != nil && conflictingUnit == nil {
            conflictingUnit = unit
            conflictingDeclaration = first
          }
          if first := exclusionByUnit[unit.ID]; first != nil {
            if duplicateExclusionUnit == nil {
              duplicateExclusionUnit = unit
              firstExclusion = first
            }
            continue
          }
          exclusionByUnit[unit.ID] = declaration
        }
        if conflictingUnit != nil {
          evidence := declaration
          exclusion := conflictingDeclaration
          if declaration.Tag == tagExclude {
            evidence = conflictingDeclaration
            exclusion = declaration
          }
          problems = append(
            problems,
            "Conflicting acknowledgements for '"+conflictingUnit.Target+"' in "+claimLabel(state.Spec)+" "+referenceLabel(reference.Spec)+": @evidence at "+evidence.location()+" overlaps @evidenceExclude at "+exclusion.location()+".",
          )
        }
        if duplicateExclusionUnit != nil {
          problems = append(
            problems,
            "Duplicate @evidenceExclude for '"+duplicateExclusionUnit.Target+"' in "+claimLabel(state.Spec)+" "+referenceLabel(reference.Spec)+": exclusion at "+declaration.location()+" overlaps exclusion at "+firstExclusion.location()+".",
          )
        }
      }
      if !state.Healthy || !reference.Healthy || len(reference.Paths) == 0 {
        continue
      }
      if single {
        for _, host := range state.Hosts {
          count := len(evidenceUnitsByHost[host.ID])
          if count == 1 {
            continue
          }
          problems = append(
            problems,
            "Evidence host "+host.Readable+" at "+host.location()+" in "+claimLabel(state.Spec)+" "+referenceLabel(reference.Spec)+" cites "+decimal(count)+" distinct selected evidence unit(s); singleEvidencePerSymbol requires exactly 1. Keep positive @evidence citations on this semantic host to exactly one distinct unit.",
          )
        }
      }
      for _, unit := range reference.Units {
        if !acknowledged[unit.ID] {
          repair := "Use @evidence on a selected " + string(state.Spec.Type) + " host or @evidenceExclude on an eligible carrier."
          if reference.Spec.Policy.NoExclude {
            repair = "Use @evidence on a selected " + string(state.Spec.Type) + " host; this reference forbids @evidenceExclude."
          }
          problems = append(
            problems,
            "Missing acknowledgement for '"+unit.Target+"' ("+unit.Readable+" at "+unit.location()+") in "+claimLabel(state.Spec)+" "+referenceLabel(reference.Spec)+". "+repair,
          )
        }
        hostCount := len(evidenceHostsByUnit[unit.ID])
        if !unique || hostCount <= 1 {
          continue
        }
        problems = append(
          problems,
          "Evidence unit '"+unit.Target+"' ("+unit.Readable+" at "+unit.location()+") in "+claimLabel(state.Spec)+" "+referenceLabel(reference.Spec)+" has "+decimal(hostCount)+" distinct positive evidence host(s); uniqueEvidence allows at most 1. Keep the one selected "+string(state.Spec.Type)+" host that owns this unit and remove the other citation(s).",
        )
      }
    }
  }
  for _, id := range declarationIDs {
    if resolved[id] == "" || participates[id] {
      continue
    }
    declaration := declarations[id]
    context := declarationObligationContext(owners[id])
    if obligations := outsideCarrier[id]; len(obligations) != 0 {
      problems = append(
        problems,
        "Misplaced @evidenceExclude at "+declaration.location()+" for "+strings.Join(obligations, "; ")+", target '"+displayTarget(declaration.Target)+"': evidenceExcludeCarriers confines this claim's exclusions to "+outsideCarrierGlobs[id]+". Move the tag there, or delete it and implement the target this claim owes.",
      )
      continue
    }
    if obligations := outOfScope[id]; len(obligations) != 0 {
      host := declaration.Hosts.names()
      if len(declaration.Hosts) == 0 {
        host = "unsupported or non-exported declaration"
      }
      if declaration.Tag == tagExclude {
        problems = append(
          problems,
          "Out-of-scope @evidenceExclude carrier at "+declaration.location()+" for "+strings.Join(obligations, "; ")+", target '"+displayTarget(declaration.Target)+"': '"+host+"' is not an eligible exclusion carrier in these matching claim files. Move the exclusion to a supported public export or selected declaration host, or use a top-level unattached Prisma documentation comment.",
        )
        continue
      }
      problems = append(
        problems,
        "Out-of-scope @"+string(declaration.Tag)+" host at "+declaration.location()+" for "+strings.Join(obligations, "; ")+", target '"+displayTarget(declaration.Target)+"': host kind '"+host+"' is not selected ("+outOfScopeSelections[id].names()+") by any of these claim obligations. Move the declaration to a selected host, or widen only the claim symbol selector that genuinely owns this target.",
      )
      continue
    }
    if uncertain[id] {
      // A failed loader makes non-participation unknowable. Its direct
      // diagnostic is the repair path; adding a ghost finding here would
      // derive a second claim from an incomplete graph.
      continue
    }
    problems = append(
      problems,
      "Non-participating @"+string(declaration.Tag)+" target '"+displayTarget(declaration.Target)+"' at "+declaration.location()+" for "+context+": the target resolves, but none of this declaration's configured references selects it. Correct the target or reference, or move the tag to an eligible host or exclusion carrier in the claim that owes it; a resolving tag must discharge at least one obligation.",
    )
  }
  return problems
}

// reviewProblems judges one acknowledgement against the review it owes.
//
// The review is found by host and target rather than resolved again. A citation
// and its review spell one address, so resolving the review separately would let
// it answer a scope its citation does not name, and would report an unresolved
// target for a tag whose only job is to annotate one that already resolved.
//
// Three states are reported and they are mutually exclusive, because each repair
// subsumes the one after it: without a review there is nothing to carry a
// fingerprint, and without a fingerprint there is nothing to compare. Every
// message states the expected value, because completions cannot: the host
// publishes a rule's corpus only on a cycle where the rule reports nothing, and
// a stale fingerprint is a report.
//
// An empty expected value means this population's loader reported no content
// for the cited scope. Every bridge digests what it parsed, so that is a loader
// gap rather than a configuration one, and reporting a mismatch against nothing
// would name a repair no author can perform. It is silence by design and the
// only silence here: a bridge that fails reports its own failure, and an
// unhealthy population is skipped before this runs.
func reviewProblems(
  declaration *evidenceDeclaration,
  scope *evidenceUnit,
  reference referenceState,
  state claimState,
  scopes *scopeIndex,
  reviews *reviewLedger,
) []string {
  if declaration == nil || scope == nil {
    return nil
  }
  // The complete population is what the digest walks, never Units or Scopes.
  // Both of those are narrowed by this reference's `symbol` selector, so an
  // unselected descendant is absent from each: a Markdown reference selecting
  // only `h2` would fingerprint a cited section without the H3 bodies inside it,
  // and a review of it would never expire however much of that subtree was
  // rewritten. Worse, two references over one scope under different selectors
  // would then expect two different digests from a tag that carries exactly one
  // fingerprint token, and no value an author could write would satisfy both.
  expected := scopes.fingerprint(scope.ID)
  if expected == "" {
    return nil
  }
  where := " at " + declaration.location() + " in " +
    claimLabel(state.Spec) + " " + referenceLabel(reference.Spec)
  // Every message names the review tag that answers for *this* acknowledgement.
  // A generic `@evidenceReview` in the repair would send the author of an
  // exclusion to write the tag that does not answer it, which is the one mistake
  // the split into two tags exists to prevent.
  marker := reviewMarkerFor(declaration.Tag)
  review := reviews.find(declaration)
  if review == nil {
    return []string{
      "Unreviewed @" + string(declaration.Tag) + " for '" + displayTarget(declaration.Target) + "'" + where +
        ": requireReview asks what was verified, which the reason does not answer. Add '" + marker + " " +
        displayTarget(declaration.Target) + " #" + expected + " <what you checked>' to the same documentation block.",
    }
  }
  if review.Fingerprint == "" {
    return []string{
      "Unfingerprinted " + marker + " for '" + displayTarget(declaration.Target) + "'" + where +
        ": the review states what was checked and nothing binds it to what it checked, so it can never expire. Write '" +
        marker + " " + displayTarget(declaration.Target) + " #" + expected + " " + firstReviewWords(review.Description) + "'.",
    }
  }
  if review.Fingerprint != expected {
    return []string{
      "Stale " + marker + " for '" + displayTarget(declaration.Target) + "'" + where +
        ": the review names '#" + review.Fingerprint + "' and that scope now digests to '#" + expected +
        "'. The cited content changed after this review was written. Read it again and replace the review, including the new fingerprint.",
    }
  }
  return nil
}

// reviewLedger indexes a claim's reviews by the identity they were written on.
//
// Two properties are load-bearing and neither is obvious.
//
// The key is a *semantic* host identity, never `HostID`. `HostID` is a source
// position, so the two halves of a merged identity carry different ones: keying on
// it refused a review written on `namespace I` for a citation on `interface I`,
// which is placement the graph elsewhere calls not worth a diagnostic and which
// `evidence/review` accepts. The two rules then disagreed about the same file.
// `model.go` says as much where it defines the field.
//
// It is built once per claim rather than scanned per citation. A linear search
// over every review, for every declaration, for every reference, is cubic in the
// three things a large project has most of.
type reviewLedger struct {
  byHostAndTarget map[string]*evidenceReview
}

func newReviewLedger(reviews []*evidenceReview) *reviewLedger {
  ledger := &reviewLedger{
    byHostAndTarget: make(map[string]*evidenceReview, len(reviews)),
  }
  for _, review := range reviews {
    if review == nil {
      continue
    }
    for _, hostID := range reviewLedgerHostIDs(review) {
      key := reviewLedgerKey(hostID, review.Reviews, review.Target)
      if ledger.byHostAndTarget[key] == nil {
        ledger.byHostAndTarget[key] = review
      }
    }
  }
  return ledger
}

// reviewLedgerHostIDs is every identity a review answers on.
//
// The position identity is kept as a fallback for a carrier that has no semantic
// host at all, such as an unattached Prisma documentation run, whose declarations
// are keyed the same way.
func reviewLedgerHostIDs(review *evidenceReview) []string {
  if len(review.SemanticHostIDs) != 0 {
    return review.SemanticHostIDs
  }
  if review.HostID == "" {
    return nil
  }
  return []string{review.HostID}
}

// find locates the review bound to one declaration's identity and target.
func (ledger *reviewLedger) find(
  declaration *evidenceDeclaration,
) *evidenceReview {
  if ledger == nil {
    return nil
  }
  hostIDs := declaration.SemanticHostIDs
  if len(hostIDs) == 0 && declaration.HostID != "" {
    hostIDs = []string{declaration.HostID}
  }
  for _, hostID := range hostIDs {
    key := reviewLedgerKey(hostID, declaration.Tag, declaration.Target)
    if review := ledger.byHostAndTarget[key]; review != nil {
      return review
    }
  }
  return nil
}

// reviewLedgerKey composes the one key both sides of the ledger use.
//
// Spelled once rather than at each site. The acknowledgement kind is part of it,
// because verifying a citation and verifying an exclusion are opposite questions
// and a review of one must never be found for the other; two independent
// three-part spellings would agree only by inspection, and the day they stop
// agreeing every review silently stops matching.
func reviewLedgerKey(hostID string, tag tagKind, target string) string {
  return hostID + "\x00" + reviewKey(tag, target)
}

// firstReviewWords echoes enough of a description to show where it goes.
func firstReviewWords(description string) string {
  words := strings.Fields(description)
  if len(words) == 0 {
    return "<what you checked>"
  }
  if len(words) > 6 {
    words = append(words[:6], "...")
  }
  return strings.Join(words, " ")
}

// declarationEligibleForClaim keeps ownership evidence on the selected host
// while allowing an intentional exclusion to live on a claim-file carrier.
func declarationEligibleForClaim(
  declaration *evidenceDeclaration,
  claim claimSpec,
) bool {
  if claim.Symbols.intersects(declaration.Hosts) {
    return true
  }
  return declaration.Tag == tagExclude && declaration.ExclusionCarrier
}

// hiddenTargetProblem names the documentation tag that withdrew a cited
// declaration.
//
// The repair is the author's either way, and which repair is right depends on
// which of the two statements is wrong — the tag or the citation — so the
// message states both rather than choosing.
func hiddenTargetProblem(
  declaration *evidenceDeclaration,
  hidden *evidenceUnit,
  context string,
) string {
  return "Hidden evidence target '" + displayTarget(declaration.Target) + "' at " + declaration.location() + " for " + context + ": " + hidden.Readable + " at " + hidden.location() + " carries '" + hidden.Hidden + "' in its documentation comment, which withdraws it from the evidence population along with everything nested inside it. Remove the tag if the declaration is public contract, or drop this citation if it is not."
}

func declarationResolutionUncertain(owners []claimState) bool {
  for _, owner := range owners {
    for _, reference := range owner.References {
      if !reference.Healthy {
        return true
      }
    }
  }
  return false
}

// materializeEntryReference builds a population by walking an entry module's
// export graph rather than by matching paths.
//
// The entry is what a consumer can actually import, so the population is the
// public contract instead of whatever files a glob happened to sweep in. It is
// also the only selection that can reach a package symbol nothing imports,
// because such a symbol is absent from the Program by definition.
func materializeEntryReference(
  claim claimSpec,
  reference referenceSpec,
  loader *typeScriptLoader,
) (referenceState, []string) {
  state := referenceState{
    Spec:         reference,
    UnitsByScope: map[string][]*evidenceUnit{},
    Healthy:      true,
  }
  entry, problem := resolveReferenceEntry(claim, reference, loader)
  if problem != "" {
    return state, []string{problem}
  }
  state.Paths = []string{entry}
  population := materializeEntryUnits(loader, []string{entry}, reference.Symbols)
  state.Units = population.Units
  state.Hidden = population.Hidden
  state.Published = population.Published
  if failure := loader.failure(entry); failure != "" {
    state.Healthy = false
    return state, []string{
      claimLabel(claim) + " " + referenceLabel(reference) + " could not read TypeScript entry '" + entry + "': " + failure + ". Fix filesystem access or the package installation; coverage cannot be evaluated from a partial entry graph.",
    }
  }
  if len(state.Units) == 0 {
    return state, []string{
      claimLabel(claim) + " " + referenceLabel(reference) + " reached no selected evidence units (" + reference.Symbols.names() + ") from entry '" + entry + "'. Select symbol kinds the entry exposes, or point the entry at the module that declares them.",
    }
  }
  applyTraversedScopes(&state, population.Reached)
  return state, nil
}

// applyTraversedScopes gives a traversed population its containment closure.
//
// Containment follows the declaration hierarchy rather than the address text. A
// type and a callable may share one public name, so treating a common address
// prefix as ownership would make an unrelated same-name declaration an ancestor
// and turn every citation of that name ambiguous. Every reached declaration
// takes part, which keeps an unselected ancestor addressable as the aggregate
// scope of its selected descendants.
func applyTraversedScopes(state *referenceState, reached []*evidenceUnit) {
  sortUnits(state.Units)
  available := map[string]*evidenceUnit{}
  for _, unit := range reached {
    available[unit.ID] = unit
  }
  scopesByID := map[string]*evidenceUnit{}
  for _, unit := range state.Units {
    for scope := unit; scope != nil; scope = available[scope.ParentID] {
      state.UnitsByScope[scope.ID] = append(state.UnitsByScope[scope.ID], unit)
      if scopesByID[scope.ID] == nil {
        scopesByID[scope.ID] = scope
        state.Scopes = append(state.Scopes, scope)
      }
      if scope.ParentID == "" {
        break
      }
    }
  }
  sortUnits(state.Scopes)
  // Every reached declaration, selected or not, so a review fingerprint over a
  // cited scope walks the structure rather than this reference's selection.
  state.Population = append(state.Population, reached...)
  sortUnits(state.Population)
}

// materializeLocalTypeScriptReference selects modules of the active project
// with globs and takes the population from what those modules publish.
//
// A glob names modules, while an obligation is owed by symbols. So a matched
// module contributes its own exports and everything it re-exports: a barrel is
// selected for the surface it presents, and pulling that surface apart into
// whichever files happen to declare it would make the same population depend on
// how the sources are laid out.
func materializeLocalTypeScriptReference(
  claim claimSpec,
  reference referenceSpec,
  inventories map[string]*artifactInventory,
  loader *typeScriptLoader,
) (referenceState, []string) {
  paths := matchingReferencePaths(inventories, reference)
  state := referenceState{
    Spec:         reference,
    Paths:        paths,
    UnitsByScope: map[string][]*evidenceUnit{},
    Healthy:      populationIsHealthy(inventories, reference.Base, paths),
  }
  if len(paths) == 0 {
    if !state.Healthy {
      return state, nil
    }
    return state, []string{
      claimLabel(claim) + " " + referenceLabel(reference) + " matched no typescript files for " + describePopulation(reference.Base, reference.Files) + ". Fix the reference globs or the root they resolve against; this obligation cannot materialize evidence units without files.",
    }
  }
  selectedInventoryProblem := false
  for _, path := range paths {
    for _, inventoryProblem := range inventories[path].Problems {
      if inventoryProblem.Symbol == "*" ||
        reference.Symbols.contains(inventoryProblem.Symbol) {
        selectedInventoryProblem = true
      }
    }
  }
  population := materializeEntryUnits(loader, paths, reference.Symbols)
  state.Units = population.Units
  state.Hidden = population.Hidden
  state.Published = population.Published
  applyTraversedScopes(&state, population.Reached)
  if !state.Healthy {
    return state, nil
  }
  if len(state.Units) == 0 && !selectedInventoryProblem {
    return state, []string{
      claimLabel(claim) + " " + referenceLabel(reference) + " matched " + decimal(len(paths)) + " file(s) but materialized no selected evidence units (" + reference.Symbols.names() + "). Select symbol kinds present in those files or correct the reference globs.",
    }
  }
  return state, nil
}

// materializePackageGlobReference narrows an installed package with globs that
// resolve against the package root.
//
// Narrowing a large SDK to one area is what makes the obligation adoptable at
// all. The globs are written as a consumer thinks of the package — `lib/api/**`
// — rather than carrying the `node_modules` prefix, which is an installation
// detail rather than part of the package's shape.
//
// A matched module is an entry, not a leaf: its own exports and everything it
// re-exports both belong to the population, because a glob selects modules
// while an obligation is owed by the symbols those modules publish.
func materializePackageGlobReference(
  claim claimSpec,
  reference referenceSpec,
  loader *typeScriptLoader,
) (referenceState, []string) {
  state := referenceState{
    Spec:         reference,
    UnitsByScope: map[string][]*evidenceUnit{},
    Healthy:      true,
  }
  base := referenceBase(loader, reference)
  candidates, walkProblem := loader.walk(base)
  if walkProblem != "" {
    state.Healthy = false
    return state, []string{
      claimLabel(claim) + " " + referenceLabel(reference) + " could not inspect TypeScript package '" + reference.Package + "': " + walkProblem + ". Fix filesystem access or reinstall the package; coverage cannot be evaluated from a partial population.",
    }
  }
  problems := []string{}
  for _, candidate := range candidates {
    relative := strings.TrimPrefix(strings.TrimPrefix(candidate, base), "/")
    if !reference.Files.matches(relative) {
      continue
    }
    if loader.inventory(candidate) == nil {
      state.Healthy = false
      problems = append(
        problems,
        claimLabel(claim)+" "+referenceLabel(reference)+" could not read TypeScript source '"+candidate+"': "+loader.failure(candidate)+". Fix filesystem access or reinstall the package; coverage cannot be evaluated from a partial population.",
      )
      continue
    }
    state.Paths = append(state.Paths, candidate)
  }
  if len(state.Paths) == 0 {
    if !state.Healthy {
      return state, problems
    }
    return state, []string{
      claimLabel(claim) + " " + referenceLabel(reference) + " matched no files inside package '" + reference.Package + "' for " + describePatterns(reference.Files) + ". The globs resolve against the package root, not the project root. Check that the installed package actually contains those paths before changing the reference: an empty population demands nothing, so a claim that reaches this state reports full coverage while checking nothing.",
    }
  }
  // The glob decides membership, the entry decides addresses. A matched module
  // is still traversed as an entry, because a matched barrel owes what it
  // publishes rather than only what its own file declares — but that traversal
  // is used for nothing except which units are in. Their addresses come from
  // the package entry, which is the only module a consumer has a specifier
  // for, and it is under that specifier that an inline link is resolved.
  // Publishing a narrowed unit under the matched module instead is what made
  // `functional.health.get` collapse to `get` and left it with no spelling
  // that resolves.
  membership := materializeEntryUnits(loader, state.Paths, reference.Symbols)
  population := membership
  if entry := loader.packageEntryModule(reference.Package); entry != "" {
    population = narrowTraversedPopulation(
      materializeEntryUnits(loader, []string{entry}, reference.Symbols),
      membership,
    )
  }
  state.Units = population.Units
  state.Hidden = population.Hidden
  state.Published = population.Published
  applyTraversedScopes(&state, population.Reached)
  if !state.Healthy {
    return state, problems
  }
  if len(state.Units) == 0 {
    return state, []string{
      claimLabel(claim) + " " + referenceLabel(reference) + " matched " + decimal(len(state.Paths)) + " file(s) inside package '" + reference.Package + "' but materialized no selected evidence units (" + reference.Symbols.names() + ") reachable from the package entry. Select symbol kinds present in those files, correct the globs, or narrow to modules the entry publishes.",
    }
  }
  return state, nil
}

func resolveReferenceEntry(
  claim claimSpec,
  reference referenceSpec,
  loader *typeScriptLoader,
) (string, string) {
  entry := loader.packageEntryModule(reference.Package)
  if entry == "" {
    return "", claimLabel(claim) + " " + referenceLabel(reference) + " could not resolve the declaration entry of package '" + reference.Package + "'. Install it, or select its declarations with 'files'; the entry is read from the 'types' condition of 'exports', then 'typesVersions', then 'types'."
  }
  return entry, ""
}

// scopedTargetKey identifies one address inside one module.
//
// A struct key rather than a joined string: the map is built once per unit per
// reference and read once per citation, and concatenating two paths to hash
// them allocates a string whose only purpose is to be thrown away.
type scopedTargetKey struct {
  path   string
  target string
}

// looksLikeTypeScriptTarget reports whether an unbraced target names a symbol.
//
// The migration diagnostic has to be told apart from an ordinary typo, and the
// signal is that the same spelling still materializes as a TypeScript unit
// somewhere in the configured graph. A Markdown path or a Swagger operation
// never does, so neither is mistaken for a symbol that lost its braces.
func looksLikeTypeScriptTarget(
  target string,
  targets map[string]map[string]*evidenceUnit,
  markdownTargets map[string]map[string]*evidenceUnit,
) bool {
  if len(markdownTargets[target]) != 0 {
    return false
  }
  for _, unit := range targets[target] {
    if unit.Type == artifactTypeScript {
      return true
    }
  }
  return false
}

// resolveInlineLinkDeclaration resolves a braced target through the citing
// module's imports, the way TypeScript resolves the same name.
//
// Every failure gets its own diagnostic. A single "unresolved" would leave the
// author guessing which of four independent things went wrong, and three of
// them are repaired in completely different places.
func resolveInlineLinkDeclaration(
  declaration *evidenceDeclaration,
  loader *typeScriptLoader,
  scopedTargets map[scopedTargetKey]map[string]*evidenceUnit,
  scopedHidden map[scopedTargetKey]*evidenceUnit,
  context string,
) (string, string) {
  target := inlineLinkTarget(declaration.Target)
  if declaration.Type != artifactTypeScript {
    return "", "Inline link target '" + displayTarget(declaration.Target) + "' at " + declaration.location() + " for " + context + ": only a TypeScript declaration can cite through an inline link, because resolution runs through the citing module's imports and a " + string(declaration.Type) + " comment has none. Use a path-addressed target selected by one of the named references; a TypeScript symbol must instead be cited from a TypeScript claim."
  }
  inventory := loader.inventory(declaration.Path)
  if inventory == nil {
    return "", "Inline link target '" + displayTarget(declaration.Target) + "' at " + declaration.location() + " for " + context + ": the citing file is not part of the TypeScript program, so it has no import scope to resolve against. Include the file in the project or move the citation to a configured TypeScript claim file."
  }
  segments := strings.Split(target, ".")
  binding, imported := inventory.Imports[segments[0]]
  if !imported {
    return "", "Unimported evidence target '" + displayTarget(declaration.Target) + "' at " + declaration.location() + " for " + context + ": '" + segments[0] + "' is not imported by this module, so the citation names a symbol this file does not reference. Import it; 'import type' is enough and is erased at emit."
  }
  // Resolution goes through the same loader the population uses, so a citation
  // can reach a package entry that never entered the Program — which is the
  // only way an import of an installed SDK resolves at all.
  resolvedPath := loader.resolve(declaration.Path, binding.Specifier)
  if resolvedPath == "" {
    return "", "Unresolved module '" + binding.Specifier + "' for evidence target '" + displayTarget(declaration.Target) + "' at " + declaration.location() + " for " + context + ": the specifier resolves to no TypeScript file reachable from this project. Correct the import, or make the named reference reach the module."
  }
  remaining := segments[1:]
  if !binding.Namespace {
    remaining = append([]string{binding.Imported}, remaining...)
  }
  if len(remaining) == 0 {
    return "", "Incomplete evidence target '" + displayTarget(declaration.Target) + "' at " + declaration.location() + " for " + context + ": a namespace import names a module rather than a unit. Name a symbol inside '" + binding.Specifier + "' that the named reference selects."
  }
  name := strings.Join(remaining, ".")
  candidates := scopedTargets[scopedTargetKey{path: resolvedPath, target: name}]
  switch len(candidates) {
  case 0:
    if hidden := scopedHidden[scopedTargetKey{
      path:   resolvedPath,
      target: name,
    }]; hidden != nil {
      return "", hiddenTargetProblem(declaration, hidden, context)
    }
    return "", "Unreachable evidence target '" + displayTarget(declaration.Target) + "' at " + declaration.location() + " for " + context + ": '" + resolvedPath + "' declares no selected unit named '" + name + "'. Correct the target, or widen the named reference's files and symbol selection so that unit is configured evidence."
  case 1:
    for _, unit := range candidates {
      return unit.ID, ""
    }
    return "", ""
  default:
    // One module may spell one name in two declaration spaces — a type and a
    // callable, say. Resolution landed in the right file and still cannot say
    // which unit was meant, and picking one silently would acknowledge an
    // obligation the author never cited.
    descriptions := make([]string, 0, len(candidates))
    for _, unit := range candidates {
      descriptions = append(descriptions, unit.Readable+" at "+unit.location())
    }
    sort.Strings(descriptions)
    return "", "Ambiguous evidence target '" + displayTarget(declaration.Target) + "' at " + declaration.location() + " for " + context + ": '" + resolvedPath + "' declares " + strings.Join(descriptions, "; ") + " under that name. Narrow the named reference's symbol selection so the target has exactly one meaning."
  }
}

func declarationCandidates(
  target string,
  targets map[string]map[string]*evidenceUnit,
  markdownTargets map[string]map[string]*evidenceUnit,
) map[string]*evidenceUnit {
  candidates := map[string]*evidenceUnit{}
  for id, unit := range targets[target] {
    candidates[id] = unit
  }
  normalized := normalizeMarkdownTarget(target)
  if normalized != target {
    for id, unit := range markdownTargets[normalized] {
      candidates[id] = unit
    }
  }
  return candidates
}

// splitCodeCandidates separates the units a non-TypeScript claim may address
// from the ones only an inline link can reach.
//
// Both halves are returned because the caller has to tell "this target names
// something else entirely" from "this target names a symbol, and that is the
// problem". Reporting the second as an unresolved target would be true and
// useless: the unit exists, and nothing in the message would say why naming it
// here cannot work.
func splitCodeCandidates(
  candidates map[string]*evidenceUnit,
) (map[string]*evidenceUnit, map[string]*evidenceUnit) {
  addressable := map[string]*evidenceUnit{}
  code := map[string]*evidenceUnit{}
  for id, unit := range candidates {
    if unit.Type == artifactTypeScript {
      code[id] = unit
      continue
    }
    addressable[id] = unit
  }
  return addressable, code
}

func inventoriesOf(
  kind artifactKind,
  markdown map[string]*artifactInventory,
  prisma map[string]*artifactInventory,
  swagger map[string]*artifactInventory,
  typescript map[string]*artifactInventory,
) map[string]*artifactInventory {
  switch kind {
  case artifactMarkdown:
    return markdown
  case artifactPrisma:
    return prisma
  case artifactSwagger:
    return swagger
  case artifactTypeScript:
    return typescript
  default:
    return map[string]*artifactInventory{}
  }
}

func matchingReferencePaths(
  inventories map[string]*artifactInventory,
  reference referenceSpec,
) []string {
  if reference.Type != artifactSwagger {
    return matchingInventoryPaths(inventories, reference.Base, reference.Files)
  }
  if inventories[reference.Source] == nil {
    return nil
  }
  return []string{reference.Source}
}

// matchingInventoryPaths selects the files one population owns.
//
// Matching runs against the base-relative path rather than against the key,
// which is what keeps a pattern written as `requirements/**/*.md` meaning the
// same thing whether its root is the project or a directory two levels above
// it. An address composed for another base is skipped outright, so a file
// loaded for one root is never offered to a population that cannot address it.
func matchingInventoryPaths(
  inventories map[string]*artifactInventory,
  base populationBase,
  globs globSet,
) []string {
  paths := []string{}
  for key := range inventories {
    relative, owned := base.relativeOf(key)
    if !owned || !globs.matches(relative) {
      continue
    }
    paths = append(paths, key)
  }
  sort.Strings(paths)
  return paths
}

func sortUnits(units []*evidenceUnit) {
  sort.Slice(units, func(left int, right int) bool {
    if units[left].Target != units[right].Target {
      return units[left].Target < units[right].Target
    }
    return units[left].ID < units[right].ID
  })
}

func claimLabel(claim claimSpec) string {
  label := "Claim " + decimal(claim.Index+1)
  if claim.Name != "" {
    label += " ('" + claim.Name + "')"
  }
  return label
}

func referenceLabel(reference referenceSpec) string {
  if reference.Type == artifactSwagger {
    return "reference " + decimal(reference.Index+1) + " (swagger operations)"
  }
  return "reference " + decimal(reference.Index+1) + " (" + string(reference.Type) + ", symbols: " + reference.Symbols.names() + ")"
}

func declarationObligationContext(owners []claimState) string {
  groups := make([]string, 0, len(owners))
  for _, owner := range owners {
    references := make([]string, 0, len(owner.Spec.References))
    for _, reference := range owner.Spec.References {
      references = append(references, referenceLabel(reference))
    }
    if len(references) == 0 {
      groups = append(groups, claimLabel(owner.Spec))
      continue
    }
    groups = append(
      groups,
      claimLabel(owner.Spec)+" across "+strings.Join(references, ", "),
    )
  }
  if len(groups) == 0 {
    return "no matched claim"
  }
  return strings.Join(groups, "; ")
}

func appendUniqueString(values []string, candidate string) []string {
  for _, value := range values {
    if value == candidate {
      return values
    }
  }
  return append(values, candidate)
}

func reportProblems(ctx *rule.ProjectContext, problems []string) {
  sort.Strings(problems)
  previous := ""
  for _, problem := range problems {
    if problem == "" || problem == previous {
      continue
    }
    ctx.Report(problem)
    previous = problem
  }
}

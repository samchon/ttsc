package evidence

import (
  "io/fs"
  "path/filepath"
  "sort"
  "strings"
)

// A rooted reference selects entries from disk and follows their exports only
// inside its declared root. Ordinary imports do not expand the population.
func materializeRootedTypeScriptReference(claim claimSpec, reference referenceSpec, loader *typeScriptLoader) (referenceState, []string) {
  state := referenceState{Spec: reference, Healthy: false, UnitsByScope: map[string][]*evidenceUnit{}}
  context := claimLabel(claim) + " " + referenceLabel(reference)
  base := reference.Base
  if problem := baseDirectoryProblem(base, artifactTypeScript); problem != "" {
    return state, []string{problem}
  }
  from, resolved := resolvedBaseDirectory(base)
  if !resolved {
    return state, []string{unresolvedBaseProblem(base, artifactTypeScript)}
  }
  entries := map[string]bool{}
  problems := []string{}
  err := filepath.WalkDir(from, func(current string, entry fs.DirEntry, walkErr error) error {
    if walkErr != nil {
      return walkErr
    }
    relative, err := filepath.Rel(from, current)
    if err != nil {
      return err
    }
    relative = filepath.ToSlash(relative)
    if entry.IsDir() {
      if relative != "." && (entry.Name() == "node_modules" || !reference.Files.couldMatchDescendant(relative)) {
        return filepath.SkipDir
      }
      return nil
    }
    if isTypeScriptPath(relative) && reference.Files.matches(relative) {
      entries[loader.projectPath(base.display(relative))] = true
    }
    return nil
  })
  if err != nil {
    problems = append(problems, context+" could not list TypeScript root '"+populationRootLabel(base)+"': "+causeText(err)+". Restore filesystem access before evaluating coverage.")
  }
  // An open Program snapshot can precede its first save. It is authoritative
  // on the same terms as an edited file that already exists on disk.
  for module := range loader.program {
    relative, ok := relativeProjectPath(base.Absolute, resolveProjectPath(loader.root, module))
    if ok && reference.Files.matches(relative) {
      entries[module] = true
    }
  }
  for entry := range entries {
    state.Paths = append(state.Paths, entry)
  }
  sort.Strings(state.Paths)
  confined := *loader
  confined.boundary = &base
  confined.resolved = map[string]string{}
  confined.failures = map[string]string{}
  population := materializeEntryUnits(&confined, state.Paths, reference.Symbols)
  state.Units, state.Hidden, state.Published = population.Units, population.Hidden, population.Published
  applyTraversedScopes(&state, population.Reached)
  failed := []string{}
  for module := range confined.failures {
    failed = append(failed, module)
  }
  sort.Strings(failed)
  for _, module := range failed {
    problems = append(problems, context+" could not load TypeScript module '"+module+"': "+confined.failures[module]+". Repair the export or explicitly select a root containing its implementation.")
  }
  state.Healthy = len(problems) == 0
  if !state.Healthy {
    return state, problems
  }
  if len(state.Paths) == 0 {
    return state, []string{context + " matched no typescript files for " + describePopulation(base, reference.Files) + ". Correct the configured root and files."}
  }
  if len(state.Units) == 0 {
    return state, []string{context + " found no selected evidence units (" + reference.Symbols.names() + "). Select symbol kinds present in its exported declarations."}
  }
  return state, nil
}

func (loader *typeScriptLoader) withinBoundary(module string) bool {
  if loader.boundary == nil {
    return true
  }
  relative, ok := relativeProjectPath(loader.boundary.Absolute, resolveProjectPath(loader.root, module))
  if !ok || strings.Contains("/"+relative+"/", "/node_modules/") {
    return false
  }
  return true
}

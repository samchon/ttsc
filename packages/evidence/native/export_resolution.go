package evidence

import (
  "sort"
  "strings"
)

// Export names are finite even when modules re-export each other. Discover
// that vocabulary before resolving bindings, and expand namespace paths only
// after a binding is known. A module recursion guard cannot answer whether a
// particular export exists: the module may be busy resolving another name.
type typeScriptExportResolver struct {
  loader   *typeScriptLoader
  modules  map[string]*typeScriptExportModule
  bindings map[scopedTargetKey][]reachedSymbol
  owned    *ownedUnitIndex
}

type typeScriptExportModule struct {
  exports []moduleExport
  targets map[string]string
  names   map[string]bool
  named   map[string][]moduleExport
  stars   []moduleExport
}

func newTypeScriptExportResolver(loader *typeScriptLoader, entries []string) *typeScriptExportResolver {
  resolver := &typeScriptExportResolver{loader: loader, modules: map[string]*typeScriptExportModule{}, bindings: map[scopedTargetKey][]reachedSymbol{}}
  resolver.owned = newOwnedUnitIndex(loader)
  for _, entry := range entries {
    resolver.load(entry)
  }
  keys := make([]string, 0, len(resolver.modules))
  for key := range resolver.modules {
    keys = append(keys, key)
  }
  sort.Strings(keys)
  // Only star edges add names. Namespace and named re-exports already have
  // explicit names, so namespace cycles cannot grow this fixed point forever.
  for changed := true; changed; {
    changed = false
    for _, key := range keys {
      module := resolver.modules[key]
      for _, export := range module.stars {
        target := resolver.modules[module.targets[export.Specifier]]
        if target == nil {
          continue
        }
        for name := range target.names {
          if name != "default" && !module.names[name] {
            module.names[name] = true
            changed = true
          }
        }
      }
    }
  }
  if loader.boundary != nil {
    for _, key := range keys {
      module := resolver.modules[key]
      for _, export := range module.exports {
        if export.Specifier == "" || export.Namespace || export.Imported == "" {
          continue
        }
        target := module.targets[export.Specifier]
        if resolver.modules[target] == nil {
          continue
        }
        if len(resolver.resolve(target, export.Imported)) == 0 {
          loader.failures[key+" -> "+export.Specifier+"#"+export.Imported] = "the module has no public export named '" + export.Imported + "'"
        }
      }
    }
  }
  return resolver
}

func (resolver *typeScriptExportResolver) load(entry string) {
  if _, loaded := resolver.modules[entry]; loaded {
    return
  }
  inventory := resolver.loader.inventory(entry)
  if inventory == nil {
    return
  }
  module := &typeScriptExportModule{exports: inventory.Exports, targets: map[string]string{}, names: map[string]bool{}, named: map[string][]moduleExport{}}
  declarations := map[string]bool{}
  if inventory.Source != nil && inventory.Source.Statements != nil {
    for _, statement := range inventory.Source.Statements.Nodes {
      if statement == nil {
        continue
      }
      for _, declaration := range topLevelDeclaredNames(statement) {
        declarations[declaration.Name] = true
      }
      if name := typeScriptDeclarationName(statement); name != "" {
        declarations[name] = true
      }
    }
  }
  resolver.modules[entry] = module
  for _, export := range module.exports {
    if resolver.loader.boundary != nil && export.Specifier == "" && !declarations[export.Local] {
      resolver.loader.failures[entry+"#"+export.Public] = "the exported binding '" + export.Local + "' has no declaration in this module"
      continue
    }
    if export.Public != "" {
      module.names[export.Public] = true
      module.named[export.Public] = append(module.named[export.Public], export)
    } else if export.Specifier != "" {
      module.stars = append(module.stars, export)
    }
    if export.Specifier == "" {
      continue
    }
    if _, resolved := module.targets[export.Specifier]; resolved {
      continue
    }
    target := resolver.loader.resolve(entry, export.Specifier)
    module.targets[export.Specifier] = target
    if target != "" {
      resolver.load(target)
    }
  }
}

// accessor follows only the namespace segments the citation actually names.
// Each hop consumes at least one query segment, so namespace cycles are finite.
// Legacy inline spelling can join several query segments into a literal export
// name; Address records the consumed query segments for the remaining lookup.
func (resolver *typeScriptExportResolver) accessor(entry string, segments []string, prefix []string, typeOnly bool, legacy bool) []reachedSymbol {
  if len(segments) == 0 {
    return nil
  }
  result := []reachedSymbol{}
  limit := 1
  if legacy {
    limit = len(segments)
  }
  for consumed := 1; consumed <= limit; consumed++ {
    name := strings.Join(segments[:consumed], ".")
    for _, binding := range resolver.resolve(entry, name) {
      binding.Address = append(append([]string{}, prefix...), segments[:consumed]...)
      binding.TypeOnly = binding.TypeOnly || typeOnly
      // Keep namespace prefixes for diagnostics, including when the next name
      // is missing. They never become units in lookup or population traversal.
      result = append(result, binding)
      if binding.Local == "" {
        result = append(result, resolver.accessor(binding.Path, segments[consumed:], binding.Address, binding.TypeOnly, legacy)...)
      }
    }
  }
  return result
}

func (resolver *typeScriptExportResolver) lookup(entry string, segments []string, legacy bool) []*evidenceUnit {
  result := []*evidenceUnit{}
  seen := map[string]bool{}
  for _, binding := range resolver.accessor(entry, segments, nil, false, legacy) {
    if binding.Local == "" {
      continue
    }
    target := append([]string{binding.Local}, segments[len(binding.Address):]...)
    for _, unit := range resolver.owned.of(binding.Path, binding.Local) {
      if binding.TypeOnly && unit.ValueSpace && !unit.TypeSpace {
        continue
      }
      matches := encodeTypeScriptIdentity(unit.Identity) == encodeTypeScriptIdentity(target)
      if legacy {
        matches = strings.Join(unit.Identity, ".") == strings.Join(target, ".")
      }
      if matches && !seen[unit.ID] {
        seen[unit.ID] = true
        result = append(result, unit)
      }
    }
  }
  return result
}

func (resolver *typeScriptExportResolver) resolve(module string, name string) []reachedSymbol {
  key := scopedTargetKey{path: module, target: name}
  if cached, exists := resolver.bindings[key]; exists {
    return cached
  }
  resolved := resolver.resolveFrom(key, map[scopedTargetKey]bool{})
  resolver.bindings[key] = resolved
  return resolved
}

func (resolver *typeScriptExportResolver) resolveFrom(key scopedTargetKey, visited map[scopedTargetKey]bool) []reachedSymbol {
  if visited[key] {
    return nil
  }
  if cached, exists := resolver.bindings[key]; exists {
    return cached
  }
  module := resolver.modules[key.path]
  if module == nil {
    return nil
  }
  visited[key] = true
  defer delete(visited, key)
  result := []reachedSymbol{}
  byBinding := map[scopedTargetKey]int{}
  add := func(binding reachedSymbol, typeOnly bool) {
    binding.TypeOnly = binding.TypeOnly || typeOnly
    identity := scopedTargetKey{path: binding.Path, target: binding.Local}
    if index, exists := byBinding[identity]; exists {
      result[index].TypeOnly = result[index].TypeOnly && binding.TypeOnly
      return
    }
    byBinding[identity] = len(result)
    result = append(result, binding)
  }
  exports := module.named[key.target]
  if len(exports) == 0 && key.target != "default" {
    exports = module.stars
  }
  for _, export := range exports {
    if export.Specifier == "" {
      local := export.Public
      if export.Identity != "" {
        local = export.Identity
      }
      add(reachedSymbol{Path: key.path, Local: local}, export.TypeOnly)
      continue
    }
    target := module.targets[export.Specifier]
    if resolver.modules[target] == nil {
      continue
    }
    if export.Namespace {
      add(reachedSymbol{Path: target}, export.TypeOnly)
      continue
    }
    imported := key.target
    if export.Imported != "" {
      imported = export.Imported
    }
    for _, binding := range resolver.resolveFrom(scopedTargetKey{path: target, target: imported}, visited) {
      add(binding, export.TypeOnly)
    }
  }
  return result
}

func (resolver *typeScriptExportResolver) traverse(entry string, prefix []string, visited map[string]bool, typeOnly bool) []reachedSymbol {
  if visited[entry] {
    return nil
  }
  module := resolver.modules[entry]
  if module == nil {
    return nil
  }
  visited[entry] = true
  defer delete(visited, entry)
  names := make([]string, 0, len(module.names))
  for name := range module.names {
    names = append(names, name)
  }
  sort.Strings(names)
  reached := []reachedSymbol{}
  for _, name := range names {
    for _, binding := range resolver.resolve(entry, name) {
      binding.Address = append(append([]string{}, prefix...), name)
      binding.TypeOnly = binding.TypeOnly || typeOnly
      reached = append(reached, binding)
      if binding.Local == "" {
        reached = append(reached, resolver.traverse(binding.Path, binding.Address, visited, binding.TypeOnly)...)
      }
    }
  }
  return reached
}

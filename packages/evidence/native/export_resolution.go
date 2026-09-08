package evidence

import (
  "sort"
)

// Export names are finite even when modules re-export each other. Discover
// that vocabulary before resolving bindings, and expand namespace paths only
// after a binding is known. A module recursion guard cannot answer whether a
// particular export exists: the module may be busy resolving another name.
type typeScriptExportResolver struct {
  loader   *typeScriptLoader
  modules  map[string]*typeScriptExportModule
  bindings map[scopedTargetKey][]reachedSymbol
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
  resolver.modules[entry] = module
  for _, export := range module.exports {
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

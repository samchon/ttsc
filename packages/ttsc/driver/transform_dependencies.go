package driver

import (
  "sort"
  "sync"
)

// TransformDependencies is the transform envelope's dependency side channel:
// the per-file input lists a producer reports and the subset of files whose
// list is complete.
//
// A producer that declares nothing leaves both fields empty, so its envelope is
// byte-identical to what it was before this existed. The lane with no linked
// plugin at all is the deliberate exception: nothing there can contribute to a
// file, so every file is listed.
type TransformDependencies struct {
  // Complete lists the files whose Dependencies entry is the whole input set
  // beyond the file itself and the universal compiler-option chain.
  Complete []string
  // Dependencies maps a transformed file to the files whose content influenced
  // its output, keyed and valued like every other envelope section.
  Dependencies map[string][]string
}

// TransformDependenciesFor computes the dependency side channel for the files
// this program transforms, keyed against cwd.
//
// **The rule that makes any of this declarable.** ttsc's own source-to-source
// transform is syntactic: the built-in native host answers with each file's
// parsed text, and the linked-plugin generic host prints the parsed AST through
// a printer that is handed neither a checker nor an emit resolver. Neither lane
// runs the emit transformer chain, so none of the type-driven lowerings happen
// there — no type-driven import elision, no `design:type` metadata, no `enum`,
// `namespace`, or JSX lowering, and no declaration emit. The output of a file
// the host alone produced is therefore a function of that file's own text and
// the compiler options, and nothing the type system knows about any other file
// can change it.
//
// What that leaves is the plugins. A source preamble is prepended to every
// file's text before parsing, and a program plugin mutates the parsed AST, so
// either can make an output depend on anything it consulted — including, for a
// checker-driven plugin, the whole type graph. Such a plugin is the only party
// that knows what it read, which is why the declaration is per (plugin, file)
// and why a file is complete only when every plugin that can contribute to it
// declared it. An emit-only plugin is not a contributor here: its transform runs
// in `build`, which produces no envelope.
//
// With no linked plugin at all the contributor set is empty and every file is
// complete with an empty list, which is the rule above stated for the lane that
// has nothing but the host in it. A contributor that declares nothing leaves
// every file unlisted, which is exactly the behaviour of every producer written
// before this existed.
//
// An embedder that supplies LoadProgramOptions.SourcePreamble itself, rather
// than obtaining it from a linked plugin, makes the same claim about that text
// by calling this: the preamble must be a function of inputs its envelope
// reports elsewhere, the way a plugin's preamble is a function of the config
// files it reports as host inputs.
func (p *Program) TransformDependenciesFor(cwd string) TransformDependencies {
  if p == nil {
    return TransformDependencies{}
  }
  // Declarations are made from inside the plugin hooks, so they exist only
  // after those hooks ran. The apply is latched, so this cannot re-run them.
  _ = p.ApplyLinkedPlugins()
  files := p.sourceFilesRaw()
  keys := make([]string, 0, len(files))
  for _, file := range files {
    keys = append(keys, TransformOutputKey(cwd, file.FileName()))
  }
  return p.plugins.transformDependencies(keys)
}

// transformDependencies aggregates every contributing plugin's declarations
// over the envelope keys of the transformed files.
func (state linkedPluginState) transformDependencies(keys []string) TransformDependencies {
  return aggregateTransformDependencies(keys, state.transformContributors(), state.declarations)
}

// aggregateTransformDependencies folds the declarations of the given
// contributors into one envelope side channel.
//
// Separated from the entry classification above so the aggregation rule can be
// exercised without the process-wide plugin registry that classification reads.
func aggregateTransformDependencies(keys []string, contributors []int, declarations *pluginFileDeclarations) TransformDependencies {
  out := TransformDependencies{}
  for _, key := range keys {
    declared := 0
    inputs := map[string]struct{}{}
    for _, index := range contributors {
      declaration := declarations.lookup(index)
      if declaration == nil {
        continue
      }
      for _, input := range declaration.dependenciesOf(key) {
        // A file never depends on itself: the file's own text is outside the
        // completeness contract by construction, and a self-edge would only
        // make consumers register the module they are already transforming.
        if input != key {
          inputs[input] = struct{}{}
        }
      }
      if declaration.declaresComplete(key) {
        declared++
      }
    }
    if len(inputs) != 0 {
      out.Dependencies = appendDependencyEntry(out.Dependencies, key, inputs)
    }
    if declared == len(contributors) {
      out.Complete = append(out.Complete, key)
    }
  }
  sort.Strings(out.Complete)
  return out
}

// appendDependencyEntry records one file's sorted dependency list, allocating
// the map only for a producer that reported something.
func appendDependencyEntry(into map[string][]string, key string, inputs map[string]struct{}) map[string][]string {
  if into == nil {
    into = map[string][]string{}
  }
  entry := make([]string, 0, len(inputs))
  for input := range inputs {
    entry = append(entry, input)
  }
  sort.Strings(entry)
  into[key] = entry
  return into
}

// transformContributors returns the indexes of the linked plugin entries that
// can influence source-to-source transform output.
//
// An entry with no registered plugin cannot be inspected, so it counts as a
// contributor that declared nothing; the host fails that entry elsewhere, and
// until it does, silence is the conservative answer.
func (state linkedPluginState) transformContributors() []int {
  contributors := make([]int, 0, len(state.entries))
  for index := range state.entries {
    plugin, ok := registeredPlugin(index)
    if !ok {
      contributors = append(contributors, index)
      continue
    }
    _, preamble := plugin.(SourcePreamblePlugin)
    _, program := plugin.(ProgramPlugin)
    if preamble || program {
      contributors = append(contributors, index)
    }
  }
  return contributors
}

// pluginFileDeclarations holds one declaration record per linked plugin entry.
type pluginFileDeclarations struct {
  mu      sync.Mutex
  plugins map[int]*pluginFileDeclaration
}

// pluginFileDeclaration is one plugin's reported dependencies and completeness
// claims, keyed by envelope key.
type pluginFileDeclaration struct {
  complete     map[string]struct{}
  completeAll  bool
  dependencies map[string]map[string]struct{}
  mu           sync.Mutex
  // rejected holds the files whose reported list this plugin could not state
  // in full, because one of its members was unusable as a key.
  rejected map[string]struct{}
}

func newPluginFileDeclarations() *pluginFileDeclarations {
  return &pluginFileDeclarations{plugins: map[int]*pluginFileDeclaration{}}
}

// forPlugin returns the declaration record of one plugin entry, creating it on
// first use. A nil ledger still answers a usable record so a hand-built state
// (unit tests, embedders) never panics through a plugin's reporting call.
func (declarations *pluginFileDeclarations) forPlugin(index int) *pluginFileDeclaration {
  record := &pluginFileDeclaration{
    complete:     map[string]struct{}{},
    dependencies: map[string]map[string]struct{}{},
    rejected:     map[string]struct{}{},
  }
  if declarations == nil {
    return record
  }
  declarations.mu.Lock()
  defer declarations.mu.Unlock()
  if existing, ok := declarations.plugins[index]; ok {
    return existing
  }
  declarations.plugins[index] = record
  return record
}

// lookup returns the declaration record of one plugin entry, or nil when that
// entry never reported anything.
func (declarations *pluginFileDeclarations) lookup(index int) *pluginFileDeclaration {
  if declarations == nil {
    return nil
  }
  declarations.mu.Lock()
  defer declarations.mu.Unlock()
  return declarations.plugins[index]
}

func (declaration *pluginFileDeclaration) addDependency(file string, dependency string) {
  if declaration == nil {
    return
  }
  declaration.mu.Lock()
  defer declaration.mu.Unlock()
  entry, ok := declaration.dependencies[file]
  if !ok {
    entry = map[string]struct{}{}
    declaration.dependencies[file] = entry
  }
  entry[dependency] = struct{}{}
}

// rejectDependency withdraws this plugin's completeness claim for one file.
func (declaration *pluginFileDeclaration) rejectDependency(file string) {
  if declaration == nil {
    return
  }
  declaration.mu.Lock()
  defer declaration.mu.Unlock()
  declaration.rejected[file] = struct{}{}
}

func (declaration *pluginFileDeclaration) addComplete(file string) {
  if declaration == nil {
    return
  }
  declaration.mu.Lock()
  defer declaration.mu.Unlock()
  declaration.complete[file] = struct{}{}
}

func (declaration *pluginFileDeclaration) completeEveryFile() {
  if declaration == nil {
    return
  }
  declaration.mu.Lock()
  defer declaration.mu.Unlock()
  declaration.completeAll = true
}

func (declaration *pluginFileDeclaration) dependenciesOf(file string) []string {
  if declaration == nil {
    return nil
  }
  declaration.mu.Lock()
  defer declaration.mu.Unlock()
  entry, ok := declaration.dependencies[file]
  if !ok {
    return nil
  }
  out := make([]string, 0, len(entry))
  for input := range entry {
    out = append(out, input)
  }
  return out
}

func (declaration *pluginFileDeclaration) declaresComplete(file string) bool {
  if declaration == nil {
    return false
  }
  declaration.mu.Lock()
  defer declaration.mu.Unlock()
  if _, rejected := declaration.rejected[file]; rejected {
    return false
  }
  if declaration.completeAll {
    return true
  }
  _, ok := declaration.complete[file]
  return ok
}

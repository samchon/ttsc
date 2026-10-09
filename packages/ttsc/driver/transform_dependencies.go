package driver

import (
  "sort"
  "sync"
)

// TransformDependencies is the transform envelope's dependency side channel:
// the per-file input lists a producer reports and the subset of files whose
// list is complete.
//
// A producer that declares nothing leaves both fields empty, so its envelope
// carries neither. The lane with no linked
// contributor at all is the deliberate exception: the completeness test has
// no contributor declarations to require, so every transformed file is listed.
// This side channel does not independently certify resolver, host or plugin
// source inputs reported through other envelope fields.
//
// @evidence contracts/common.md#principled-implementation Reported dependencies and explicit completeness are distinct; an empty contributor set is complete without pretending silent contributors proved anything.
// @evidence contracts/common.md#clear-and-simple-design One per-file adjacency map and one complete-file list carry separate facts.
// @evidence contracts/common.md#prohibited-implementation-shortcuts Missing declarations remain incomplete rather than becoming complete because a transform succeeded.
// @evidence contracts/common.md#meaningful-documentation Native field prose defines completeness, input scope, and the no-contributor case following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation Dependencies and Complete use producer cwd-relative slash keys, with slash-normalized absolute coordinates outside cwd or across volumes. These protocol spellings do not certify physical identity or native case policy; native conversion belongs to TransformOutputKey, while this type preserves the reported dependency coordinate system.
// @evidenceExclude contracts/performance.md#efficient-algorithms Aggregation owns traversal; this type is the result schema.
// @evidenceExclude contracts/performance.md#reuse-equivalent-work The schema does not coordinate cached transform work.
// @evidenceExclude contracts/performance.md#bound-retention-and-release-resources The returned value owns no resident cache or external resource.
type TransformDependencies struct {
  // Complete lists files declared by every applicable preamble/program
  // contributor (including the empty-contributor case), not independent proof
  // that no resolver, host or plugin-source input remains.
  Complete []string

  // Dependencies maps a transformed file to contributor-reported inputs,
  // keyed and valued like every other envelope section.
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
// every file unlisted, the same as a producer that predates the declaration.
//
// An embedder that supplies LoadProgramOptions.SourcePreamble itself, rather
// than obtaining it from a linked plugin, makes the same claim about that text
// by calling this: the preamble must be a function of inputs its envelope
// reports elsewhere, the way a plugin's preamble is a function of the config
// files it reports as host inputs.
//
// This call can apply linked program hooks for the first time; later calls
// reuse the latched outcome but recompute dependency aggregation. It ignores
// the hook error locally, so callers must separately admit successful output.
// Completeness records contributor declarations, not independently verified
// coverage of arbitrary plugin reads or an atomic declaration snapshot.
//
// @evidence contracts/common.md#principled-implementation Syntactic host output excludes type-driven emit lowering; completeness requires every actual preamble/program contributor to declare its own consumed inputs.
// @evidence contracts/common.md#clear-and-simple-design The method enumerates transformed-file keys then delegates contributor classification and declaration folding to their owners.
// @evidence contracts/common.md#prohibited-implementation-shortcuts A silent contributor remains incomplete; emit-only plugins are excluded because this envelope lane does not execute their transforms.
// @evidence contracts/common.md#meaningful-documentation Native paragraphs explain syntactic output, contributors, and the embedder's preamble responsibility following the documentation skill.
// @evidence contracts/portability.md#os-neutral-implementation All file keys pass through TransformOutputKey with the supplied project cwd instead of native-separator assumptions.
// @evidence contracts/performance.md#efficient-algorithms Source filtering/key conversion visits resident files and path text. Contributor classification visits registered entries; each transformed file visits applicable contributors, copies their reported dependency lists under locks, hashes/deduplicates input strings and sorts final distinct lists/completeness keys. Initial hook work can be arbitrary; repeated aggregation is not memoized or bounded by a configured work/byte ceiling.
// @evidence contracts/performance.md#reuse-equivalent-work First use can execute linked program hooks, whose success/error is latched for the current Program generation; subsequent calls do not rerun them. Recorded declarations are read again to derive current per-file completeness, while key conversion and aggregation repeat. No equivalence across changed Program generations is established here.
// @evidence contracts/performance.md#bound-retention-and-release-resources Temporary keys, per-file input sets and copied declaration lists grow with sources/contributors/dependency path bytes; result maps/arrays transfer to the caller. Linked hooks/declarations and their latched outcome remain with the caller-owned Program, without a separate historical result cache in this method. No dependency population/byte cap or caller-result disposal policy is supplied.
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
    keys = append(keys, TransformOutputKey(cwd, file.FileName().AsString()))
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

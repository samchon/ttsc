package driver

import (
  "encoding/json"
  "fmt"
  "os"
  "path/filepath"
  "sort"
  "strings"
  "sync"
)

// LinkedPluginsEnv is the environment variable ttsc sets to pass the JSON
// manifest of linked plugins to a natively-linked host binary. The value is
// a JSON array of PluginEntry objects; an empty or absent value means no
// linked plugins are active.
const LinkedPluginsEnv = "TTSC_LINKED_PLUGINS_JSON"

// PluginConfigDirEnv is the environment variable through which the ttsc
// launcher passes the project root that plugin config-file discovery and
// relative "configFile" resolution anchor at. The launcher sets it on every
// native plugin spawn; it matters when the compiled tsconfig is a generated
// wrapper outside the project — e.g. @ttsc/unplugin writes a compiler-options
// overlay into the system temp directory that `extends` the real project
// config — where the tsconfig directory no longer identifies the project and
// an unanchored discovery walk would climb the temp tree instead. It rides
// the environment rather than a CLI flag so third-party native hosts with
// strict flag sets are unaffected and linked plugins running inside them
// still receive it.
const PluginConfigDirEnv = "TTSC_PLUGIN_CONFIG_DIR"

// TsgoArgsEnv is the environment variable through which the ttsc launcher
// passes the tsgo CLI flags it did not consume itself (`--strict`,
// `--declaration`, the single-file lane's output containment, …) to a native
// sidecar. The value is a JSON array of argv tokens; an empty or absent value
// means nothing was forwarded.
//
// It rides the environment for the same reason PluginConfigDirEnv does, only
// with sharper consequences. The payload used to travel as a `--tsgo-args`
// flag, which #113 appended to a plugin protocol third-party hosts had already
// frozen. A Go `flag.FlagSet` created with `flag.ContinueOnError` treats an
// undeclared flag as fatal, so every sidecar built before #113 answered
// `flag provided but not defined: -tsgo-args` and exited 2 — including on
// `ttsc <file.ts>`, where the launcher forwards its own output-containment
// flags and the user passed nothing at all (issue #1188). An unknown
// environment variable is inert to every host; an unknown flag is fatal to all
// of them. ttsc's own hosts still accept `--tsgo-args` so an older launcher
// paired with a newer host keeps working.
const TsgoArgsEnv = "TTSC_TSGO_ARGS"

// TsgoArgsFromEnv decodes the forwarded tsgo argv the launcher published in
// TsgoArgsEnv. An absent or whitespace-only value yields a nil slice and no
// error, so a host can call this unconditionally.
//
// Hosts that also declare a `--tsgo-args` flag should prefer the explicit flag
// value and fall back to this; LoadProgram already does that for every
// driver-based host.
func TsgoArgsFromEnv() ([]string, error) {
  raw := strings.TrimSpace(os.Getenv(TsgoArgsEnv))
  if raw == "" {
    return nil, nil
  }
  var args []string
  if err := json.Unmarshal([]byte(raw), &args); err != nil {
    return nil, fmt.Errorf("ttsc driver: invalid %s: %w", TsgoArgsEnv, err)
  }
  return args, nil
}

// PluginConfigBaseDir returns the directory where a plugin anchors its
// config-file discovery walk and resolves relative "configFile" paths.
// The explicit PluginConfigDirEnv channel wins when set; otherwise the
// tsconfig's directory is used, falling back to cwd when no tsconfig is set.
func PluginConfigBaseDir(cwd, tsconfigPath string) string {
  if dir := strings.TrimSpace(os.Getenv(PluginConfigDirEnv)); dir != "" {
    if !filepath.IsAbs(dir) && cwd != "" {
      dir = filepath.Join(cwd, dir)
    }
    return filepath.Clean(dir)
  }
  if tsconfigPath != "" {
    resolved := tsconfigPath
    if !filepath.IsAbs(resolved) {
      resolved = filepath.Join(cwd, resolved)
    }
    return filepath.Dir(resolved)
  }
  return cwd
}

// PluginEntry is the manifest shape ttsc passes to driver-level plugins.
type PluginEntry struct {
  Config map[string]any `json:"config"`
  Name   string         `json:"name"`
  Stage  string         `json:"stage"`
}

// PluginContext is the per-entry context passed to registered linked plugins.
type PluginContext struct {
  Cwd      string
  Entry    PluginEntry
  Tsconfig string

  reportHostInput                func(string)
  reportHostInputHash            func(string, *string)
  reportHostInputHashUnknown     func(string)
  reportHostInputRealpath        func(string, *string)
  reportHostInputRealpathUnknown func(string)
  reportFileDependency           func(string, string)
  reportFileDependencyRejected   func(string)
  reportFileComplete             func(string)
  reportEveryFileComplete        func()
}

// ReportHostInputHash declares the exact file state consumed by a native
// plugin. hash is a lowercase SHA-256 digest for an observed file and nil for
// a missing candidate. Conflicting observations are retained as host inputs
// but omitted from PluginHostInputHashes, forcing persistent adapters to
// decline narrow reuse without failing the transform.
func (ctx PluginContext) ReportHostInputHash(file string, hash *string) {
  if ctx.reportHostInputHash == nil || strings.TrimSpace(file) == "" {
    return
  }
  if !filepath.IsAbs(file) {
    file = filepath.Join(ctx.Cwd, file)
  }
  file = filepath.Clean(file)
  if hash != nil && !isLowerSHA256(*hash) {
    if ctx.reportHostInputHashUnknown != nil {
      ctx.reportHostInputHashUnknown(file)
    } else if ctx.reportHostInput != nil {
      ctx.reportHostInput(file)
    }
    return
  }
  ctx.reportHostInputHash(file, hash)
}

// ReportHostInputRealpath declares the physical path resolved while a native
// plugin consumed file. realpath is absolute for an observed path and nil for
// a missing candidate. Conflicting observations remain host inputs but are
// omitted from PluginHostInputRealpaths so adapters cannot attach an earlier
// result to a retargeted symlink or junction.
func (ctx PluginContext) ReportHostInputRealpath(file string, realpath *string) {
  if ctx.reportHostInputRealpath == nil || strings.TrimSpace(file) == "" {
    return
  }
  if !filepath.IsAbs(file) {
    file = filepath.Join(ctx.Cwd, file)
  }
  file = filepath.Clean(file)
  if realpath != nil {
    if strings.TrimSpace(*realpath) == "" || !filepath.IsAbs(*realpath) {
      if ctx.reportHostInputRealpathUnknown != nil {
        ctx.reportHostInputRealpathUnknown(file)
      } else if ctx.reportHostInput != nil {
        ctx.reportHostInput(file)
      }
      return
    }
    resolved := filepath.Clean(*realpath)
    realpath = &resolved
  }
  ctx.reportHostInputRealpath(file, realpath)
}

func isLowerSHA256(value string) bool {
  if len(value) != 64 {
    return false
  }
  for _, char := range value {
    if (char < '0' || char > '9') && (char < 'a' || char > 'f') {
      return false
    }
  }
  return true
}

// ReportHostInput declares an absolute file whose content or presence was
// consumed while the native plugin evaluated configuration. Native transform
// envelopes expose the generation-wide union so persistent hosts can invalidate
// without re-evaluating plugin config on the JavaScript side.
func (ctx PluginContext) ReportHostInput(file string) {
  if ctx.reportHostInput == nil || strings.TrimSpace(file) == "" {
    return
  }
  if !filepath.IsAbs(file) {
    file = filepath.Join(ctx.Cwd, file)
  }
  ctx.reportHostInput(filepath.Clean(file))
}

// ReportFileDependency declares one file whose content influenced this
// plugin's contribution to the transformed file file. Both are resolved
// against the plugin's cwd and keyed like every other envelope section, so a
// plugin reports the program's own file names and the host joins the sections
// by key.
//
// Reporting alone only widens what a consumer invalidates on; it is
// ReportFileDependenciesComplete that turns the reported set into the file's
// whole input set.
//
// A dependency this cannot resolve to a key is not silently forgotten: it
// withdraws this plugin's completeness claim for that file, because a complete
// list missing a member is exactly what serves stale output. The plugin's other
// files keep theirs.
func (ctx PluginContext) ReportFileDependency(file string, dependency string) {
  if ctx.reportFileDependency == nil {
    return
  }
  target, ok := ctx.transformKey(file)
  if !ok {
    return
  }
  input, ok := ctx.transformKey(dependency)
  if !ok {
    if ctx.reportFileDependencyRejected != nil {
      ctx.reportFileDependencyRejected(target)
    }
    return
  }
  ctx.reportFileDependency(target, input)
}

// ReportFileDependenciesComplete declares that everything this plugin's
// contribution to file consumed, beyond file's own text and the universal
// compiler-option chain, was reported through ReportFileDependency — possibly
// nothing at all.
//
// The declaration is per (plugin, file), the way the protocol's completeness
// contract defines it: the host lists a file in dependenciesComplete only when
// every plugin that can contribute to it declared it, because a consumer cannot
// attribute one plugin's entries back to it.
func (ctx PluginContext) ReportFileDependenciesComplete(file string) {
  if ctx.reportFileComplete == nil {
    return
  }
  target, ok := ctx.transformKey(file)
  if !ok {
    return
  }
  ctx.reportFileComplete(target)
}

// ReportDependenciesComplete makes the same declaration for every file in the
// program at once: this plugin's contribution to any transformed file is a
// function of that file's own text, whatever it reported for that file, its
// reported host inputs, and the compiler options.
//
// That is the honest claim of a syntactic transform — one that decides from the
// file in front of it and its own configuration rather than from the type
// system — and it is the only form available to a hook that never sees the
// program, such as SourcePreamble.
func (ctx PluginContext) ReportDependenciesComplete() {
  if ctx.reportEveryFileComplete == nil {
    return
  }
  ctx.reportEveryFileComplete()
}

// transformKey resolves one plugin-reported path to the key convention every
// envelope section uses. A plugin reports the spellings its host handed it
// (absolute program file names, or paths relative to the plugin's cwd), and
// the compiler's own file names are slash-normalized on every platform, so
// both sides must pass through TransformOutputKey to meet.
//
// Separators and the project prefix reconcile, but the suffix keeps the case
// the caller wrote: report the program's own spelling of a file rather than a
// re-cased one, or the key will not match on a case-insensitive filesystem and
// the declaration is dropped.
func (ctx PluginContext) transformKey(file string) (string, bool) {
  if strings.TrimSpace(file) == "" {
    return "", false
  }
  if !filepath.IsAbs(file) {
    file = filepath.Join(ctx.Cwd, file)
  }
  return TransformOutputKey(ctx.Cwd, filepath.Clean(file)), true
}

// SourcePreamblePlugin can inject source text before TypeScript-Go parses the
// project. This is intentionally generic: the driver knows only the registered
// plugin name and the project plugin manifest.
type SourcePreamblePlugin interface {
  SourcePreamble(PluginContext) (string, error)
}

// ProgramPlugin can mutate a loaded Program before source output or emit.
type ProgramPlugin interface {
  ApplyProgram(*Program, PluginContext) error
}

// EmitTransformPlugin contributes an emit-phase AST transformer. The returned
// PluginTransform runs first in tsgo's per-file emit chain, sharing the emit
// EmitContext with the builtin transformers, so a plugin returns AST instead of
// spliced text. For an injected import, allocate its binding once with
// ec.Factory.NewUniqueNameEx and the Optimistic | FileLevel flags, then reuse
// that identifier for every reference. NewGeneratedNameForNode on a string
// literal uses tsgo's temp-name channel and can be shadowed by downlevel temps.
// Tsgo's module-transform emits the require and aliases the references itself.
// This is the AST-integration replacement for the ProgramPlugin + RewriteSet
// text-splice model. A plugin whose returned transform is nil contributes
// nothing.
type EmitTransformPlugin interface {
  EmitTransform(PluginContext) (PluginTransform, error)
}

type linkedPluginState struct {
  cwd          string
  declarations *pluginFileDeclarations
  entries      []PluginEntry
  inputs       *pluginHostInputScopes
  tsconfig     string
}

// pluginHostInputScopes keeps one observation set per plugin hook. A hash from
// one hook cannot prove another hook's same-file dependency when that hook only
// reported the path, while ReportHostInput followed by ReportHostInputHash in
// one hook remains one complete observation.
type pluginHostInputScopes struct {
  mu     sync.Mutex
  scopes []*pluginHostInputs
}

type pluginHostInputs struct {
  files     map[string]struct{}
  hashes    map[string]pluginHostInputHash
  realpaths map[string]pluginHostInputHash
  mu        sync.Mutex
}

type pluginHostInputHash struct {
  hash  *string
  known bool
}

func newPluginHostInputScopes() *pluginHostInputScopes {
  return &pluginHostInputScopes{}
}

func newPluginHostInputs() *pluginHostInputs {
  return &pluginHostInputs{
    files:     map[string]struct{}{},
    hashes:    map[string]pluginHostInputHash{},
    realpaths: map[string]pluginHostInputHash{},
  }
}

func (inputs *pluginHostInputScopes) newScope() *pluginHostInputs {
  scope := newPluginHostInputs()
  if inputs == nil {
    return scope
  }
  inputs.mu.Lock()
  inputs.scopes = append(inputs.scopes, scope)
  inputs.mu.Unlock()
  return scope
}

func (inputs *pluginHostInputScopes) snapshot() []*pluginHostInputs {
  if inputs == nil {
    return nil
  }
  inputs.mu.Lock()
  defer inputs.mu.Unlock()
  return append([]*pluginHostInputs(nil), inputs.scopes...)
}

func (inputs *pluginHostInputs) addHash(file string, hash *string) {
  if inputs == nil {
    return
  }
  inputs.mu.Lock()
  defer inputs.mu.Unlock()
  inputs.files[file] = struct{}{}
  previous, exists := inputs.hashes[file]
  if !exists {
    inputs.hashes[file] = pluginHostInputHash{hash: cloneStringPointer(hash), known: true}
    return
  }
  if !previous.known || !sameStringPointer(previous.hash, hash) {
    inputs.hashes[file] = pluginHostInputHash{known: false}
  }
}

func (inputs *pluginHostInputs) invalidateHash(file string) {
  if inputs == nil {
    return
  }
  inputs.mu.Lock()
  defer inputs.mu.Unlock()
  inputs.files[file] = struct{}{}
  inputs.hashes[file] = pluginHostInputHash{known: false}
}

func (inputs *pluginHostInputs) addRealpath(file string, realpath *string) {
  if inputs == nil {
    return
  }
  inputs.mu.Lock()
  defer inputs.mu.Unlock()
  inputs.files[file] = struct{}{}
  previous, exists := inputs.realpaths[file]
  if !exists {
    inputs.realpaths[file] = pluginHostInputHash{hash: cloneStringPointer(realpath), known: true}
    return
  }
  if !previous.known || !sameStringPointer(previous.hash, realpath) {
    inputs.realpaths[file] = pluginHostInputHash{known: false}
  }
}

func (inputs *pluginHostInputs) invalidateRealpath(file string) {
  if inputs == nil {
    return
  }
  inputs.mu.Lock()
  defer inputs.mu.Unlock()
  inputs.files[file] = struct{}{}
  inputs.realpaths[file] = pluginHostInputHash{known: false}
}

func cloneStringPointer(value *string) *string {
  if value == nil {
    return nil
  }
  cloned := *value
  return &cloned
}

func sameStringPointer(left, right *string) bool {
  if left == nil || right == nil {
    return left == nil && right == nil
  }
  return *left == *right
}

func (inputs *pluginHostInputs) add(file string) {
  if inputs == nil {
    return
  }
  inputs.mu.Lock()
  inputs.files[file] = struct{}{}
  inputs.mu.Unlock()
}

func (inputs *pluginHostInputs) snapshot() (map[string]struct{}, map[string]pluginHostInputHash, map[string]pluginHostInputHash) {
  if inputs == nil {
    return nil, nil, nil
  }
  inputs.mu.Lock()
  defer inputs.mu.Unlock()
  files := make(map[string]struct{}, len(inputs.files))
  for file := range inputs.files {
    files[file] = struct{}{}
  }
  hashes := make(map[string]pluginHostInputHash, len(inputs.hashes))
  for file, observation := range inputs.hashes {
    hashes[file] = pluginHostInputHash{
      hash:  cloneStringPointer(observation.hash),
      known: observation.known,
    }
  }
  realpaths := make(map[string]pluginHostInputHash, len(inputs.realpaths))
  for file, observation := range inputs.realpaths {
    realpaths[file] = pluginHostInputHash{
      hash:  cloneStringPointer(observation.hash),
      known: observation.known,
    }
  }
  return files, hashes, realpaths
}

func (inputs *pluginHostInputScopes) list() []string {
  union := map[string]struct{}{}
  for _, scope := range inputs.snapshot() {
    files, _, _ := scope.snapshot()
    for file := range files {
      union[file] = struct{}{}
    }
  }
  files := make([]string, 0, len(union))
  for file := range union {
    files = append(files, file)
  }
  sort.Strings(files)
  return files
}

func (inputs *pluginHostInputScopes) hashList() map[string]*string {
  combined := map[string]pluginHostInputHash{}
  for _, scope := range inputs.snapshot() {
    files, hashes, _ := scope.snapshot()
    for file := range files {
      observation, exists := hashes[file]
      if !exists || !observation.known {
        combined[file] = pluginHostInputHash{known: false}
        continue
      }
      previous, exists := combined[file]
      if !exists {
        combined[file] = observation
      } else if !previous.known || !sameStringPointer(previous.hash, observation.hash) {
        combined[file] = pluginHostInputHash{known: false}
      }
    }
  }
  hashes := map[string]*string{}
  for file, observation := range combined {
    if observation.known {
      hashes[file] = cloneStringPointer(observation.hash)
    }
  }
  if len(hashes) == 0 {
    return nil
  }
  return hashes
}

func (inputs *pluginHostInputScopes) realpathList() map[string]*string {
  combined := map[string]pluginHostInputHash{}
  for _, scope := range inputs.snapshot() {
    files, _, realpaths := scope.snapshot()
    for file := range files {
      observation, exists := realpaths[file]
      if !exists || !observation.known {
        combined[file] = pluginHostInputHash{known: false}
        continue
      }
      previous, exists := combined[file]
      if !exists {
        combined[file] = observation
      } else if !previous.known || !sameStringPointer(previous.hash, observation.hash) {
        combined[file] = pluginHostInputHash{known: false}
      }
    }
  }
  realpaths := map[string]*string{}
  for file, observation := range combined {
    if observation.known {
      realpaths[file] = cloneStringPointer(observation.hash)
    }
  }
  if len(realpaths) == 0 {
    return nil
  }
  return realpaths
}

var pluginRegistry []any

// RegisterPlugin registers a driver-level plugin implementation. Linked Go
// packages call this from init(); ttsc pairs registrations with linked manifest
// entries by build order, not by package name.
func RegisterPlugin(plugin any) {
  if plugin == nil {
    panic("driver: RegisterPlugin called with nil plugin")
  }
  pluginRegistry = append(pluginRegistry, plugin)
}

// loadLinkedPluginState reads the linked-plugin manifest from the environment
// and returns the hydrated state. Returns a zero-entry state (not an error)
// when the environment variable is absent or empty.
func loadLinkedPluginState(cwd, tsconfigPath string) (linkedPluginState, error) {
  input := strings.TrimSpace(os.Getenv(LinkedPluginsEnv))
  if input == "" {
    return linkedPluginState{
      cwd:          cwd,
      declarations: newPluginFileDeclarations(),
      inputs:       newPluginHostInputScopes(),
      tsconfig:     tsconfigPath,
    }, nil
  }
  var entries []PluginEntry
  if err := json.Unmarshal([]byte(input), &entries); err != nil {
    return linkedPluginState{}, fmt.Errorf("ttsc driver: invalid %s: %w", LinkedPluginsEnv, err)
  }
  return linkedPluginState{
    cwd:          cwd,
    declarations: newPluginFileDeclarations(),
    entries:      entries,
    inputs:       newPluginHostInputScopes(),
    tsconfig:     tsconfigPath,
  }, nil
}

// sourcePreamble calls SourcePreamble on every SourcePreamblePlugin in
// registration order and concatenates the results. An entry that does not
// implement SourcePreamblePlugin is silently skipped.
func (state linkedPluginState) sourcePreamble() (string, error) {
  var out strings.Builder
  for index, entry := range state.entries {
    plugin, ok := registeredPlugin(index)
    if !ok {
      return "", fmt.Errorf("ttsc driver: linked plugin entry %d was requested but no linked plugin registered at that position", index)
    }
    preamble, ok := plugin.(SourcePreamblePlugin)
    if !ok {
      continue
    }
    text, err := preamble.SourcePreamble(state.contextAt(index, entry))
    if err != nil {
      return "", err
    }
    out.WriteString(text)
  }
  return out.String(), nil
}

// apply calls ApplyProgram on every ProgramPlugin in registration order.
// An entry that does not implement ProgramPlugin is silently skipped.
func (state linkedPluginState) apply(prog *Program) error {
  for index, entry := range state.entries {
    plugin, ok := registeredPlugin(index)
    if !ok {
      return fmt.Errorf("ttsc driver: linked plugin entry %d was requested but no linked plugin registered at that position", index)
    }
    transform, ok := plugin.(ProgramPlugin)
    if !ok {
      continue
    }
    if err := transform.ApplyProgram(prog, state.contextAt(index, entry)); err != nil {
      return err
    }
  }
  return nil
}

func (state linkedPluginState) hasProgramPlugins() bool {
  for index := range state.entries {
    plugin, ok := registeredPlugin(index)
    if !ok {
      continue
    }
    if _, ok := plugin.(ProgramPlugin); ok {
      return true
    }
  }
  return false
}

// emitTransforms collects an emit-phase PluginTransform from every registered
// EmitTransformPlugin, in registration order. Entries that do not implement
// EmitTransformPlugin, or whose transform is nil, are skipped.
func (state linkedPluginState) emitTransforms() ([]PluginTransform, error) {
  var out []PluginTransform
  for index, entry := range state.entries {
    plugin, ok := registeredPlugin(index)
    if !ok {
      return nil, fmt.Errorf("ttsc driver: linked plugin entry %d was requested but no linked plugin registered at that position", index)
    }
    emitter, ok := plugin.(EmitTransformPlugin)
    if !ok {
      continue
    }
    transform, err := emitter.EmitTransform(state.contextAt(index, entry))
    if err != nil {
      return nil, err
    }
    if transform != nil {
      out = append(out, transform)
    }
  }
  return out, nil
}

// registeredPlugin returns the plugin registered at position index, or
// (nil, false) when the index is out of range. Registration order matches
// the order of linked Go init() calls.
func registeredPlugin(index int) (any, bool) {
  if index < 0 || index >= len(pluginRegistry) {
    return nil, false
  }
  return pluginRegistry[index], true
}

// contextAt builds the PluginContext the driver passes to one plugin hook.
//
// Host-input observations are scoped per hook, because a hash one hook reported
// cannot prove another hook's dependency on the same path. Dependency
// declarations are scoped per plugin instead: completeness is a claim about
// everything one plugin contributes to a file, so the claims of its preamble
// and program hooks are the same plugin's claim and must not be attributed
// separately.
func (state linkedPluginState) contextAt(index int, entry PluginEntry) PluginContext {
  inputs := state.inputs.newScope()
  declaration := state.declarations.forPlugin(index)
  return PluginContext{
    Cwd:                            state.cwd,
    Entry:                          entry,
    Tsconfig:                       state.tsconfig,
    reportHostInput:                inputs.add,
    reportHostInputHash:            inputs.addHash,
    reportHostInputHashUnknown:     inputs.invalidateHash,
    reportHostInputRealpath:        inputs.addRealpath,
    reportHostInputRealpathUnknown: inputs.invalidateRealpath,
    reportFileDependency:           declaration.addDependency,
    reportFileDependencyRejected:   declaration.rejectDependency,
    reportFileComplete:             declaration.addComplete,
    reportEveryFileComplete:        declaration.completeEveryFile,
  }
}

// hostInputs returns the exact native configuration inputs reported in this
// generation.
func (state linkedPluginState) hostInputs() []string {
  return state.inputs.list()
}

func (state linkedPluginState) hostInputHashes() map[string]*string {
  return state.inputs.hashList()
}

func (state linkedPluginState) hostInputRealpaths() map[string]*string {
  return state.inputs.realpathList()
}

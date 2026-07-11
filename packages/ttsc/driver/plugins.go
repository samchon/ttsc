package driver

import (
  "encoding/json"
  "fmt"
  "os"
  "path/filepath"
  "strings"
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
  cwd      string
  entries  []PluginEntry
  tsconfig string
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
    return linkedPluginState{cwd: cwd, tsconfig: tsconfigPath}, nil
  }
  var entries []PluginEntry
  if err := json.Unmarshal([]byte(input), &entries); err != nil {
    return linkedPluginState{}, fmt.Errorf("ttsc driver: invalid %s: %w", LinkedPluginsEnv, err)
  }
  return linkedPluginState{
    cwd:      cwd,
    entries:  entries,
    tsconfig: tsconfigPath,
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
    text, err := preamble.SourcePreamble(state.context(entry))
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
    if err := transform.ApplyProgram(prog, state.context(entry)); err != nil {
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
    transform, err := emitter.EmitTransform(state.context(entry))
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

// context builds the PluginContext the driver passes to each plugin hook.
func (state linkedPluginState) context(entry PluginEntry) PluginContext {
  return PluginContext{
    Cwd:      state.cwd,
    Entry:    entry,
    Tsconfig: state.tsconfig,
  }
}

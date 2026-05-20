package driver

import (
  "encoding/json"
  "fmt"
  "os"
  "strings"
)

// LinkedPluginsEnv is the environment variable ttsc sets to pass the JSON
// manifest of linked plugins to a natively-linked host binary. The value is
// a JSON array of PluginEntry objects; an empty or absent value means no
// linked plugins are active.
const LinkedPluginsEnv = "TTSC_LINKED_PLUGINS_JSON"

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

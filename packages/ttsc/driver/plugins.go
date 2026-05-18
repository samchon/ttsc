package driver

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
)

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

func registeredPlugin(index int) (any, bool) {
	if index < 0 || index >= len(pluginRegistry) {
		return nil, false
	}
	return pluginRegistry[index], true
}

func (state linkedPluginState) context(entry PluginEntry) PluginContext {
	return PluginContext{
		Cwd:      state.cwd,
		Entry:    entry,
		Tsconfig: state.tsconfig,
	}
}

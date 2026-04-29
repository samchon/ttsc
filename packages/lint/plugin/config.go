package main

import (
	"encoding/json"
	"fmt"
	"strings"
)

// Severity is the `error | warning | off` ladder.
type Severity int

const (
	SeverityOff Severity = iota
	SeverityWarn
	SeverityError
)

func (s Severity) String() string {
	switch s {
	case SeverityError:
		return "error"
	case SeverityWarn:
		return "warning"
	case SeverityOff:
		return "off"
	}
	return "unknown"
}

// PluginEntry mirrors the shape ttsc serializes into `--plugins-json`.
//
// `Config` carries arbitrary fields from the tsconfig plugin entry,
// including `rules` for `@ttsc/lint`. `Mode` and `Name` come from the
// native descriptor.
type PluginEntry struct {
	Config          map[string]any `json:"config"`
	ContractVersion int            `json:"contractVersion"`
	Mode            string         `json:"mode"`
	Name            string         `json:"name"`
}

// ParsePlugins decodes the `--plugins-json` payload.
func ParsePlugins(text string) ([]PluginEntry, error) {
	if strings.TrimSpace(text) == "" {
		return nil, nil
	}
	var entries []PluginEntry
	if err := json.Unmarshal([]byte(text), &entries); err != nil {
		return nil, fmt.Errorf("@ttsc/lint: invalid --plugins-json: %w", err)
	}
	return entries, nil
}

// FindLintEntry returns the lint entry only when it is the first active
// plugin. Linting after a source-transforming plugin would inspect mutated
// source, which is not a meaningful user-code lint result.
func FindLintEntry(entries []PluginEntry) (*PluginEntry, error) {
	for i := range entries {
		if entries[i].Mode == "ttsc-lint" {
			if i != 0 {
				return nil, fmt.Errorf("@ttsc/lint must be the first active compilerOptions.plugins entry")
			}
			return &entries[i], nil
		}
	}
	return nil, nil
}

// RuleConfig captures the resolved per-rule severity. The map is keyed by
// rule name (e.g. "no-var").
type RuleConfig map[string]Severity

// ParseRules normalizes the `rules` map from a tsconfig plugin entry.
//
// Severity values:
//   - `"off"` → SeverityOff
//   - `"warning"` → SeverityWarn
//   - `"error"` → SeverityError
//
// Anything else returns an error (no silent fallback — typos in a rule
// severity should be loud).
func ParseRules(raw any) (RuleConfig, error) {
	if raw == nil {
		return RuleConfig{}, nil
	}
	dict, ok := raw.(map[string]any)
	if !ok {
		return nil, fmt.Errorf("@ttsc/lint: \"rules\" must be an object, got %T", raw)
	}
	out := make(RuleConfig, len(dict))
	for name, value := range dict {
		sev, err := parseSeverity(value)
		if err != nil {
			return nil, fmt.Errorf("@ttsc/lint: rule %q: %w", name, err)
		}
		out[name] = sev
	}
	return out, nil
}

func parseSeverity(v any) (Severity, error) {
	switch x := v.(type) {
	case string:
		switch x {
		case "off":
			return SeverityOff, nil
		case "warning", "warn":
			return SeverityWarn, nil
		case "error":
			return SeverityError, nil
		}
		return SeverityOff, fmt.Errorf("unknown severity %q (want off | warning | error)", x)
	case float64:
		switch x {
		case 0:
			return SeverityOff, nil
		case 1:
			return SeverityWarn, nil
		case 2:
			return SeverityError, nil
		}
		return SeverityOff, fmt.Errorf("unknown severity %v (want off | warning | error)", x)
	}
	return SeverityOff, fmt.Errorf("severity must be one of: off | warning | error, got %T", v)
}

// Severity returns the configured level for a rule, defaulting to
// `SeverityOff`. Rules opt in explicitly — silent on missing entries.
func (c RuleConfig) Severity(name string) Severity {
	if c == nil {
		return SeverityOff
	}
	return c[name]
}

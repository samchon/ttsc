package lint

import (
	"encoding/json"
	"fmt"
	"strings"
)

// Severity is the `error | warn | off` ladder. Numeric forms (0 / 1 / 2)
// are accepted to match ESLint's accepted shapes; anything else is a
// configuration error.
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
		return "warn"
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
	Config         map[string]any `json:"config"`
	ContractVersion int           `json:"contractVersion"`
	Mode           string         `json:"mode"`
	Name           string         `json:"name"`
}

// ParsePlugins decodes the `--plugins-json` payload. Returns the slice of
// entries (the lint plugin always sits at length-1 today, but the format
// supports ordered pipelines).
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

// FindLintEntry returns the first entry that matches the lint mode. Lint
// plugins never collide because every entry's mode is unique within a
// project.
func FindLintEntry(entries []PluginEntry) *PluginEntry {
	for i := range entries {
		if entries[i].Mode == "ttsc-lint" {
			return &entries[i]
		}
	}
	return nil
}

// RuleConfig captures the resolved per-rule severity. The map is keyed by
// rule name (e.g. "no-var").
type RuleConfig map[string]Severity

// ParseRules normalizes the `rules` map from a tsconfig plugin entry.
//
// Severity values:
//   - `"off"` / `0` → SeverityOff
//   - `"warn"` / `"warning"` / `1` → SeverityWarn
//   - `"error"` / `2` → SeverityError
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
		switch strings.ToLower(x) {
		case "off":
			return SeverityOff, nil
		case "warn", "warning":
			return SeverityWarn, nil
		case "error":
			return SeverityError, nil
		}
		return SeverityOff, fmt.Errorf("unknown severity %q (want off | warn | error)", x)
	case float64: // JSON numbers decode as float64
		switch int(x) {
		case 0:
			return SeverityOff, nil
		case 1:
			return SeverityWarn, nil
		case 2:
			return SeverityError, nil
		}
		return SeverityOff, fmt.Errorf("severity number must be 0/1/2, got %v", x)
	case bool:
		if x {
			return SeverityError, nil
		}
		return SeverityOff, nil
	}
	return SeverityOff, fmt.Errorf("severity must be string or number, got %T", v)
}

// Severity returns the configured level for a rule, defaulting to
// `SeverityOff`. Rules opt in explicitly — silent on missing entries.
func (c RuleConfig) Severity(name string) Severity {
	if c == nil {
		return SeverityOff
	}
	return c[name]
}

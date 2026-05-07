# Recipes

Short patterns for common plugin work. There is no high-level Go helper package yet; these snippets are the current reusable surface.

## Read Options from `--plugins-json`

```go
type PluginEntry struct {
	Config map[string]any `json:"config"`
	Mode   string         `json:"mode"`
	Name   string         `json:"name"`
}

func parsePlugins(text string) ([]PluginEntry, error) {
	var entries []PluginEntry
	if err := json.Unmarshal([]byte(text), &entries); err != nil {
		return nil, err
	}
	return entries, nil
}
```

The `Config` map is the original tsconfig plugin entry.

## Typed Config

For structured options, marshal the config map back into a typed struct:

```go
type Config struct {
	Banner string   `json:"banner"`
	Calls  []string `json:"calls"`
}

func decodeConfig(raw map[string]any) (Config, error) {
	var cfg Config
	bytes, _ := json.Marshal(raw)
	err := json.Unmarshal(bytes, &cfg)
	return cfg, err
}
```

Validate after decoding. Error loudly on wrong types.

## Multiple Modes

One binary can support several modes:

```go
func runModes(value string, plugins []PluginEntry) (string, error) {
	var (
		prefix    *PluginEntry
		uppercase bool
		suffix    *PluginEntry
	)
	for _, plugin := range plugins {
		switch plugin.Mode {
		case "prefix":
			entry := plugin
			prefix = &entry
		case "uppercase":
			uppercase = true
		case "suffix":
			entry := plugin
			suffix = &entry
		default:
			return "", fmt.Errorf("unsupported mode %q", plugin.Mode)
		}
	}
	if prefix != nil {
		value = stringOption(prefix.Config, "prefix") + value
	}
	if uppercase {
		value = strings.ToUpper(value)
	}
	if suffix != nil {
		value += stringOption(suffix.Config, "suffix")
	}
	return value, nil
}
```

When modes need to cooperate inside one transform emit pass, keep those modes in one native binary and dispatch by explicit `mode` values. Check plugins are independent diagnostics passes.

## Transform Plugin

Declare a transform plugin descriptor:

```js
module.exports = {
  name: "my-transform-plugin",
  source: path.resolve(__dirname, "go-plugin"),
  stage: "transform",
};
```

Implement:

```bash
my-plugin build --cwd=/project --tsconfig=/project/tsconfig.json --plugins-json='[...]'
```

Load the project, mutate TypeScript source AST, then let TypeScript-Go print JavaScript, declarations, and source maps.

## Check Plugin

Use `stage: "check"` for diagnostics before emit:

```js
module.exports = {
  name: "my-check-plugin",
  source: path.resolve(__dirname, "go-plugin"),
  stage: "check",
};
```

Implement:

```bash
my-plugin check --cwd=/project --tsconfig=/project/tsconfig.json --plugins-json='[...]'
```

Exit non-zero when error-severity diagnostics exist.

## Text Edits

Collect edits as offsets, then apply in reverse order:

```go
sort.SliceStable(edits, func(i, j int) bool {
	return edits[i].start > edits[j].start
})
```

Use `shimscanner.SkipTrivia` when the edit should start at the token, not leading comments or whitespace.

## Warnings

Write warnings to stderr and exit `0`:

```go
fmt.Fprintf(os.Stderr, "my-plugin: warning: ignored unknown option %q\n", key)
return 0
```

Write errors to stderr and exit non-zero:

```go
fmt.Fprintf(os.Stderr, "my-plugin: %s: invalid config\n", tsconfig)
return 2
```

## Source Maps

Prefer AST transforms and TypeScript-Go printing so source maps stay owned by the compiler. The public plugin contract does not provide generated JavaScript text as a source-map-bearing edit target.

## Watch Mode

`ttsc --watch` starts a fresh plugin process for each invocation. The source build cache avoids rebuilding the Go binary after the first run, but every rebuild still pays process startup and backend initialization. Keep state in files under `outDir` if needed; do not rely on process globals.

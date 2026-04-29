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

## Ordered Modes

One binary can support several modes:

```go
func runPipeline(value string, plugins []PluginEntry) (string, error) {
	for _, plugin := range plugins {
		switch plugin.Mode {
		case "prefix":
			value = stringOption(plugin.Config, "prefix") + value
		case "uppercase":
			value = strings.ToUpper(value)
		case "suffix":
			value += stringOption(plugin.Config, "suffix")
		default:
			return "", fmt.Errorf("unsupported mode %q", plugin.Mode)
		}
	}
	return value, nil
}
```

Consumer config order becomes execution order.

When modes need to cooperate inside the compiler backend, keep those modes in one native binary and dispatch over the ordered `--plugins-json` entries. Output and check plugins do not need to share that binary.

## Output Plugin

Use `capabilities: ["output"]` for post-emit edits:

```js
native: {
  mode: "my-output-plugin",
  source: { dir: path.resolve(__dirname, "go-plugin") },
  contractVersion: 1,
  capabilities: ["output"],
}
```

Implement:

```bash
my-plugin output --file=/project/dist/main.js --plugins-json='[...]'
```

Read the file, patch it, write it back. Output plugins can be combined with other output plugins; `ttsc` runs them after TypeScript-Go's normal emit path.

## Check Plugin

Use `capabilities: ["check"]` for diagnostics before emit:

```js
native: {
  mode: "my-check-plugin",
  source: { dir: path.resolve(__dirname, "go-plugin") },
  contractVersion: 1,
  capabilities: ["check"],
}
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

Prefer line-preserving edits. If the plugin substantially restructures JavaScript, it owns the source-map problem. Most output plugins should avoid that complexity.

## Watch Mode

`ttsc --watch` starts a fresh plugin process for each invocation. The source build cache avoids rebuilding the Go binary after the first run, but every rebuild still pays process startup and backend initialization. Keep state in files under `outDir` if needed; do not rely on process globals.

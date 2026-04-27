# Recipes: Common Patterns

Once you have a hello-world plugin running, these are the patterns that come up most often. Each recipe is short — pick the ones that match what you're building.

## Multi-mode dispatch

A single plugin binary that supports several behaviors. The consumer picks behavior per tsconfig entry; your binary dispatches by `mode` from `--plugins-json`.

```go
type Plugin struct {
    Config map[string]any `json:"config"`
    Mode   string         `json:"mode"`
    Name   string         `json:"name"`
}

func runOnePipeline(value string, plugins []Plugin) (string, error) {
    for _, p := range plugins {
        switch p.Mode {
        case "uppercase":
            value = strings.ToUpper(value)
        case "lowercase":
            value = strings.ToLower(value)
        case "prefix":
            value = stringConfig(p.Config, "prefix") + value
        case "suffix":
            value += stringConfig(p.Config, "suffix")
        default:
            return "", fmt.Errorf("unsupported mode %q", p.Mode)
        }
    }
    return value, nil
}

func stringConfig(c map[string]any, key string) string {
    if c == nil {
        return ""
    }
    v, _ := c[key].(string)
    return v
}
```

The consumer wires modes through tsconfig:

```json
{
  "compilerOptions": {
    "plugins": [
      { "transform": "my-plugin", "mode": "prefix", "prefix": "A:" },
      { "transform": "my-plugin", "mode": "uppercase" },
      { "transform": "my-plugin", "mode": "suffix", "suffix": ":Z" }
    ]
  }
}
```

`ttsc` ships these as one ordered array in `--plugins-json`. Apply them in order; that's how the consumer expresses "prefix-then-upper-then-suffix" without your binary knowing about pipeline ordering.

## Reading config from `--plugins-json`

The full tsconfig entry — including arbitrary user fields — flows through `config`:

```json
[
  {
    "name": "primary",
    "mode": "uppercase",
    "config": {
      "transform": "my-plugin",
      "name": "primary",
      "mode": "uppercase",
      "myCustomField": { "nested": true, "items": [1, 2, 3] }
    },
    "contractVersion": 1
  }
]
```

In Go, decode with `map[string]any` and assert types per field, or define a typed struct that matches the fields you care about:

```go
type MyPluginConfig struct {
    MyCustomField struct {
        Nested bool  `json:"nested"`
        Items  []int `json:"items"`
    } `json:"myCustomField"`
}

func parseMyConfig(raw map[string]any) (*MyPluginConfig, error) {
    bytes, _ := json.Marshal(raw)
    var cfg MyPluginConfig
    if err := json.Unmarshal(bytes, &cfg); err != nil {
        return nil, err
    }
    return &cfg, nil
}
```

`encoding/json` ignores fields it doesn't know about, so you only declare what you need. Don't error on unknown fields — `transform`, `name`, `mode`, `enabled` are all `ttsc`-managed extras the consumer didn't write themselves.

## Surfacing diagnostics back to `ttsc`

When your transform fails, write to stderr and exit non-zero. `ttsc` prints stderr verbatim to the user, so format it for human reading:

```go
fmt.Fprintf(os.Stderr, "my-plugin: %s:%d: invalid type argument %q (expected interface or type alias)\n", file, line, name)
return 2
```

Exit codes:

- `0` — success.
- `2` — argument or usage error (bad CLI flags, missing required input).
- Any other non-zero — runtime / transform error. `ttsc` treats these the same way; the only reason to differentiate is for your own debugging.

For *warnings* you want to surface but not fail on, write to stderr and still exit `0`. `ttsc` will print them; the consumer's build keeps going.

## Multi-file output (e.g., generated `.d.ts`)

The `transform` subcommand only writes one file. For project-wide builds you control your own file outputs through `runBuild`:

```go
func runBuild(args []string) int {
    // ... parse flags ...
    program, release, _ := bootstrap(cwd, tsconfigPath)
    defer release()

    for _, sourceFile := range program.SourceFiles() {
        if !shouldTransform(sourceFile) {
            continue
        }
        rewrittenJS, err := transformSourceFile(sourceFile)
        if err != nil { /* log and continue or fail */ }
        outPath := mapToOutPath(sourceFile.FileName(), outDir)
        os.MkdirAll(filepath.Dir(outPath), 0o755)
        os.WriteFile(outPath, []byte(rewrittenJS), 0o644)

        // Optional: emit a sidecar file
        if extra := generateSchema(sourceFile); extra != "" {
            os.WriteFile(strings.TrimSuffix(outPath, ".js")+".schema.json", []byte(extra), 0o644)
        }
    }
    return 0
}
```

`ttsc` invokes `build` once per project compile; you have free reign within `--outDir`. Don't write outside that directory — consumers expect their build artifacts to be confined there.

## Watch mode cooperation

`ttsc --watch` re-invokes your binary on every file change. There's nothing special you need to do — the cache makes re-invocations cheap (no re-build of your binary, just a fresh process). But:

- Don't keep state in global vars expecting it to persist across invocations. Each invocation is a fresh process.
- Don't write to the cache directory yourself. `ttsc` owns that path.
- If your transform is expensive (e.g., schema generation per file), you can use a content-addressed cache *inside* your output directory — write `<outDir>/.cache/<hash>.json` and check before regenerating. Just clean it up when the source goes away.

## Source maps (preserving consumer source maps)

`ttsc` itself runs `tsgo` for the actual TypeScript→JavaScript compile, including source maps. Your plugin transforms the *emitted JS*. If you do non-trivial line/column changes, the source map points at lines that no longer exist.

Two practical approaches:

- **Don't rewrite line counts.** Replace text in place with same-line content. The consumer's source map remains correct.
- **Emit your own source map.** If your transform substantially restructures the file, generate a `.js.map` next to the output and ship that. This is significant work; only do it if your plugin's transforms are too aggressive for line-preserving edits.

Most plugins (typia-class) emit imports + same-line call replacements and don't need source map generation.

## Ordered pipelines that span multiple plugins

When the consumer mixes `transform: "plugin-a"` and `transform: "plugin-b"` in their tsconfig, **they're not part of the same pipeline**. `ttsc` only collapses into one binary when entries point to the same `source.dir` (i.e., the same physical Go module). Different plugins → different binaries → `ttsc` rejects the project at config-parse time with `ordered native plugin pipeline requires a single native host binary`.

This is intentional. Cross-plugin composition is a project-architecture problem; one option is to publish a "meta-plugin" binary that other plugins integrate with at the source level. Another is to do plugin composition through tsgo's normal compiler-plugin chain (out of scope here).

For *within-plugin* pipelines (multiple modes, one binary), see [Multi-mode dispatch](#multi-mode-dispatch) above.

## Versioning a plugin against multiple `ttsc` minors

If your `peerDependencies` says `^0.4.0` and `ttsc` ships `0.5.0` with a renamed shim symbol, your plugin source breaks. Two strategies:

1. **Ship a new major.** Conservative — `your-plugin@2.x` for `ttsc@^0.5.x`, `your-plugin@1.x` for `ttsc@^0.4.x`. Consumers pin both.
2. **Conditional Go build with version detection.** Read `node_modules/ttsc/package.json` from the plugin manifest, branch based on version, point `source.dir` at different Go modules per ttsc-version. Complex; only worth it for plugins with very large deployed user bases.

Most plugins go with option 1. The cost (plugin major bump per ttsc minor that touches shim symbols you use) is real but bounded — the shim surface doesn't churn often within `contractVersion: 1`.

## Plugin doesn't need tsgo at all

Some plugins are pure source-text rewriters (custom JSX dialect, macro expansion, code-mod-style transforms). You don't have to import any shim. Your `go.mod` is just:

```
module my-plugin

go 1.26
```

No `require` lines, no `go.work` setup, no [04-local-dev.md](./04-local-dev.md) ceremony. Standalone `go build ./go-plugin` works on your machine without `ttsc` touching anything. Skip everything tsgo-related; come back when you outgrow regex.

# Getting Started: Smallest Useful Plugin

This page builds a post-emit output plugin. It prepends a comment to every emitted JavaScript and declaration file. This is intentionally simple: one manifest, one Go module, one `output` command.

After this works, read [AST and Checker](./03-tsgo.md) for source/AST/semantic plugins.

## 1. Create the Package

```text
ttsc-plugin-banner/
|- package.json
|- plugin.cjs
`- go-plugin/
   |- go.mod
   `- main.go
```

`package.json`:

```json
{
  "name": "ttsc-plugin-banner",
  "version": "0.1.0",
  "main": "plugin.cjs",
  "files": ["plugin.cjs", "go-plugin"],
  "peerDependencies": {
    "ttsc": "^0.4.0"
  },
  "engines": {
    "node": ">=18"
  }
}
```

The `files` field is not optional. Your Go source must ship in the npm tarball because `ttsc` builds it on the consumer machine.

## 2. Write the Manifest

`plugin.cjs`:

```js
const path = require("node:path");

module.exports = function createBannerPlugin() {
  return {
    name: "ttsc-plugin-banner",
    native: {
      mode: "ttsc-plugin-banner",
      source: {
        dir: path.resolve(__dirname, "go-plugin"),
      },
      contractVersion: 1,
      capabilities: ["output"],
    },
  };
};
```

Important fields:

- `name`: human-readable plugin name for errors and logs.
- `native.mode`: stable mode string passed to the binary.
- `native.source.dir`: absolute path to the Go module.
- `native.contractVersion`: currently `1`.
- `native.capabilities: ["output"]`: run after TypeScript-Go emits files.

## 3. Write the Go Module

`go-plugin/go.mod`:

```text
module ttsc-plugin-banner

go 1.26
```

This plugin does not import TypeScript-Go shims, so it needs no `require` lines.

## 4. Implement `output`

`go-plugin/main.go`:

```go
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type pluginEntry struct {
	Config map[string]any `json:"config"`
	Mode   string         `json:"mode"`
	Name   string         `json:"name"`
}

func main() {
	os.Exit(run(os.Args[1:]))
}

func run(args []string) int {
	if len(args) == 0 {
		fmt.Fprintln(os.Stderr, "ttsc-plugin-banner: command required")
		return 2
	}
	switch args[0] {
	case "version", "-v", "--version":
		fmt.Fprintln(os.Stdout, "ttsc-plugin-banner 0.1.0")
		return 0
	case "check":
		return 0
	case "output":
		return runOutput(args[1:])
	default:
		fmt.Fprintf(os.Stderr, "ttsc-plugin-banner: unknown command %q\n", args[0])
		return 2
	}
}

func runOutput(args []string) int {
	fs := flag.NewFlagSet("output", flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	file := fs.String("file", "", "emitted file to transform")
	out := fs.String("out", "", "optional output path")
	pluginsJSON := fs.String("plugins-json", "", "ttsc plugin metadata")
	_ = fs.String("cwd", "", "")
	_ = fs.String("outDir", "", "")
	_ = fs.String("rewrite-mode", "", "")
	_ = fs.String("tsconfig", "", "")
	if err := fs.Parse(args); err != nil {
		return 2
	}
	if *file == "" {
		fmt.Fprintln(os.Stderr, "ttsc-plugin-banner: output requires --file")
		return 2
	}

	config, err := findConfig(*pluginsJSON)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 2
	}

	text, err := os.ReadFile(*file)
	if err != nil {
		fmt.Fprintf(os.Stderr, "ttsc-plugin-banner: read %s: %v\n", *file, err)
		return 2
	}
	patched, err := applyBanner(*file, string(text), config)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 2
	}

	target := *file
	if *out != "" {
		target = *out
	}
	if err := os.MkdirAll(filepath.Dir(target), 0o755); err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 2
	}
	if err := os.WriteFile(target, []byte(patched), 0o644); err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 2
	}
	return 0
}

func applyBanner(fileName, text string, config map[string]any) (string, error) {
	if !isOutputFile(fileName) {
		return text, nil
	}
	banner, ok := config["banner"].(string)
	if !ok || strings.TrimSpace(banner) == "" {
		return "", fmt.Errorf(`ttsc-plugin-banner: "banner" must be a non-empty string`)
	}
	if !strings.HasSuffix(banner, "\n") {
		banner += "\n"
	}
	if strings.HasPrefix(text, banner) {
		return text, nil
	}
	return banner + text, nil
}

func findConfig(pluginsJSON string) (map[string]any, error) {
	var entries []pluginEntry
	if err := json.Unmarshal([]byte(pluginsJSON), &entries); err != nil {
		return nil, fmt.Errorf("ttsc-plugin-banner: invalid --plugins-json: %w", err)
	}
	for _, entry := range entries {
		if entry.Mode == "ttsc-plugin-banner" || entry.Name == "ttsc-plugin-banner" {
			return entry.Config, nil
		}
	}
	return nil, fmt.Errorf("ttsc-plugin-banner: plugin entry not found")
}

func isOutputFile(fileName string) bool {
	lower := strings.ToLower(fileName)
	if strings.HasSuffix(lower, ".map") || strings.HasSuffix(lower, ".tsbuildinfo") {
		return false
	}
	switch strings.ToLower(filepath.Ext(fileName)) {
	case ".js", ".mjs", ".cjs":
		return true
	default:
		return strings.HasSuffix(lower, ".d.ts") ||
			strings.HasSuffix(lower, ".d.mts") ||
			strings.HasSuffix(lower, ".d.cts")
	}
}
```

What matters:

- `output` receives an emitted file, not the original `.ts` source.
- `--plugins-json` carries the original tsconfig plugin entry, including `banner`.
- Unknown flags are ignored by declaring them even when unused.
- The transform is idempotent.

## 5. Use It

Consumer install:

```bash
npm i -D ttsc @typescript/native-preview /path/to/ttsc-plugin-banner
```

Consumer `tsconfig.json`:

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "rootDir": "src",
    "outDir": "dist",
    "declaration": true,
    "plugins": [
      {
        "transform": "ttsc-plugin-banner",
        "banner": "/*! built by ttsc */"
      }
    ]
  },
  "include": ["src"]
}
```

Run:

```bash
npx ttsc --emit
```

The first run builds and caches the Go binary. Later runs reuse it until the plugin source, `ttsc` version, TypeScript-Go version, platform, or source entry changes.

## Next Step

For a production-quality version of this exact shape, read [`packages/banner`](../packages/banner/). For AST-based edits, continue to [AST and Checker](./03-tsgo.md).

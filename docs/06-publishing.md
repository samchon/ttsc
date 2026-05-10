# Publishing Plugins

A plugin is one npm package containing a JS manifest and Go source.

For publishing this repository's `ttsc`, `@ttsc/*`, and platform packages, see [Workspace Release](./12-workspace-release.md).

## `package.json`

```json
{
  "name": "my-ttsc-plugin",
  "version": "0.1.0",
  "description": "What the plugin does.",
  "main": "plugin.cjs",
  "ttsc": {
    "plugin": {
      "transform": "my-ttsc-plugin"
    }
  },
  "files": ["plugin.cjs", "go-plugin"],
  "engines": {
    "node": ">=18"
  },
  "keywords": ["ttsc", "ttsc-plugin", "tsgo"],
  "license": "MIT"
}
```

`ttsc.plugin` is a single object, not an array. One package contributes one auto-discovered plugin entry. If the consumer also writes a `compilerOptions.plugins[]` entry with the same `transform`, the `tsconfig.json` entry wins.

## Required Package Contents

The tarball must include:

- `plugin.cjs` or the built JS manifest entry;
- the Go source directory;
- `go.mod`;
- `go.sum`, when present;
- `README.md` and license.

Verify before publish:

```bash
npm pack --dry-run
```

The tarball contains `go-plugin/main.go`; `ttsc` builds that source on the consumer machine.

## Dependencies

Published plugin packages carry their JS manifest and Go source, while the consumer project supplies `ttsc` and the active `@typescript/native-preview` runtime.

Plugin `go.mod` files use `require` lines for host modules. `ttsc` owns `github.com/samchon/ttsc/packages/ttsc`, `github.com/microsoft/typescript-go`, and `github.com/microsoft/typescript-go/shim/...` through its build overlay. Plugin-specific wrappers live under the plugin's own Go module.

## Versioning

Practical rule:

| Change                                     | Bump  |
| ------------------------------------------ | ----- |
| bug fix                                    | patch |
| new mode or option                         | minor |
| removed mode or changed transform contract | major |
| newly verified `ttsc` compatibility        | minor |
| dropped old `ttsc` minor support           | major |

Your package version is separate from the `ttsc` plugin protocol.

## Pre-Publish Check

Run at minimum:

```bash
go test ./go-plugin/...
npm pack --dry-run
```

Then install the packed tarball into a clean fixture and run:

```bash
npm i -D ttsc @typescript/native-preview ./my-ttsc-plugin-0.1.0.tgz
npx ttsc --emit
```

For plugins that import shims or touch paths, test Linux and macOS. Add Windows when you compare path strings or support Windows users.

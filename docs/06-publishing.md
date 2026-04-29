# Publishing

A plugin is one npm package containing a JS manifest and Go source.

## `package.json`

```json
{
  "name": "my-ttsc-plugin",
  "version": "0.1.0",
  "description": "What the plugin does.",
  "main": "plugin.cjs",
  "files": ["plugin.cjs", "go-plugin"],
  "peerDependencies": {
    "ttsc": "^0.4.0"
  },
  "engines": {
    "node": ">=18"
  },
  "keywords": ["ttsc", "ttsc-plugin", "tsgo"],
  "license": "MIT"
}
```

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

If the tarball does not contain `go-plugin/main.go`, consumers will fail with `native.source.dir does not exist` or a Go build error.

## Dependencies

Use `peerDependencies` for `ttsc`:

```json
"peerDependencies": {
  "ttsc": "^0.4.0"
}
```

Do not put `ttsc` in `dependencies`; that can install a second host copy in the consumer project.

Do not declare `@typescript/native-preview` as your plugin peer. The consumer installs it for `ttsc`, and `ttsc` supplies the matching shim/build overlay.

## Versioning

Practical rule:

| Change | Bump |
| --- | --- |
| bug fix | patch |
| new mode or option | minor |
| removed mode or changed output contract | major |
| newly verified `ttsc` minor range | minor |
| dropped old `ttsc` minor support | major |

`native.contractVersion` is not your package version. Keep it at `1` until `ttsc` introduces a new protocol.

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

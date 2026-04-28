# Publishing Your Plugin to npm

Your plugin is one npm package containing JS manifest + Go source. Publishing it is mostly the same as any other npm package, with a few `ttsc`-specific gotchas around what ships in the tarball and how to express compatibility.

## `package.json` essentials

```json
{
  "name": "ttsc-plugin-uppercase",
  "version": "0.1.0",
  "description": "Uppercases goUpper(\"...\") string literals.",
  "main": "plugin.cjs",
  "files": [
    "plugin.cjs",
    "go-plugin"
  ],
  "peerDependencies": {
    "ttsc": "^0.4.0"
  },
  "engines": {
    "node": ">=18"
  },
  "keywords": ["ttsc", "ttsc-plugin", "tsgo"],
  "repository": "github:you/ttsc-plugin-uppercase",
  "license": "MIT"
}
```

### `files` is the most common mistake

Anything not listed in `files` (and not in npm's default-included set) **does not ship**. Forgetting `go-plugin` is the #1 cause of "native.source.dir does not exist" on a fresh install. Always include:

- The JS manifest entry (`plugin.cjs` here).
- The entire Go source directory (`go-plugin/`).
- `README.md`, `LICENSE` (npm includes these by default but listing is fine).

Run `npm pack --dry-run` before publishing — npm prints exactly what will go into the tarball. Eyeball the list. If `go-plugin/main.go` isn't there, your consumers can't build the plugin.

### `peerDependencies` for `ttsc`

Pin a range against the `ttsc` minor your plugin was tested against. Within a `contractVersion: 1` window you can usually allow `^` (caret) ranges; bump the range when you've actually verified against the next minor.

```json
"peerDependencies": {
  "ttsc": "^0.4.0"
}
```

Don't list `ttsc` in `dependencies` — that would force consumers to install a duplicate copy. Don't list it in `devDependencies` either; the consumer is already installing `ttsc` themselves. Peer is the correct relationship.

### `@typescript/native-preview` is *not* your peer dep

Even though your plugin transitively depends on `tsgo` symbols, you do **not** declare `@typescript/native-preview` as a peer. The consumer installs it for `ttsc`'s sake and that single copy is what your plugin's `go.work` overlay points at. Adding it to your `peerDependencies` would create version-pinning friction without benefit.

### `engines.node`

Match `ttsc`'s own minimum (`>=18`). You don't need to be stricter unless your manifest's JS uses features beyond that.

## Versioning policy

A practical rule of thumb for plugin authors:

| Change | Bump |
| --- | --- |
| Bug fix in transform logic | patch |
| New mode (additive in `--plugins-json` dispatch) | minor |
| Renamed/removed mode | major |
| Tightened tsconfig requirements (e.g. now requires `strict: true`) | minor or major depending on how many consumers break |
| Bumped `peerDependencies` range for `ttsc` | minor (this is a compat hint, not a behavior change) |
| Removed support for an older `ttsc` minor | major |

`contractVersion` (in your manifest's `native` object) is the *protocol* version, not your plugin's. You don't bump it; `ttsc` does. As long as `ttsc` reports `contractVersion: 1`, your plugin keeps the value at `1`.

## Pre-publish checklist

- `npm pack --dry-run` shows `plugin.cjs` and `go-plugin/main.go` (and `go.mod`/`go.sum` if your plugin has them) in the tarball.
- A clean install (`mkdir /tmp/x && cd /tmp/x && npm init -y && npm i -D ttsc /path/to/your/plugin.tgz`) produces a working `npx ttsc --emit` against a sample tsconfig that lists your plugin.
- Your plugin's compiled binary actually runs on your target platform. Cross-platform: test at minimum on Linux + macOS; Windows if you're brave (CI matrix is the easy way).
- Versioning: if you've removed a mode or changed a transform's behavior, the version bump reflects it.
- Documentation: a `README.md` with at least a one-paragraph "what does this plugin do" + a tsconfig snippet showing how a consumer enables it.

## Publish

```bash
npm publish
```

That's it. Consumers install with `npm i -D <your-plugin>` and add `{ "transform": "<your-plugin>" }` to their `compilerOptions.plugins`.

## Beta / next-tag releases

When you're iterating quickly:

```bash
npm version prerelease --preid=beta
npm publish --tag beta
```

Consumers opt in with `npm i -D your-plugin@beta`. Keep the `latest` tag pointing at a known-good version — `ttsc`'s plugin error messages name your plugin, but they don't help when the breakage is in the `latest` tag.

## What happens on the consumer's first install

For context (so you know what to test for):

1. `npm i -D your-plugin` puts your tarball under `node_modules/your-plugin/`.
2. The consumer adds `{ "transform": "your-plugin" }` to `compilerOptions.plugins`.
3. The first `npx ttsc` invocation reads your `plugin.cjs`, hashes your Go source, and runs `go build` with `ttsc`'s bundled Go compiler against `ttsc`'s pinned shim.
4. The compiled binary lands in `node_modules/.ttsc/plugins/<sha>/plugin` (or `.ttsc/plugins/<sha>/plugin` when the project has no `node_modules/`) and is reused on subsequent invocations.

If your tarball is missing `go-plugin/`, step 3 fails immediately with `native.source.dir does not exist`. That's the single biggest pre-publish thing to verify.

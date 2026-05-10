# ttsx Runtime

`ttsx` runs a TypeScript entrypoint after TypeScript-Go type checking. Use it when you want a runner like `tsx` or `ts-node`, but you still want compiler diagnostics before the program starts.

## Install

```bash
npm install -D ttsc @typescript/native-preview
```

The `ttsc` package provides both CLI commands:

- `ttsc`: build, check, watch, and transform.
- `ttsx`: type-check, compile to a cache, then execute one entrypoint.

## Run

```bash
npx ttsx src/index.ts
```

Pass arguments to the entrypoint after `--`:

```bash
npx ttsx src/server.ts -- --port 3000
```

Use an explicit project file when the entrypoint should not use the nearest `tsconfig.json`:

```bash
npx ttsx --project tsconfig.runtime.json src/index.ts
```

## Options

| Option                   | Meaning                                                 |
| ------------------------ | ------------------------------------------------------- |
| `-P, --project <file>`   | Use an explicit `tsconfig.json`.                        |
| `--cwd <dir>`            | Resolve the entrypoint and project from this directory. |
| `--cache-dir <dir>`      | Override the runtime and source-plugin cache root.      |
| `--binary <path>`        | Use an explicit TypeScript-Go binary.                   |
| `-r, --require <module>` | Preload a module before the entrypoint.                 |
| `-h, --help`             | Show help.                                              |
| `-v, --version`          | Print the runner version.                               |

## Plugins

`ttsx` uses the same project config and installed `ttsc` plugins as `ttsc`. Check plugins can stop the run before the entrypoint starts. Transform plugins run before the cached JavaScript is executed.

## Cache

`ttsx` writes compiled JavaScript and source-plugin binaries under its cache root for the current run. Use `--cache-dir` for an explicit location, or `npx ttsc clean` when you need to clear source-plugin build cache entries used by the shared host.

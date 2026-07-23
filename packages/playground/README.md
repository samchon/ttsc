# @ttsc/playground

> **API stability: experimental until v1.0.** Public signatures (the `createWorkerCompiler` options, `ICompilerService` contract, React component props) may change between minor releases. Pin exact versions in production playgrounds.

Reusable Web Worker + React scaffolding for in-browser [`ttsc`](https://ttsc.dev) playgrounds. Built on top of [`@ttsc/wasm`](https://github.com/samchon/ttsc/tree/master/packages/wasm).

The package handles the parts every browser playground needs, worker boot, MemFS layout, race-guarded compile / lint / bundle calls, on-the-fly npm dependency installer, typia source-pack mounting, console-capturing execute sandbox, and ships a Tailwind-styled React shell that wires them all up. Sites supply the wasm URL, a default script, and (optionally) examples, brand slot, and an execute callback.

The ttsc website (`ttsc.dev`) and the typia website (`typia.io`) are the two reference consumers.

## Install

```bash
npm install @ttsc/playground @ttsc/wasm \
  @monaco-editor/react monaco-editor react react-dom tgrid tailwindcss
```

`@monaco-editor/react`, `monaco-editor`, `react`, `react-dom`, `tgrid`, and `@ttsc/wasm` are **peer dependencies**. `lz-string` is bundled.

The React components use Tailwind 4 utility classes. See [Tailwind setup](#tailwind-setup) below.

## What you get

| Layer | Exports |
| --- | --- |
| **Worker core** | `createWorkerCompiler`, `buildTsconfigJSON`, `installDependenciesIntoMemFS`, `mapDiagnostic`, `pickEmittedJS`, `DEFAULT_*` constants |
| **Typia integration** | `createTypiaSourcePackMount`, `installTypiaSourcePack`, `loadTypiaSourcePack` |
| **Npm installer** | `installPlaygroundDependencies`, `collectExternalPackageNames`, `packageNameFromSpecifier`, `BUILT_IN_PLAYGROUND_PACKAGES` |
| **Execute sandbox** | `createSandboxRequire`, `loadTypiaRuntimePack` |
| **React UI** | `PlaygroundShell`, `SourceEditor`, `ResultViewer`, `ConsoleViewer`, `OptionsPanel`, `DiagnosticsPanel`, `DependencyProgressModal`, `ExamplePicker`, `LintPane`, `createCompilerClient`, `DEFAULT_OPTION_TOGGLES` |
| **Types** | Everything under `./src/structures/` |

## Architecture

```
┌─ Browser tab ───────────────────────────────────────────┐
│                                                         │
│  <PlaygroundShell>            ─── tgrid RPC ───┐        │
│      ↳ SourceEditor (Monaco)                   │        │
│      ↳ ResultViewer                            ▼        │
│      ↳ ConsoleViewer                  ┌────────────────┐│
│      ↳ DiagnosticsPanel               │  Web Worker    ││
│      ↳ DependencyProgressModal        │                ││
│      ↳ ExamplePicker                  │  createWorker  ││
│      ↳ OptionsPanel                   │   Compiler()   ││
│      ↳ LintPane                       │       ↓        ││
│                                       │  @ttsc/wasm    ││
│  (UI installs runtime npm deps        │   bootTtsc()   ││
│   into the same worker MemFS via      │       ↓        ││
│   service.installDependencies())      │  MemFS         ││
│                                       │   └─ /work/…   ││
│                                       │  ttsc.wasm     ││
│                                       └────────────────┘│
└─────────────────────────────────────────────────────────┘
```

## Worker entry (site-side)

The worker entry is two lines. Wire the wasm URL the site ships and the `apiName` you used in `host.Expose` when you built the wasm.

```ts
// site/src/compiler/index.ts (rspack target: "webworker")
import { createWorkerCompiler } from "@ttsc/playground";
import { WorkerServer } from "tgrid";

const service = createWorkerCompiler({
  wasmUrl: "/compiler/playground.wasm",
  wasmExecUrl: "/compiler/wasm_exec.js",
  apiName: "ttscPlayground",
});

await new WorkerServer().open(service);
```

Bundle this file with rspack/webpack/vite as a webworker target and serve the output (e.g. at `/compiler/index.js`).

## UI shell (site-side)

```tsx
// site/src/components/playground/PlaygroundShell.tsx
"use client";
import { PlaygroundShell } from "@ttsc/playground";
import { PLAYGROUND_DEFAULT_SCRIPT, PLAYGROUND_EXAMPLES } from "../...";

export default function SitePlayground() {
  return (
    <PlaygroundShell
      workerUrl="/compiler/index.js"
      defaultScript={PLAYGROUND_DEFAULT_SCRIPT}
      examples={PLAYGROUND_EXAMPLES}
      brand={<a href="/">my-site</a>}
      executeBundle={async (code, sandbox) => {
        // run the compiled JS however you like; route console.* into sandbox.console
        new Function("console", code)(sandbox.console);
      }}
    />
  );
}
```

## Typia integration (optional)

When the wasm bundles the typia transform plugin, mount typia's source tree into the MemFS so `import typia from "typia"` resolves:

```ts
import {
  createTypiaSourcePackMount,
  createWorkerCompiler,
} from "@ttsc/playground";

const service = createWorkerCompiler({
  wasmUrl: "/compiler/playground.wasm",
  apiName: "ttscPlayground",
  typiaPlugin: {
    name: "typia",
    transformModule: "typia/lib/transform",
    mount: createTypiaSourcePackMount({
      url: "/compiler/typia-pack.json",
    }),
  },
});
```

The typia pack itself is built by the site (typically with a `pack-typia-sources.cjs`-style script that bundles `typia/`, `@typia/utils`, and `@typia/interface` into a flat JSON map). See the ttsc website's [`build/pack-typia-sources.cjs`](https://github.com/samchon/ttsc/blob/master/website/build/pack-typia-sources.cjs) for the reference implementation.

## Runtime npm dependency installer

When the user types `import {v4} from "uuid"`, the shell auto-fetches `uuid` (and its transitive deps) from the npm registry, unpacks the tgz in the browser, and mounts the files into the wasm MemFS, no proxy server needed.

Discovery covers static quoted specifiers in imports, exports, dynamic imports, `require(...)`, and direct `require?.(...)` calls, using their cooked JavaScript string values while ignoring comments, regular expressions, template quasis, and computed arguments.

```ts
import {
  collectExternalPackageNames,
  installPlaygroundDependencies,
} from "@ttsc/playground";

const names = collectExternalPackageNames(userSource);
const installed = await installPlaygroundDependencies(names, {
  maxTarballBytes: 16 * 1024 * 1024,
  maxUnpackedBytes: 64 * 1024 * 1024,
  onProgress: (p) => console.log(p.phase, p.packageName),
});
// mount installed.compilerFiles into the wasm MemFS via service.installDependencies
```

For an additive edit, pass the prior call's `resolvedDependencies` as `installedDependencies`; the installer validates every new range against the mounted registry identity and exact version, and it returns only newly downloaded tarballs in `packages` plus the complete updated exact state in `resolvedDependencies`.

When a direct source import is removed, solve the complete current root list without `installedDependencies` and atomically replace the compiler, editor, and runtime file maps so files from the obsolete graph cannot survive.

`PlaygroundShell` wires this automatically on every keystroke, debounced 900 ms, with an abort signal on source change.

The installer verifies the strongest supported `dist.integrity` digest before decompression, or `dist.shasum` when integrity is absent. Historical and private registry metadata with neither field remains compatible but unauthenticated. Each tarball is streamed through independent compressed and expanded byte limits (16 MiB and 64 MiB by default), and every file must remain below one safe, consistent archive root (`package/` normally; DefinitelyTyped uses roots such as `node/`). Override the limits with `maxTarballBytes` and `maxUnpackedBytes` when a known package requires more.

Integrity proves that archive bytes match registry metadata; it does not establish that package code is safe. `createSandboxRequire` is a CommonJS resolver and evaluator, not an origin, process, or capability sandbox. The byte limits protect installation availability, not runtime behavior such as loops, timers, network access, or globals exposed by the host. Sites accepting untrusted code or packages must provide an isolated `executeBundle` policy appropriate to their environment.

The Execute lane's CommonJS resolver treats `package.json#exports` as the package boundary. It selects `require` and `default` conditions in manifest order, preserves Node's distinction between target selection and file loading, validates relative targets after wildcard substitution, and rejects mixed or numeric condition maps. A package mounted through an npm alias may still self-reference its real manifest `name` when it declares exports; packages without exports keep legacy direct-path resolution and do not gain self-reference behavior.

## Tailwind setup

The bundled React components use Tailwind 4 utility classes. The host site must load Tailwind for them to render correctly.

`postcss.config.mjs`:

```js
const config = { plugins: { "@tailwindcss/postcss": {} } };
export default config;
```

`src/app/global.css`:

```css
@import "tailwindcss";

/* Tell Tailwind 4 to scan @ttsc/playground's compiled output for utility
   classes. Tailwind 4's @source takes a literal glob relative to this
   CSS file — adjust the leading `../` segments to match how deep the
   CSS file lives. Tailwind 4 follows the pnpm symlink at
   node_modules/@ttsc/playground transparently. */
@source "../../node_modules/@ttsc/playground/lib/**/*.js";
```

Then `import "./global.css"` from the root layout.

**`@ttsc/playground` must be a direct dependency** of the consuming package. Tailwind only scans paths the consumer points at. A transitively-installed copy (where @ttsc/playground is a dep of another package) lives under a different node_modules layout and the glob above won't find it without explicit re-targeting.

## Booting a custom wasm

`createWorkerCompiler` is plugin-agnostic. To register a custom plugin set:

1. Write a Go `main_wasm.go` that calls `host.Expose("myApi", host.Config{ Plugins: [...] })`. See [`@ttsc/wasm`](https://github.com/samchon/ttsc/tree/master/packages/wasm) for the host helper and the plugin contract.
2. Build the wasm with `GOOS=js GOARCH=wasm go build`.
3. Ship the wasm at any URL and pass it to `createWorkerCompiler({wasmUrl, apiName})`.

If the wasm registers plugins other than typia / `@ttsc/lint`, pass `typiaPlugin: false` / `lintPlugin: false` to skip those default dispatchers and use your own toggles via `optionToggles` + a custom worker wrapper.

## Conventions

- **One type per file.** Public interfaces / types each live under `src/structures/` in a file named after the type. The barrel `structures/index.ts` re-exports everything.
- **One public function per file.** Internal helpers may be grouped in `compiler/internal/` or `npm/internal/`.
- **No sub-path exports.** Every public symbol is importable from the package root. Add a sub-path later only when a real consumer needs to avoid pulling React into a Node-only context.

## Documents

See the [hosted playground guide](https://ttsc.dev/docs/playground) for the consumer-facing tour of the ttsc.dev playground this package powers.

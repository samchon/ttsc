# @ttsc/playground

`@ttsc/playground` contains browser-side helpers for building a dependency-aware
ttsc playground.

Use it when a playground needs to inspect a pasted TypeScript source file,
discover bare package imports, download the matching npm tarballs, unpack the
package files, and feed declaration files into an editor while mounting the
same package tree into a wasm-backed compiler.

## Install

```bash
pnpm add @ttsc/playground
```

## Minimal Flow

```ts
import {
  collectExternalPackageNames,
  installPlaygroundDependencies,
} from "@ttsc/playground";

const packages = collectExternalPackageNames(source);
const installed = await installPlaygroundDependencies(packages, {
  onProgress: (event) => renderProgress(event),
});

// Mount these under /work/node_modules before compiling.
installed.compilerFiles;

// Add these to Monaco or another TypeScript editor.
installed.editorLibs;

// Merge these into the Execute sandbox's CommonJS require pack.
installed.runtimeFiles;
```

The helper intentionally performs no DOM work. Applications own the modal,
editor integration, and compiler RPC transport.

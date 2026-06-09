# Experimental Source-Map Check

This check proves that `ttsc` emits a correct JavaScript source map when a real `typia` transform expands a one-line call into a large generated validator.

It builds local `.tgz` packages, installs them plus `typia` into a temporary npm project, compiles a source file whose single `typia.is<IMember>(input)` call typia rewrites into many lines, and then verifies that the emitted `dist/main.js` and `dist/main.js.map` satisfy:

- the `.js` ends with a `//# sourceMappingURL=main.js.map` trailer;
- the `.js` actually contains typia's expanded validator (the transform ran);
- the `.js.map` is valid JSON with `version: 3`;
- the `.js.map` lists the original `main.ts` as a source;
- the `.js.map` has a non-empty `mappings` string and a `file` pointing at the emitted JavaScript.

The `typia` version is pinned to match `website/package.json`.

Run:

```bash
npm run start
```

To reuse already-built tarballs:

```bash
npm run start -- --skip-pack
```

To pack only `ttsc` and the current platform package before running the check:

```bash
npm run start -- --pack-current
```

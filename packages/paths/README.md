# `@ttsc/paths`

`@ttsc/paths` rewrites emitted module specifiers that match
`compilerOptions.paths` into relative JavaScript paths.

```jsonc
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@lib/*": ["./src/modules/*"]
    },
    "plugins": [{ "transform": "@ttsc/paths" }]
  }
}
```

The plugin reads `paths`, `rootDir`, and `outDir` from the same `tsconfig.json` that `ttsc` compiles. No separate plugin config is required.
The package owns its native implementation under `packages/paths/go-plugin` and
runs as an output plugin after `ttsc` emits JavaScript and declarations.

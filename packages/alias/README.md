# `@ttsc/alias`

`@ttsc/alias` rewrites emitted module specifiers that match
`compilerOptions.paths` into relative JavaScript paths.

```jsonc
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@lib/*": ["./src/modules/*"]
    },
    "plugins": [{ "transform": "@ttsc/alias" }]
  }
}
```

The plugin reads `paths`, `rootDir`, and `outDir` from the same `tsconfig.json`
that `ttsc` compiles. No separate plugin config is required.

# `@ttsc/banner`

`@ttsc/banner` prepends a fixed comment to emitted JavaScript and declaration
files during `ttsc` builds.

```jsonc
{
  "compilerOptions": {
    "plugins": [
      {
        "transform": "@ttsc/banner",
        "banner": "/*! @license MIT (c) 2026 Acme */"
      }
    ]
  }
}
```

The package owns its native implementation under `packages/banner/go-plugin`.
It can be used with `@ttsc/lint`, `@ttsc/paths`, and `@ttsc/strip`; `ttsc`
runs output plugins after emit in `compilerOptions.plugins` order.

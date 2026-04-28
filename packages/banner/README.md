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

The plugin shares the first-party `ttsc` native host with `@ttsc/lint`,
`@ttsc/alias`, and `@ttsc/strip`, so those plugins can be used together in one
ordered pipeline.

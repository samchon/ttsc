# `@ttsc/strip`

`@ttsc/strip` removes configured call-expression statements and debugger
statements from emitted JavaScript.

```jsonc
{
  "compilerOptions": {
    "plugins": [
      {
        "transform": "@ttsc/strip",
        "calls": ["console.log", "console.debug", "assert.*"],
        "statements": ["debugger"]
      }
    ]
  }
}
```

Only explicit patterns are removed. The plugin is not a minifier or dead-code-elimination pass.
The package owns its native implementation under `packages/strip/go-plugin` and
runs as an output plugin after `ttsc` emits JavaScript.

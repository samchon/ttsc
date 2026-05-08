# Tarballs

Built `.tgz` packages for local installation checks.

Generate them from the repository root:

```bash
pnpm run package:tgz
```

The tarballs are consumed by `experimental/install` and `experimental/test-unplugin` smoke checks.

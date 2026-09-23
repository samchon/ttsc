# Tarballs

Built `.tgz` packages for local installation checks.

Generate them from the repository root:

```bash
pnpm run package:tgz
```

The tarballs are consumed by `experimental/install` and `experimental/test-unplugin` smoke checks.

`--current` (or `TTSC_TARBALLS_CURRENT=1`) packs only the current platform and the packages the PR smoke checks consume, which is what `typia.yml` and `nestia.yml` run.

# Research Review Round 2 Proposals

1. Complete LSP header-size hardening with chunked header reads.
2. Extend `ttsx` cleanup to all post-prepare failure points.
3. Update docs for `ttsx` temporary runtime emit and paths source lookup.
4. Split newly added Go regression assertions into one-case-per-file tests.
5. Preserve explicit banner `text` over nested `default`, while keeping nested
   default interop support.
6. Return copies from MemFS reads and defer wasm capture temp cleanup.
7. Rework `no-loss-of-precision` to keep the documented precision-loss contract.
8. Add a test for `ttsc --version` executable-bit repair.
9. Defer blocked `editorOut` cleanup and Windows junction follow-up until a
   focused test can reproduce them.

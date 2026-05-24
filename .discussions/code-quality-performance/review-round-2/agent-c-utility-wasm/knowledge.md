# Agent C Utility/Wasm Notes

Scope: current diff for banner, paths, wasm host, and MemFS. No source edits.

## Findings

1. Accept: banner JS/TS default unwrapping should stop when the current object
   already has a string `text`, otherwise `{ text, default }` is silently
   replaced by the nested default.

2. Accept: paths helper tests should not seed legacy extensionless pseudo source
   entries after `newRewriter` stopped creating them.

3. Accept: `MemFS.readFile()` should return a copy, matching the new inbound
   `writeFile()` copy.

4. Accept: `runWithCapturedIO` should defer temp-file close/remove after temp
   files are created so panics do not leak capture files.

5. Defer: Windows junction fallback needs Windows CI validation.

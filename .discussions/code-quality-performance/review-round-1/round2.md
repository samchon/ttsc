# Round 2 Transcript

Lead: Rechecking proposals against architecture constraints: no consumer-specific
behavior in compiler host, no weakened plugin cache correctness, and no broad
refactors without focused tests.

Agent 2: `ttsx` project cleanup should remove only `cacheDir/project/<pid>`,
not `cacheDir/plugins`, preserving source-plugin binary reuse.

Agent 3: Permission preservation needs validation against Go semantics. Existing
fix paths truncate existing files; `os.WriteFile` does not chmod an existing
file merely because the provided mode is `0644`.

Agent 4: Unplugin mtime/size optimization could be correct but requires a
metadata-plus-hash design. It should not be slipped into a mixed round.

Agent 5: Adding `test:go` changes the default test contract, but it wires in
already-existing runners rather than adding new behavior.

Agent 6: Website playground changes can be valuable, but the current round is
mostly compiler/runtime/package hardening.

Lead: Accepted proposals are narrowed to observable correctness, resource
cleanup, runner integrity, and isolated hardening.

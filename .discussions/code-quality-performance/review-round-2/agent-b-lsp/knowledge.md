# Agent B LSP Notes

Scope: current LSP diff and changed LSP tests only. No source edits.

## Findings

1. Accept: the initial `MaxHeaderBytes` check used `ReadString('\n')`, so a
   newline-free huge header line could allocate before rejection. Replace with
   chunked `ReadSlice('\n')` and add a no-newline oversize test.

2. Defer: hard-error cleanup may not unblock a pump already blocked writing to
   `editorOut`. Add a focused blocked-writer reproduction before deciding
   whether to close `editorOut` as well.

## Accepted

- Empty `IDKey()` skip in `rememberCodeActionRequest` and `augmentUpstream` is
  sound.
- `driver.MaxHeaderBytes` re-export is reasonable.

## Validation

- Agent validation: `go test ./test/driver -run TestLSP -count=1` passed.

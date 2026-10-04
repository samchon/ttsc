package lspserver

import (
  "encoding/json"
  "errors"
  "io"
  "slices"
  "strings"
  "testing"
)

// TestNativeReplyPolicies verifies native reply byte retention and decoding
// directly, without a sidecar, native artifact, process or source constructor.
//
// The buffer cases retain the exact stdout and stderr limits and distinguish
// a full accepted payload from an additional discarded byte. JSON cases own
// rich/legacy diagnostics, direct-edit admission and changes-only edits. They
// also own first-command precedence, action admission, stdin/argv projection
// and result error formatting. Ordered command/kind observations retain
// discovery sequencing and parse-failure gates with supplied operation inputs.
// They do not certify actual pipe transport,
// discovered ownership or child argv/exit status. Resident/direct routing is
// checked with ordinary operation inputs, without claiming a native peer.
//
// @evidence contracts/testing.md#behavioral-verification Calls the actual buffer/decoders/edit predicate and production-used action, registry, stdin/argv, result and resident/direct policies; exact limits, values, guard order, first owner, supplied-error formatting and retry order are asserted.
// @evidence contracts/testing.md#independent-expectations Literal 4MiB/1MiB limits, authored JSON fields, marker text and null/direct-edit controls establish expectations independently of native producers or decoder outputs.
// @evidence contracts/testing.md#distinguishing-cases Named groups distinguish exact/overflow bytes, rich/legacy/malformed JSON, absent/null/direct edits, first/duplicate commands, absent/empty/nonempty buffers, context admission, outcome precedence and resident served-error versus optional direct retry and static bypass.
// @evidence contracts/testing.md#execution-ownership This untagged Go Test calls production-used in-process operations in the owning lspserver package. Ordinary supplied resident/direct operations observe routing only; it creates no Program, host, child or artifact and does not certify native failure acquisition or transport receipt.
func TestNativeReplyPolicies(t *testing.T) {
  t.Run("stdout_exact_limit_and_overflow", func(t *testing.T) {
    prefix := `[{"range":{"start":{"line":0,"character":0},"end":{"line":0,"character":0}},"source":"ttsc/fake","message":"`
    suffix := `"}]`
    padding := strings.Repeat("x", 4*1024*1024-len(prefix)-len(suffix))
    payload := prefix+padding+suffix
    buffer := limitedBuffer{limit: nativePluginCommandStdoutLimit}
    if n, err := buffer.Write([]byte(payload)); n != 4*1024*1024 || err != nil { t.Fatalf("exact stdout write = %d, %v", n, err) }
    if buffer.truncated || buffer.Len() != 4*1024*1024 || buffer.String() != payload { t.Fatal("exact-limit stdout was truncated or changed") }
    result, err := decodeNativeDiagnostics(buffer.Bytes())
    if err != nil || len(result.Document) != 1 { t.Fatalf("exact-limit diagnostic decode = %#v, %v", result, err) }
    if result.Document[0].Source != "ttsc/fake" || result.Document[0].Message != padding { t.Fatal("exact-limit diagnostic padding changed") }
    if n, err := buffer.Write([]byte("!")); n != 1 || err != nil { t.Fatalf("overflow write = %d, %v", n, err) }
    if !buffer.truncated || buffer.Len() != 4*1024*1024 || buffer.String() != payload { t.Fatal("stdout overflow changed the retained prefix") }
  })
  t.Run("stderr_single_write_overflow", func(t *testing.T) {
    buffer := limitedBuffer{limit: nativePluginCommandStderrLimit}
    payload := strings.Repeat("x", 1024*1024)+"tail"
    if n, err := buffer.Write([]byte(payload)); n != 1024*1024+4 || err != nil { t.Fatalf("stderr write = %d, %v", n, err) }
    if !buffer.truncated || buffer.Len() != 1024*1024 || buffer.String() != strings.Repeat("x", 1024*1024) { t.Fatal("stderr limit did not retain exactly its prefix") }
  })
  t.Run("original_oversized_reply_literals", func(t *testing.T) {
    plugin := NativeLSPPluginEntry{Name: "@ttsc/fake"}
    stdout := limitedBuffer{limit: nativePluginCommandStdoutLimit}
    stderr := limitedBuffer{limit: nativePluginCommandStderrLimit}
    if n, err := stdout.Write([]byte(strings.Repeat("x", 6*1024*1024))); n != 6*1024*1024 || err != nil { t.Fatalf("6 MiB stdout write = %d, %v", n, err) }
    if !stdout.truncated || stdout.String() != strings.Repeat("x", 4*1024*1024) { t.Fatal("6 MiB stdout did not retain its exact 4 MiB prefix") }
    if body, err := nativePluginCommandResult(plugin, "lsp-code-actions", nil, &stdout, &stderr); body != nil || err == nil || err.Error() != "ttscserver: @ttsc/fake lsp-code-actions produced more than 4194304 bytes on stdout" { t.Errorf("6 MiB result = %q, %v", body, err) }
    if n, err := stderr.Write([]byte(strings.Repeat("x", 2*1024*1024))); n != 2*1024*1024 || err != nil { t.Fatalf("2 MiB stderr write = %d, %v", n, err) }
    if !stderr.truncated || stderr.String() != strings.Repeat("x", 1024*1024) { t.Fatal("2 MiB stderr did not retain its exact 1 MiB prefix") }
    body, err := nativePluginCommandResult(plugin, "lsp-code-actions", errors.New("exit status 1"), &stdout, &stderr)
    expected := "ttscserver: @ttsc/fake lsp-code-actions failed: "+strings.Repeat("x", 1024*1024)+" (stderr truncated)"
    if body != nil || err == nil || err.Error() != expected || len(err.Error()) > 1024*1024+4096 { t.Error("2 MiB failure lost its exact retained prefix, truncation marker or error bound") }
  })
  t.Run("diagnostics_rich_legacy_and_invalid", func(t *testing.T) {
    for _, body := range []string{
      `[{"source":"ttsc/fake","code":"fake-rule","message":"marker"}]`,
      `{"document":[{"source":"ttsc/fake","code":"fake-rule","message":"marker"}],"project":{"uri":"file:///logical/tsconfig.json","diagnostics":[{"code":"project-rule","message":"project"}]}}`,
    } {
      result, err := decodeNativeDiagnostics([]byte(body))
      if err != nil || len(result.Document) != 1 { t.Errorf("diagnostic decode = %#v, %v", result, err); continue }
      if result.Document[0].Source != "ttsc/fake" || result.Document[0].Code != "fake-rule" || result.Document[0].Message != "marker" { t.Error("document diagnostic literals changed") }
      if strings.HasPrefix(body, "{") && (result.Project == nil || result.Project.URI != "file:///logical/tsconfig.json" || len(result.Project.Diagnostics) != 1 || result.Project.Diagnostics[0].Code != "project-rule") { t.Error("rich project publication lost") }
      if strings.HasPrefix(body, "[") && result.Project != nil { t.Error("legacy diagnostics invented project publication") }
    }
    if _, err := decodeNativeDiagnostics([]byte(`{"document":`)); err == nil { t.Error("invalid diagnostics JSON accepted") }
  })
  t.Run("direct_edit_and_workspace_shape", func(t *testing.T) {
    for _, raw := range []json.RawMessage{nil, json.RawMessage(""), json.RawMessage(" \nnull\t")} {
      if hasDirectCodeActionEdit(raw) { t.Errorf("absent/null edit rejected: %q", raw) }
    }
    for _, raw := range []json.RawMessage{json.RawMessage(`{}`), json.RawMessage(`{"changes":{}}`)} {
      if !hasDirectCodeActionEdit(raw) { t.Errorf("direct edit admitted: %q", raw) }
    }
    plugin := NativeLSPPluginEntry{Name: "literal"}
    for _, suffix := range []string{"", `,"documentChanges":null`} {
      edit, err := decodeNativeLSPWorkspaceEdit(plugin, []byte(`{"changes":{"file:///tmp/a.ts":[{"newText":"let"}]}`+suffix+`}`))
      if err != nil || edit == nil || len(edit.Changes["file:///tmp/a.ts"]) != 1 || edit.Changes["file:///tmp/a.ts"][0].NewText != "let" { t.Errorf("changes-only edit = %#v, %v", edit, err) }
    }
    for _, body := range []string{`{"documentChanges":[]}`, `{"documentChanges":[{}]}`} {
      if _, err := decodeNativeLSPWorkspaceEdit(plugin, []byte(body)); err == nil || !strings.Contains(err.Error(), "unsupported WorkspaceEdit.documentChanges") { t.Errorf("documentChanges rejection = %v", err) }
    }
    if _, err := decodeNativeLSPWorkspaceEdit(plugin, []byte(`{"changes":`)); err == nil { t.Error("malformed edit JSON accepted") }
  })
  t.Run("action_admission_order", func(t *testing.T) {
    for _, row := range []struct { name string; action LSPCodeAction; owned bool; want string; calls int }{
      {"null", LSPCodeAction{Edit: json.RawMessage(`null`), Command: &LSPCommand{Command: "ttsc.fake.fix"}}, true, "", 1},
      {"direct", LSPCodeAction{Edit: json.RawMessage(`{}`)}, true, `ttscserver: literal returned direct LSP edit for action ""; command-backed actions are required`, 0},
      {"commandless", LSPCodeAction{}, true, `ttscserver: literal returned commandless LSP action ""; command-backed actions are required`, 0},
      {"unowned", LSPCodeAction{Command: &LSPCommand{Command: "ttsc.fake.other"}}, false, `ttscserver: literal returned unowned LSP command "ttsc.fake.other"`, 1},
    } {
      t.Run(row.name, func(t *testing.T) {
        calls := 0
        got := nativeCodeActionRejection(NativeLSPPluginEntry{Name: "literal"}, row.action, func(command string) bool { calls++; if command != row.action.Command.Command { t.Errorf("command = %q", command) }; return row.owned })
        if got != row.want || calls != row.calls { t.Errorf("admission = %q, calls %d; want %q, %d", got, calls, row.want, row.calls) }
      })
    }
  })
  t.Run("first_command_owner", func(t *testing.T) {
    seen := map[string]struct{}{}
    owners := map[string]NativeLSPPluginEntry{}
    ids := []string{}
    first := NativeLSPPluginEntry{Name: "first", Binary: "first-sidecar"}
    second := NativeLSPPluginEntry{Name: "second", Binary: "second-sidecar"}
    if accepted, warning := registerNativeCommandID("", first, seen, &ids, owners); accepted || warning != "" { t.Error("empty command was registered") }
    if accepted, warning := registerNativeCommandID("ttsc.fake.fix", first, seen, &ids, owners); !accepted || warning != "" { t.Error("first command rejected") }
    if accepted, warning := registerNativeCommandID("ttsc.fake.fix", second, seen, &ids, owners); accepted || warning != `ttscserver: duplicate LSP command id "ttsc.fake.fix" from second ignored` { t.Errorf("duplicate command warning = %q", warning) }
    if !slices.Equal(ids, []string{"ttsc.fake.fix"}) || len(owners) != 1 || owners["ttsc.fake.fix"].Name != "first" || owners["ttsc.fake.fix"].Binary != "first-sidecar" { t.Fatal("first command owner/order changed") }
  })
  t.Run("ordered_command_and_kind_observations", func(t *testing.T) {
    ids, kinds, calls, messages := []string{}, []string{}, []string{}, []string{}
    owners := map[string]NativeLSPPluginEntry{}
    plugins := []NativeLSPPluginEntry{{Name: "first"}, {Name: "malformed"}, {Name: "failed"}, {Name: "second"}}
    discoverNativeCommandRegistry(plugins, func(plugin NativeLSPPluginEntry, command string) ([]byte, error) {
      calls = append(calls, plugin.Name+"/"+command)
      switch plugin.Name {
      case "first":
        if command == "lsp-command-ids" { return []byte(`["","ttsc.fake.fix","ttsc.fake.fix"]`), nil }
        return []byte(`["","source.fixAll.ttsc","source.fixAll.ttsc"]`), nil
      case "malformed": return []byte(`{`), nil
      case "failed": return nil, errors.New("supplied command observation failure")
      case "second":
        if command == "lsp-command-ids" { return []byte(`["ttsc.fake.fix","ttsc.fake.other"]`), nil }
        return []byte(`["source.fixAll.ttsc","refactor.rewrite"]`), nil
      }
      t.Fatalf("unexpected input %q", plugin.Name)
      return nil, nil
    }, func(message string) { messages = append(messages, message) }, &ids, &kinds, owners)
    expectedCalls := []string{"first/lsp-command-ids", "first/lsp-code-action-kinds", "malformed/lsp-command-ids", "failed/lsp-command-ids", "second/lsp-command-ids", "second/lsp-code-action-kinds"}
    if !slices.Equal(calls, expectedCalls) { t.Errorf("discovery order = %v", calls) }
    if !slices.Equal(ids, []string{"ttsc.fake.fix", "ttsc.fake.other"}) || owners["ttsc.fake.fix"].Name != "first" || owners["ttsc.fake.other"].Name != "second" || len(owners) != 2 { t.Error("ordered command ownership changed") }
    if !slices.Equal(kinds, []string{"source.fixAll.ttsc", "refactor.rewrite"}) { t.Errorf("ordered kinds = %v", kinds) }
    if len(messages) != 4 { t.Fatalf("discovery messages = %v", messages) }
    if messages[0] != `ttscserver: duplicate LSP command id "ttsc.fake.fix" from first ignored` || !strings.HasPrefix(messages[1], "ttscserver: malformed lsp-command-ids returned invalid JSON: ") || messages[2] != "supplied command observation failure" || messages[3] != `ttscserver: duplicate LSP command id "ttsc.fake.fix" from second ignored` { t.Errorf("discovery messages = %v", messages) }
  })
  t.Run("command_input_and_context_tokens", func(t *testing.T) {
    for _, row := range []struct { name, text string; present bool }{{"present", "const buffered = 1;", true}, {"empty_present", "", true}, {"absent", "", false}} {
      t.Run(row.name, func(t *testing.T) {
        args, stdin, err := nativeExecuteCommandInput("ttsc.format.document", []json.RawMessage{json.RawMessage(`"file:///tmp/a.ts"`)}, row.text, row.present)
        expected := []string{"--command=ttsc.format.document", `--arguments-json=["file:///tmp/a.ts"]`}
        if row.present { expected = append(expected, "--content-stdin") }
        if err != nil || !slices.Equal(args, expected) || (stdin != nil) != row.present { t.Fatalf("input = %v, reader %v, %v", args, stdin != nil, err) }
        if stdin != nil { bytes, err := io.ReadAll(stdin); if err != nil || string(bytes) != row.text { t.Errorf("stdin = %q, %v", bytes, err) } }
      })
    }
    if _, _, err := nativeExecuteCommandInput("ttsc.format.document", []json.RawMessage{json.RawMessage(`{`)}, "", false); err == nil || !strings.Contains(err.Error(), "encode command arguments") { t.Error("invalid argument JSON admitted") }
    context := `{"logicalConfigPath":"/logical/tsconfig.json","mode":"strict"}`
    extra := []string{"--uri=file:///tmp/a.ts"}
    expected := []string{"lsp-diagnostics", "--cwd=/physical root", "--tsconfig=/physical root/tsconfig.json", "--plugins-json=[]", "--project-context-json="+context, "--uri=file:///tmp/a.ts"}
    actual := nativePluginCommandArgs(NativeLSPPluginEntry{ProjectContextArgs: true}, "lsp-diagnostics", "/physical root", "/physical root/tsconfig.json", "[]", context, extra)
    if !slices.Equal(actual, expected) { t.Errorf("context argv = %v", actual) }
    for _, row := range []struct { enabled bool; context string }{{false, context}, {true, " \n"}} {
      omitted := nativePluginCommandArgs(NativeLSPPluginEntry{ProjectContextArgs: row.enabled}, "lsp-diagnostics", "/physical root", "/physical root/tsconfig.json", "[]", row.context, extra)
      if !slices.Equal(omitted, []string{expected[0], expected[1], expected[2], expected[3], expected[5]}) { t.Errorf("unadmitted context argv = %v", omitted) }
    }
    if !slices.Equal(extra, []string{"--uri=file:///tmp/a.ts"}) { t.Error("extra argv input mutated") }
  })
  t.Run("result_precedence_and_stderr_format", func(t *testing.T) {
    plugin := NativeLSPPluginEntry{Name: "literal"}
    stdout := limitedBuffer{limit: nativePluginCommandStdoutLimit}
    stderr := limitedBuffer{limit: nativePluginCommandStderrLimit}
    _, _ = stdout.Write([]byte(" \n[]\t"))
    result, err := nativePluginCommandResult(plugin, "lsp-code-actions", nil, &stdout, &stderr)
    if err != nil || string(result) != "[]" { t.Errorf("success result = %q, %v", result, err) }
    _, _ = stdout.Write([]byte(strings.Repeat("x", nativePluginCommandStdoutLimit)))
    if _, err := nativePluginCommandResult(plugin, "lsp-code-actions", nil, &stdout, &stderr); err == nil || err.Error() != "ttscserver: literal lsp-code-actions produced more than 4194304 bytes on stdout" { t.Errorf("stdout overflow = %v", err) }
    _, _ = stderr.Write([]byte(strings.Repeat("x", 1024*1024)+"tail"))
    _, err = nativePluginCommandResult(plugin, "lsp-code-actions", errors.New("exit status 7"), &stdout, &stderr)
    expected := "ttscserver: literal lsp-code-actions failed: "+strings.Repeat("x", 1024*1024)+" (stderr truncated)"
    if err == nil || err.Error() != expected || len(err.Error()) > 1024*1024+4096 { t.Error("failed result stderr prefix/limit/precedence changed") }
    emptyStderr := limitedBuffer{limit: nativePluginCommandStderrLimit}
    if _, err := nativePluginCommandResult(plugin, "lsp-code-actions", errors.New("exit status 7"), &stdout, &emptyStderr); err == nil || err.Error() != "ttscserver: literal lsp-code-actions failed: exit status 7" { t.Errorf("empty stderr fallback = %v", err) }
  })
  t.Run("resident_direct_selection", func(t *testing.T) {
    residentError := errors.New("resident unsupported")
    directError := errors.New("direct failure")
    for _, row := range []struct {
      command string
      served bool
      residentErr error
      directErr error
      expected []string
      expectedErr error
      directBody bool
    }{
      {"lsp-diagnostics", true, nil, nil, []string{"resident"}, nil, false},
      {"lsp-code-actions", true, residentError, nil, []string{"resident"}, residentError, false},
      {"lsp-diagnostics", false, residentError, nil, []string{"resident", "direct"}, nil, true},
      {"lsp-project-diagnostics", true, residentError, nil, []string{"resident", "direct"}, nil, true},
      {"lsp-project-diagnostics", true, nil, nil, []string{"resident"}, nil, false},
      {"lsp-hints", false, nil, directError, []string{"resident", "direct"}, directError, true},
      {"lsp-hints", true, residentError, nil, []string{"resident", "direct"}, nil, true},
      {"lsp-command-ids", true, nil, nil, []string{"direct"}, nil, true},
      {"lsp-code-action-kinds", true, nil, nil, []string{"direct"}, nil, true},
      {"lsp-execute-command", true, nil, nil, []string{"direct"}, nil, true},
    } {
      t.Run(row.command+"/"+strings.Join(row.expected, "-"), func(t *testing.T) {
        args := []string{"literal source", "--opaque={}"}
        calls := []string{}
        residentBody := []byte("resident-body")
        directBody := []byte(`{"uri":"file:///project/tsconfig.json","diagnostics":[{"code":"direct"}]}`)
        got, err := runNativePluginRead(row.command, args,
          func(command string, supplied []string) ([]byte, bool, error) {
            calls = append(calls, "resident")
            if command != row.command || !slices.Equal(supplied, []string{"literal source", "--opaque={}"}) { t.Fatal("resident command/args changed") }
            return residentBody, row.served, row.residentErr
          },
          func(command string, supplied []string) ([]byte, error) {
            calls = append(calls, "direct")
            if command != row.command || !slices.Equal(supplied, []string{"literal source", "--opaque={}"}) { t.Fatal("direct command/args changed") }
            return directBody, row.directErr
          },
        )
        if !slices.Equal(calls, row.expected) || err != row.expectedErr { t.Fatalf("routing = %v, %v", calls, err) }
        expectedBody := residentBody
        if row.directBody { expectedBody = directBody }
        if len(got) != len(expectedBody) || &got[0] != &expectedBody[0] { t.Fatal("selected body identity changed") }
        if row.directBody && string(got) != `{"uri":"file:///project/tsconfig.json","diagnostics":[{"code":"direct"}]}` { t.Fatal("direct publication bytes changed") }
        if !slices.Equal(args, []string{"literal source", "--opaque={}"}) { t.Fatal("caller arguments changed") }
      })
    }
    for _, noArgs := range [][]string{nil, {}} {
      calls := []string{}
      got, err := runNativePluginRead("lsp-project-diagnostics", noArgs,
        func(command string, supplied []string) ([]byte, bool, error) {
          calls = append(calls, "resident")
          if command != "lsp-project-diagnostics" || len(supplied) != 0 || (supplied == nil) != (noArgs == nil) { t.Fatal("resident empty args changed") }
          return nil, true, residentError
        },
        func(command string, supplied []string) ([]byte, error) {
          calls = append(calls, "direct")
          if command != "lsp-project-diagnostics" || len(supplied) != 0 || (supplied == nil) != (noArgs == nil) { t.Fatal("direct empty args changed") }
          return []byte(`{"uri":"file:///project/tsconfig.json","diagnostics":[{"code":"direct"}]}`), nil
        },
      )
      if err != nil || !slices.Equal(calls, []string{"resident", "direct"}) || string(got) != `{"uri":"file:///project/tsconfig.json","diagnostics":[{"code":"direct"}]}` { t.Fatal("optional empty-args fallback changed") }
    }
  })
  t.Run("resident_nonzero_reply_policy", func(t *testing.T) {
    plugin := NativeLSPPluginEntry{Name: "@ttsc/staged"}
    body, code, err := decodeNativeResidentReply([]byte(`{"result":null,"code":2}`))
    if err != nil || string(body) != "null" || code != 2 { t.Fatalf("resident negative decode = %q, %d, %v", body, code, err) }
    result, served, err := nativeResidentResult(plugin, "lsp-project-diagnostics", body, code)
    if result != nil || !served || err == nil || err.Error() != "ttscserver: @ttsc/staged lsp-project-diagnostics (resident) exit 2" { t.Fatalf("resident negative result = %q, %v, %v", result, served, err) }
    directCalls := 0
    got, fallbackErr := runNativePluginRead("lsp-project-diagnostics", nil,
      func(command string, args []string) ([]byte, bool, error) { return nativeResidentResult(plugin, command, body, code) },
      func(command string, args []string) ([]byte, error) { directCalls++; if command != "lsp-project-diagnostics" || args != nil { t.Error("fallback input changed") }; return []byte(`{"uri":"file:///project/tsconfig.json","diagnostics":[{"code":"direct"}]}`), nil })
    if fallbackErr != nil || directCalls != 1 || string(got) != `{"uri":"file:///project/tsconfig.json","diagnostics":[{"code":"direct"}]}` { t.Errorf("resident negative fallback = %q, calls %d, %v", got, directCalls, fallbackErr) }
    for _, verb := range []string{"lsp-hints", "lsp-diagnostics", "lsp-code-actions"} {
      calls := 0
      result, err := runNativePluginRead(verb, nil,
        func(command string, args []string) ([]byte, bool, error) { return nativeResidentResult(plugin, command, body, code) },
        func(command string, args []string) ([]byte, error) { calls++; if command != verb || args != nil { t.Error("verb fallback input changed") }; return []byte("direct hint observation"), nil })
      if verb == "lsp-hints" {
        if err != nil || calls != 1 || string(result) != "direct hint observation" { t.Errorf("hints negative fallback = %q, %d, %v", result, calls, err) }
      } else if calls != 0 || result != nil || err == nil || err.Error() != "ttscserver: @ttsc/staged "+verb+" (resident) exit 2" { t.Errorf("document served error = %q, %d, %v", result, calls, err) }
    }
    successBody, successCode, successErr := decodeNativeResidentReply([]byte(`{"result":[{"code":"direct"}],"code":0}`))
    if successErr != nil || successCode != 0 || string(successBody) != `[{"code":"direct"}]` { t.Fatal("resident success JSON changed") }
    accepted, wasServed, successErr := nativeResidentResult(plugin, "lsp-diagnostics", successBody, successCode)
    if successErr != nil || !wasServed || len(accepted) != len(successBody) || len(accepted) == 0 || &accepted[0] != &successBody[0] { t.Error("resident success result reference changed") }
    if _, _, err := decodeNativeResidentReply([]byte(`{"result":`)); err == nil { t.Error("malformed resident JSON admitted") }
    if _, _, err := decodeNativeResidentReply([]byte(`{"result":"`+strings.Repeat("x", 4*1024*1024)+`","code":0}`)); err == nil || err.Error() != "resident result exceeds 4194304 bytes" { t.Errorf("resident result overflow = %v", err) }
  })
}

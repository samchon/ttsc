package lspserver

import (
  "bytes"
  "encoding/json"
  "fmt"
  "io"
  "strings"
)

// nativeCodeActionRejection reports the first admission failure. Ownership is
// queried only after direct edits and absent commands have been rejected.
// Common: The ordered guards and failure messages retain the source's
// command-backed action policy; the caller owns logging and aggregation. The lookup
// is the source's actual command owner, not a transport or producer substitute.
// Cost includes edit bytes and the delegated ownership lookup; no state is retained.
func nativeCodeActionRejection(plugin NativeLSPPluginEntry, action LSPCodeAction, owns func(string) bool) string {
  if hasDirectCodeActionEdit(action.Edit) { return fmt.Sprintf("ttscserver: %s returned direct LSP edit for action %q; command-backed actions are required", pluginLabel(plugin), action.Title) }
  if action.Command == nil { return fmt.Sprintf("ttscserver: %s returned commandless LSP action %q; command-backed actions are required", pluginLabel(plugin), action.Title) }
  if !owns(action.Command.Command) { return fmt.Sprintf("ttscserver: %s returned unowned LSP command %q", pluginLabel(plugin), action.Command.Command) }
  return ""
}

// registerNativeCommandID records the first producer of a nonempty command.
// It distinguishes empty input from a duplicate so the caller preserves its
// original command order and duplicate log without another discovery pass.
// Common: The first-seen map establishes precedence; explicit owner values
// retain the real discovery input. Maps belong to the source and are modified
// in place, with one lookup and at most two insertions per identifier.
func registerNativeCommandID(id string, plugin NativeLSPPluginEntry, seen map[string]struct{}, commandIDs *[]string, owners map[string]NativeLSPPluginEntry) (accepted bool, warning string) {
  if id == "" { return false, "" }
  if _, ok := seen[id]; ok { return false, fmt.Sprintf("ttscserver: duplicate LSP command id %q from %s ignored", id, pluginLabel(plugin)) }
  seen[id] = struct{}{}
  *commandIDs = append(*commandIDs, id)
  owners[id] = plugin
  return true, ""
}

// discoverNativeCommandRegistry retains transport order, first command ownership
// and first nonempty action kinds. A failed or malformed command observation
// skips that transport's kind query; a failed kind observation retains commands
// already registered. Common: The source supplies its actual query and log
// operations. Supplied bytes own parsing policy only, not native acquisition.
// JSON work follows reply bytes and registration follows identifiers; delegated
// queries and logging retain their costs. Maps and ordered slices remain owned
// by the source, and this call adds no process or memoized discovery result.
func discoverNativeCommandRegistry(plugins []NativeLSPPluginEntry, query func(NativeLSPPluginEntry, string) ([]byte, error), log func(string), commandIDs, codeActionKinds *[]string, owners map[string]NativeLSPPluginEntry) {
  seen := map[string]struct{}{}
  kindSeen := map[string]struct{}{}
  for _, plugin := range plugins {
    body, err := query(plugin, "lsp-command-ids")
    if err != nil { log(fmt.Sprintf("%v", err)); continue }
    var ids []string
    if err := json.Unmarshal(body, &ids); err != nil { log(fmt.Sprintf("ttscserver: %s lsp-command-ids returned invalid JSON: %v", pluginLabel(plugin), err)); continue }
    for _, id := range ids {
      _, warning := registerNativeCommandID(id, plugin, seen, commandIDs, owners)
      if warning != "" { log(warning) }
    }
    body, err = query(plugin, "lsp-code-action-kinds")
    if err != nil { log(fmt.Sprintf("%v", err)); continue }
    var kinds []string
    if err := json.Unmarshal(body, &kinds); err != nil { log(fmt.Sprintf("ttscserver: %s lsp-code-action-kinds returned invalid JSON: %v", pluginLabel(plugin), err)); continue }
    for _, kind := range kinds {
      if kind == "" { continue }
      if _, ok := kindSeen[kind]; ok { continue }
      kindSeen[kind] = struct{}{}
      *codeActionKinds = append(*codeActionKinds, kind)
    }
  }
}

// nativeExecuteCommandInput encodes command arguments and the live-buffer gate.
// An empty present buffer still supplies a reader and --content-stdin; absence
// supplies neither. Invalid raw JSON keeps the original encoding error.
// Common: One projection retains command/argument tokens and buffer presence
// separately. It manufactures no reply and invokes no process. Encoding cost
// follows argument bytes; the returned slice and reader transfer to the caller.
func nativeExecuteCommandInput(command string, args []json.RawMessage, content string, hasContent bool) ([]string, io.Reader, error) {
  argsJSON, encodeErr := json.Marshal(args)
  if encodeErr != nil { return nil, nil, fmt.Errorf("ttscserver: encode command arguments: %w", encodeErr) }
  cmdArgs := []string{"--command="+command, "--arguments-json="+string(argsJSON)}
  var stdin io.Reader
  if hasContent {
    cmdArgs = append(cmdArgs, "--content-stdin")
    stdin = strings.NewReader(content)
  }
  return cmdArgs, stdin, nil
}

// nativePluginCommandArgs projects native path and opaque JSON inputs to argv.
// Project context is forwarded only for an admitting plugin and nonblank input.
// Common: Argument tokens retain command/cwd/config/plugin JSON order without
// shell parsing or path rewriting. The caller supplies actual selection values;
// this function does not authenticate them. Cost and returned allocation follow
// token bytes and count, with no cached result or process resource retained.
func nativePluginCommandArgs(plugin NativeLSPPluginEntry, command, cwd, tsconfig, pluginsJSON, projectContextJSON string, args []string) []string {
  allArgs := []string{command, "--cwd="+cwd, "--tsconfig="+tsconfig, "--plugins-json="+pluginsJSON}
  if plugin.ProjectContextArgs && strings.TrimSpace(projectContextJSON) != "" { allArgs = append(allArgs, "--project-context-json="+projectContextJSON) }
  return append(allArgs, args...)
}

// nativeSidecarContext selects nonblank supplied physical context fields while
// leaving client spelling with the caller. Common: It validates JSON shape but
// does not establish filesystem identity or prove the producer's physical claim.
// Parsing/scanning follows context bytes; returned strings own no native handle.
func nativeSidecarContext(cwd, tsconfig string, context json.RawMessage) (string, string, error) {
  if len(context) > 0 {
    var identity struct {
      PhysicalConfigPath string `json:"physicalConfigPath"`
      PhysicalProjectRoot string `json:"physicalProjectRoot"`
    }
    if err := json.Unmarshal(context, &identity); err != nil { return "", "", fmt.Errorf("ttscserver: decode project context: %w", err) }
    if strings.TrimSpace(identity.PhysicalProjectRoot) != "" { cwd = identity.PhysicalProjectRoot }
    if strings.TrimSpace(identity.PhysicalConfigPath) != "" { tsconfig = identity.PhysicalConfigPath }
  }
  return cwd, tsconfig, nil
}

// nativePluginCommandResult adapts the actual Run outcome and bounded buffers.
// A failed command uses stderr or the returned error, marking retained stderr
// at its limit. Successful stdout overflow is rejected before bytes are served.
// Common: Outcome precedence and byte limits are the source's existing policy;
// supplied buffers do not certify an OS execution. Trim/copy costs follow the
// retained bytes, bounded by their buffer owners. No process is started or held.
func nativePluginCommandResult(plugin NativeLSPPluginEntry, command string, runErr error, stdout, stderr *limitedBuffer) ([]byte, error) {
  if runErr != nil {
    msg := strings.TrimSpace(stderr.String())
    if msg == "" { msg = runErr.Error() } else if stderr.truncated || stderr.Len() >= nativePluginCommandStderrLimit { msg += " (stderr truncated)" }
    return nil, fmt.Errorf("ttscserver: %s %s failed: %s", pluginLabel(plugin), command, msg)
  }
  if stdout.truncated { return nil, fmt.Errorf("ttscserver: %s %s produced more than %d bytes on stdout", pluginLabel(plugin), command, nativePluginCommandStdoutLimit) }
  return bytes.TrimSpace(stdout.Bytes()), nil
}

// runNativePluginRead selects the source's existing resident/direct operation.
// Original document reads keep a served error; optional project/hint reads
// retry directly after an unserved or failed resident attempt. Static verbs
// bypass resident execution. Both dependencies are the caller's actual native
// operations, not peer replacements, and arguments and returned values pass
// unchanged. Common: At most one resident and one direct call are dispatched;
// delegated execution, parsing and waits retain their own costs and resources.
// The supplied resident owner controls warm Program reuse; this policy adds no
// memo, handle or retained task and does not certify transport or OS receipt.
func runNativePluginRead(
  command string,
  args []string,
  resident func(string, []string) ([]byte, bool, error),
  direct func(string, []string) ([]byte, error),
) ([]byte, error) {
  if command == serveVerbDiagnostics || command == serveVerbCodeActions {
    if body, served, err := resident(command, args); served {
      return body, err
    }
  }
  if command == serveVerbProjectDiagnostics || command == serveVerbHints {
    if body, served, err := resident(command, args); served && err == nil {
      return body, nil
    }
  }
  return direct(command, args)
}

// decodeNativeResidentReply decodes one acquired resident response and applies
// the existing result-byte limit. Common: Result/code come from supplied JSON,
// not an invented process receipt; the pipe owner kills on returned errors and
// marks successful parsing separately. JSON costs follow acquired bytes and
// the copied result, while this operation retains no transport or session.
func decodeNativeResidentReply(reply []byte) ([]byte, int, error) {
  var response serveClientResponse
  if err := json.Unmarshal(reply, &response); err != nil { return nil, 0, err }
  if len(response.Result) > nativePluginCommandStdoutLimit { return nil, 0, fmt.Errorf("resident result exceeds %d bytes", nativePluginCommandStdoutLimit) }
  return response.Result, response.Code, nil
}

// nativeResidentResult preserves a served response's nonzero status as a verb
// error. Common: Optional fallback is owned by runNativePluginRead; formatting
// a supplied status authenticates neither a peer nor an OS exit. Allocation
// follows plugin/verb text, with no retained task or native resource.
func nativeResidentResult(plugin NativeLSPPluginEntry, verb string, body []byte, code int) ([]byte, bool, error) {
  if code != 0 { return nil, true, fmt.Errorf("ttscserver: %s %s (resident) exit %d", pluginLabel(plugin), verb, code) }
  return body, true, nil
}

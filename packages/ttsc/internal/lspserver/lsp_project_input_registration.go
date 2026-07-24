package lspserver

import (
  "encoding/json"
  "fmt"
  "net/url"
  "os"
  "path/filepath"
  "sort"
  "strings"
)

const (
  methodRegisterCapability   = "client/registerCapability"
  methodUnregisterCapability = "client/unregisterCapability"
  watchedFileKindAll         = 7
)

type projectInputRelativePattern struct {
  BaseURI string `json:"baseUri"`
  Pattern string `json:"pattern"`
}

type projectInputFileWatcher struct {
  GlobPattern projectInputRelativePattern `json:"globPattern"`
  Kind        int                         `json:"kind"`
}

type projectInputWatchRegistration struct {
  ID        string
  Signature string
  Watchers  []projectInputFileWatcher
}

type projectInputSnapshotSource interface {
  ProjectInputs() LSPProjectInputSnapshot
}

func (p *Proxy) projectInputWatchInitialized() {
  p.projectInputWatchMu.Lock()
  p.projectInputWatchReady = true
  p.projectInputWatchMu.Unlock()
  p.projectInputsRefreshed()
}

func (p *Proxy) projectInputsRefreshed() {
  source, ok := p.source.(projectInputSnapshotSource)
  if !ok {
    return
  }
  desired := projectInputWatchRegistrationForSnapshot(source.ProjectInputs())

  p.projectInputWatchMu.Lock()
  changed := p.projectInputWatchDesired.Signature != desired.Signature
  p.projectInputWatchDesired = desired
  if changed {
    p.projectInputWatchFailedSignature = ""
    p.projectInputWatchUnregisterRetryBlocked = false
  }
  ready := p.projectInputWatchReady
  p.projectInputWatchMu.Unlock()
  if !ready {
    return
  }

  p.capabilityMu.Lock()
  supported :=
    p.projectInputWatchDynamic && p.projectInputWatchRelative
  p.capabilityMu.Unlock()
  if len(desired.Watchers) != 0 && !supported {
    p.projectInputWatchMu.Lock()
    warn := !p.projectInputWatchWarningSent
    p.projectInputWatchWarningSent = true
    p.projectInputWatchMu.Unlock()
    if warn {
      p.reportAsyncError(p.writeProjectInputWatchWarning(
        "the LSP client does not support dynamic relative file-pattern registration; declared Markdown and local Swagger diagnostics may remain stale until another project event",
      ))
    }
    return
  }
  p.reconcileProjectInputWatchRegistration()
}

func (p *Proxy) reconcileProjectInputWatchRegistration() {
  p.projectInputWatchMu.Lock()
  if !p.projectInputWatchReady || p.projectInputWatchPending {
    p.projectInputWatchMu.Unlock()
    return
  }
  if len(p.projectInputWatchStaleIDs) != 0 &&
    !p.projectInputWatchUnregisterRetryBlocked {
    staleID := p.projectInputWatchStaleIDs[0]
    p.projectInputWatchPending = true
    p.projectInputWatchMu.Unlock()
    if err := p.writeProjectInputWatchUnregistration(staleID); err != nil {
      p.projectInputWatchMu.Lock()
      p.projectInputWatchPending = false
      p.projectInputWatchUnregisterRetryBlocked = true
      p.projectInputWatchMu.Unlock()
      p.reportAsyncError(err)
      p.reconcileProjectInputWatchRegistration()
    }
    return
  }
  desired := p.projectInputWatchDesired
  active := p.projectInputWatchActive
  if desired.Signature == active.Signature {
    p.projectInputWatchMu.Unlock()
    return
  }
  if len(desired.Watchers) == 0 {
    if active.ID != "" {
      p.projectInputWatchStaleIDs = append(
        p.projectInputWatchStaleIDs,
        active.ID,
      )
      p.projectInputWatchActive = projectInputWatchRegistration{}
    }
    p.projectInputWatchMu.Unlock()
    p.reconcileProjectInputWatchRegistration()
    return
  }
  if p.projectInputWatchFailedSignature == desired.Signature {
    p.projectInputWatchMu.Unlock()
    return
  }
  p.projectInputWatchRegistrationSequence++
  desired.ID = fmt.Sprintf(
    "ttsc-project-input-watch-%d",
    p.projectInputWatchRegistrationSequence,
  )
  p.projectInputWatchPending = true
  p.projectInputWatchMu.Unlock()
  if err := p.writeProjectInputWatchRegistration(desired); err != nil {
    p.projectInputWatchMu.Lock()
    p.projectInputWatchPending = false
    p.projectInputWatchFailedSignature = desired.Signature
    p.projectInputWatchMu.Unlock()
    p.reportAsyncError(err)
    p.reconcileProjectInputWatchRegistration()
  }
}

func (p *Proxy) writeProjectInputWatchRegistration(
  registration projectInputWatchRegistration,
) error {
  params := map[string]any{
    "registrations": []any{
      map[string]any{
        "id":     registration.ID,
        "method": methodDidChangeWatchedFiles,
        "registerOptions": map[string]any{
          "watchers": registration.Watchers,
        },
      },
    },
  }
  return p.writeClientRequest(
    methodRegisterCapability,
    params,
    func(env Envelope) {
      p.projectInputWatchMu.Lock()
      p.projectInputWatchPending = false
      if env.IsErrorResponse() {
        p.projectInputWatchFailedSignature = registration.Signature
        p.projectInputWatchMu.Unlock()
        p.reportAsyncError(p.writeProjectInputWatchWarning(
          fmt.Sprintf(
            "the LSP client rejected declared external-input watcher registration: %s",
            strings.TrimSpace(string(env.Error)),
          ),
        ))
        p.reconcileProjectInputWatchRegistration()
        return
      }
      previous := p.projectInputWatchActive
      p.projectInputWatchActive = registration
      p.projectInputWatchFailedSignature = ""
      if previous.ID != "" && previous.ID != registration.ID {
        p.projectInputWatchStaleIDs = append(
          p.projectInputWatchStaleIDs,
          previous.ID,
        )
      }
      p.projectInputWatchMu.Unlock()
      p.reconcileProjectInputWatchRegistration()
    },
  )
}

func (p *Proxy) writeProjectInputWatchUnregistration(
  registrationID string,
) error {
  params := map[string]any{
    // LSP 3.17 standardized this misspelling; clients consume it verbatim.
    "unregisterations": []any{
      map[string]any{
        "id":     registrationID,
        "method": methodDidChangeWatchedFiles,
      },
    },
  }
  return p.writeClientRequest(
    methodUnregisterCapability,
    params,
    func(env Envelope) {
      p.projectInputWatchMu.Lock()
      p.projectInputWatchPending = false
      if env.IsErrorResponse() {
        p.projectInputWatchUnregisterRetryBlocked = true
        p.projectInputWatchMu.Unlock()
        p.reportAsyncError(p.writeProjectInputWatchWarning(
          fmt.Sprintf(
            "the LSP client rejected stale external-input watcher cleanup: %s",
            strings.TrimSpace(string(env.Error)),
          ),
        ))
        p.reconcileProjectInputWatchRegistration()
        return
      }
      for index, staleID := range p.projectInputWatchStaleIDs {
        if staleID == registrationID {
          p.projectInputWatchStaleIDs = append(
            p.projectInputWatchStaleIDs[:index],
            p.projectInputWatchStaleIDs[index+1:]...,
          )
          break
        }
      }
      p.projectInputWatchUnregisterRetryBlocked = false
      p.projectInputWatchMu.Unlock()
      p.reconcileProjectInputWatchRegistration()
    },
  )
}

func (p *Proxy) writeClientRequest(
  method string,
  params any,
  callback func(Envelope),
) error {
  id := fmt.Sprintf(
    "ttsc/project-input-watch/request/%d",
    p.clientRequestSequence.Add(1),
  )
  rawID, _ := json.Marshal(id)
  body, err := json.Marshal(map[string]any{
    "jsonrpc": "2.0",
    "id":      id,
    "method":  method,
    "params":  params,
  })
  if err != nil {
    return err
  }
  key := idKeyFromRaw(rawID)
  p.pendingMu.Lock()
  p.pendingClientRequests[key] = callback
  p.pendingMu.Unlock()
  if err := p.writeEditorFrame(body); err != nil {
    p.pendingMu.Lock()
    delete(p.pendingClientRequests, key)
    p.pendingMu.Unlock()
    return err
  }
  return nil
}

func (p *Proxy) handleClientRequestResponse(env Envelope) bool {
  key := env.IDKey()
  if key == "" {
    return false
  }
  p.pendingMu.Lock()
  callback, ok := p.pendingClientRequests[key]
  if ok {
    delete(p.pendingClientRequests, key)
  }
  p.pendingMu.Unlock()
  if !ok {
    return false
  }
  callback(env)
  return true
}

func (p *Proxy) writeProjectInputWatchWarning(message string) error {
  params, err := json.Marshal(map[string]any{
    "type":    lspMessageTypeInfo,
    "message": "ttscserver: " + message,
  })
  if err != nil {
    return err
  }
  body, err := json.Marshal(Envelope{
    JSONRPC: "2.0",
    Method:  methodLogMessage,
    Params:  params,
  })
  if err != nil {
    return err
  }
  return p.writeEditorFrame(body)
}

func projectInputWatchRegistrationForSnapshot(
  snapshot LSPProjectInputSnapshot,
) projectInputWatchRegistration {
  watchers := projectInputFileWatchers(snapshot)
  if len(watchers) == 0 {
    return projectInputWatchRegistration{}
  }
  encoded, _ := json.Marshal(watchers)
  return projectInputWatchRegistration{
    Signature: string(encoded),
    Watchers:  watchers,
  }
}

func projectInputFileWatchers(
  snapshot LSPProjectInputSnapshot,
) []projectInputFileWatcher {
  unique := map[string]projectInputFileWatcher{}
  for _, file := range snapshot.Files {
    native := filepath.FromSlash(file)
    desiredBase := filepath.Dir(native)
    base := nearestExistingProjectInputDirectory(desiredBase)
    pattern := escapeLSPGlobLiteral(relativeProjectInputPattern(base, native))
    watcher := newProjectInputFileWatcher(base, pattern)
    unique[projectInputFileWatcherKey(watcher)] = watcher
  }
  for _, file := range snapshot.ReloadFiles {
    native := filepath.FromSlash(file)
    desiredBase := filepath.Dir(native)
    base := nearestExistingProjectInputDirectory(desiredBase)
    pattern := escapeLSPGlobLiteral(relativeProjectInputPattern(base, native))
    watcher := newProjectInputFileWatcher(base, pattern)
    unique[projectInputFileWatcherKey(watcher)] = watcher
  }
  for _, directory := range snapshot.ReloadDirectories {
    native := filepath.FromSlash(directory)
    identityBase := nearestExistingProjectInputDirectory(filepath.Dir(native))
    identityPattern := escapeLSPGlobLiteral(
      relativeProjectInputPattern(identityBase, native),
    )
    identityWatcher := newProjectInputFileWatcher(
      identityBase,
      identityPattern,
    )
    unique[projectInputFileWatcherKey(identityWatcher)] = identityWatcher

    childrenBase := nearestExistingProjectInputDirectory(native)
    prefix := relativeProjectInputPattern(childrenBase, native)
    pattern := "*"
    if prefix != "." {
      pattern = escapeLSPGlobLiteral(prefix) + "/*"
    }
    watcher := newProjectInputFileWatcher(childrenBase, pattern)
    unique[projectInputFileWatcherKey(watcher)] = watcher
  }
  for _, pattern := range snapshot.Globs {
    desiredBase, relative := projectInputGlobRelativePattern(pattern)
    base := nearestExistingProjectInputDirectory(desiredBase)
    prefix := relativeProjectInputPattern(base, desiredBase)
    if prefix != "." {
      relative = escapeLSPGlobLiteral(prefix) + "/" + relative
    }
    watcher := newProjectInputFileWatcher(base, relative)
    unique[projectInputFileWatcherKey(watcher)] = watcher
  }
  keys := make([]string, 0, len(unique))
  for key := range unique {
    keys = append(keys, key)
  }
  sort.Strings(keys)
  watchers := make([]projectInputFileWatcher, 0, len(keys))
  for _, key := range keys {
    watchers = append(watchers, unique[key])
  }
  return watchers
}

func nearestExistingProjectInputDirectory(location string) string {
  current := filepath.Clean(location)
  for {
    if info, err := os.Stat(current); err == nil && info.IsDir() {
      return current
    }
    parent := filepath.Dir(current)
    if parent == current {
      return filepath.Clean(location)
    }
    current = parent
  }
}

func relativeProjectInputPattern(base string, target string) string {
  relative, err := filepath.Rel(base, target)
  if err != nil {
    return filepath.ToSlash(target)
  }
  return filepath.ToSlash(relative)
}

func newProjectInputFileWatcher(
  base string,
  pattern string,
) projectInputFileWatcher {
  return projectInputFileWatcher{
    GlobPattern: projectInputRelativePattern{
      BaseURI: projectInputFileURI(base),
      Pattern: filepath.ToSlash(pattern),
    },
    Kind: watchedFileKindAll,
  }
}

func projectInputFileWatcherKey(watcher projectInputFileWatcher) string {
  return watcher.GlobPattern.BaseURI + "\x00" +
    watcher.GlobPattern.Pattern
}

func projectInputGlobRelativePattern(
  pattern string,
) (string, string) {
  normalized := filepath.ToSlash(filepath.Clean(filepath.FromSlash(pattern)))
  wildcard := strings.IndexAny(normalized, "*?")
  if wildcard == -1 {
    native := filepath.FromSlash(normalized)
    return filepath.Dir(native), escapeLSPGlobLiteral(filepath.Base(native))
  }
  separator := strings.LastIndex(normalized[:wildcard], "/")
  base := normalized[:separator]
  if base == "" {
    base = "/"
  } else if len(base) == 2 && base[1] == ':' {
    base += "/"
  }
  relative := normalized[separator+1:]
  return filepath.FromSlash(base), escapeLSPGlobClasses(relative)
}

func escapeLSPGlobLiteral(input string) string {
  var out strings.Builder
  for _, char := range input {
    switch char {
    case '*', '?', '[', ']', '{', '}':
      out.WriteByte('[')
      out.WriteRune(char)
      out.WriteByte(']')
    default:
      out.WriteRune(char)
    }
  }
  return out.String()
}

func escapeLSPGlobClasses(input string) string {
  var out strings.Builder
  for _, char := range input {
    switch char {
    case '[', ']', '{', '}':
      out.WriteByte('[')
      out.WriteRune(char)
      out.WriteByte(']')
    default:
      out.WriteRune(char)
    }
  }
  return out.String()
}

func projectInputFileURI(location string) string {
  normalized := filepath.ToSlash(location)
  if strings.HasPrefix(normalized, "//") {
    remainder := strings.TrimPrefix(normalized, "//")
    separator := strings.IndexByte(remainder, '/')
    if separator > 0 {
      return (&url.URL{
        Scheme: "file",
        Host:   remainder[:separator],
        Path:   "/" + remainder[separator+1:],
      }).String()
    }
  }
  if len(normalized) >= 2 && normalized[1] == ':' {
    normalized = "/" + normalized
  }
  return (&url.URL{Scheme: "file", Path: normalized}).String()
}

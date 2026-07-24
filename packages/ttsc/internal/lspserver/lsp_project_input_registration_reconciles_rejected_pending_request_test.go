package lspserver

import (
  "bytes"
  "encoding/json"
  "path/filepath"
  "testing"
)

type mutableProjectInputRegistrationSource struct {
  NullPluginSource
  snapshot LSPProjectInputSnapshot
}

func (s *mutableProjectInputRegistrationSource) ProjectInputs() LSPProjectInputSnapshot {
  return copyProjectInputSnapshot(s.snapshot)
}

// TestProjectInputRegistrationReconcilesRejectedPendingRequest verifies
// rejected dynamic-registration requests cannot strand a newer project-input
// snapshot.
//
// A rejected replacement must preserve the last-good registration while the
// proxy advances to the latest desired snapshot. Rejected stale cleanup must
// likewise retain its work without blocking a newer registration or creating a
// duplicate active registration.
//
//  1. Register snapshot A, then leave replacement B pending.
//  2. Publish C and reject B; assert C registers while A remains active.
//  3. Register D, leave cleanup of C pending, then publish E and reject cleanup.
//  4. Assert E registers while the rejected cleanup remains deferred.
//  5. Publish F and assert retained cleanup completes once before F replaces E.
func TestProjectInputRegistrationReconcilesRejectedPendingRequest(
  t *testing.T,
) {
  root := t.TempDir()
  snapshot := func(name string) LSPProjectInputSnapshot {
    return LSPProjectInputSnapshot{
      Root: filepath.ToSlash(root),
      Files: []string{
        filepath.ToSlash(filepath.Join(root, "docs", name+".md")),
      },
    }
  }
  source := &mutableProjectInputRegistrationSource{snapshot: snapshot("a")}
  proxy := NewProxy(ProxyOptions{
    EditorOut: &bytes.Buffer{},
    Source:    source,
  })
  proxy.projectInputWatchReady = true
  proxy.projectInputWatchDynamic = true
  proxy.projectInputWatchRelative = true

  proxy.projectInputsRefreshed()
  respondToPendingProjectInputWatchRequest(t, proxy, false, "")
  registrationA := proxy.projectInputWatchActive
  assertProjectInputWatchState(
    t,
    proxy,
    projectInputWatchRegistrationForSnapshot(snapshot("a")).Signature,
    nil,
    false,
  )

  source.snapshot = snapshot("b")
  proxy.projectInputsRefreshed()
  source.snapshot = snapshot("c")
  proxy.projectInputsRefreshed()
  respondToPendingProjectInputWatchRequest(t, proxy, true, "reject B")
  if proxy.projectInputWatchActive.ID != registrationA.ID {
    t.Fatalf(
      "rejected B replaced last-good A: active = %#v, A = %#v",
      proxy.projectInputWatchActive,
      registrationA,
    )
  }
  assertProjectInputWatchState(
    t,
    proxy,
    projectInputWatchRegistrationForSnapshot(snapshot("c")).Signature,
    nil,
    true,
  )

  respondToPendingProjectInputWatchRequest(t, proxy, false, "")
  registrationC := proxy.projectInputWatchActive
  if registrationC.Signature !=
    projectInputWatchRegistrationForSnapshot(snapshot("c")).Signature {
    t.Fatalf("active after C success = %#v", registrationC)
  }
  assertProjectInputWatchState(
    t,
    proxy,
    registrationC.Signature,
    []string{registrationA.ID},
    true,
  )
  respondToPendingProjectInputWatchRequest(t, proxy, false, "")
  assertProjectInputWatchState(t, proxy, registrationC.Signature, nil, false)

  source.snapshot = snapshot("d")
  proxy.projectInputsRefreshed()
  respondToPendingProjectInputWatchRequest(t, proxy, false, "")
  registrationD := proxy.projectInputWatchActive
  assertProjectInputWatchState(
    t,
    proxy,
    registrationD.Signature,
    []string{registrationC.ID},
    true,
  )

  source.snapshot = snapshot("e")
  proxy.projectInputsRefreshed()
  respondToPendingProjectInputWatchRequest(
    t,
    proxy,
    true,
    "reject cleanup C",
  )
  if proxy.projectInputWatchActive.ID != registrationD.ID {
    t.Fatalf(
      "rejected cleanup replaced last-good D: active = %#v, D = %#v",
      proxy.projectInputWatchActive,
      registrationD,
    )
  }
  assertProjectInputWatchState(
    t,
    proxy,
    projectInputWatchRegistrationForSnapshot(snapshot("e")).Signature,
    []string{registrationC.ID},
    true,
  )

  respondToPendingProjectInputWatchRequest(t, proxy, false, "")
  registrationE := proxy.projectInputWatchActive
  assertProjectInputWatchState(
    t,
    proxy,
    registrationE.Signature,
    []string{registrationC.ID, registrationD.ID},
    false,
  )

  source.snapshot = snapshot("f")
  proxy.projectInputsRefreshed()
  respondToPendingProjectInputWatchRequest(t, proxy, false, "")
  assertProjectInputWatchState(
    t,
    proxy,
    projectInputWatchRegistrationForSnapshot(snapshot("f")).Signature,
    []string{registrationD.ID},
    true,
  )
  if proxy.projectInputWatchActive.ID != registrationE.ID {
    t.Fatal("retrying cleanup registered F before removing retained C")
  }

  respondToPendingProjectInputWatchRequest(t, proxy, false, "")
  assertProjectInputWatchState(
    t,
    proxy,
    projectInputWatchRegistrationForSnapshot(snapshot("f")).Signature,
    nil,
    true,
  )
  if proxy.projectInputWatchActive.ID != registrationE.ID {
    t.Fatal("retrying cleanup registered F before removing stale D")
  }

  respondToPendingProjectInputWatchRequest(t, proxy, false, "")
  registrationF := proxy.projectInputWatchActive
  assertProjectInputWatchState(
    t,
    proxy,
    registrationF.Signature,
    []string{registrationE.ID},
    true,
  )
  respondToPendingProjectInputWatchRequest(t, proxy, false, "")
  assertProjectInputWatchState(t, proxy, registrationF.Signature, nil, false)

  if proxy.projectInputWatchRegistrationSequence != 6 {
    t.Fatalf(
      "registration attempts = %d, want A through F exactly once",
      proxy.projectInputWatchRegistrationSequence,
    )
  }
}

func respondToPendingProjectInputWatchRequest(
  t *testing.T,
  proxy *Proxy,
  rejected bool,
  message string,
) {
  t.Helper()
  proxy.pendingMu.Lock()
  if len(proxy.pendingClientRequests) != 1 {
    proxy.pendingMu.Unlock()
    t.Fatalf(
      "pending client requests = %d, want 1",
      len(proxy.pendingClientRequests),
    )
  }
  var rawID json.RawMessage
  for key := range proxy.pendingClientRequests {
    rawID = json.RawMessage(key)
  }
  proxy.pendingMu.Unlock()

  response := Envelope{
    JSONRPC: "2.0",
    ID:      rawID,
    Result:  json.RawMessage("null"),
  }
  if rejected {
    response.Result = nil
    response.Error, _ = json.Marshal(map[string]any{
      "code":    -32603,
      "message": message,
    })
  }
  if !proxy.handleClientRequestResponse(response) {
    t.Fatalf("pending client response %s was not handled", rawID)
  }
}

func assertProjectInputWatchState(
  t *testing.T,
  proxy *Proxy,
  desiredSignature string,
  staleIDs []string,
  pending bool,
) {
  t.Helper()
  proxy.projectInputWatchMu.Lock()
  defer proxy.projectInputWatchMu.Unlock()
  if proxy.projectInputWatchDesired.Signature != desiredSignature ||
    !equalProjectInputWatchIDs(proxy.projectInputWatchStaleIDs, staleIDs) ||
    proxy.projectInputWatchPending != pending {
    t.Fatalf(
      "watch state = {desired:%q active:%#v stale:%#v pending:%v failed:%q retryBlocked:%v}, want desired %q stale %#v pending %v",
      proxy.projectInputWatchDesired.Signature,
      proxy.projectInputWatchActive,
      proxy.projectInputWatchStaleIDs,
      proxy.projectInputWatchPending,
      proxy.projectInputWatchFailedSignature,
      proxy.projectInputWatchUnregisterRetryBlocked,
      desiredSignature,
      staleIDs,
      pending,
    )
  }
}

func equalProjectInputWatchIDs(left []string, right []string) bool {
  if len(left) != len(right) {
    return false
  }
  for index := range left {
    if left[index] != right[index] {
      return false
    }
  }
  return true
}

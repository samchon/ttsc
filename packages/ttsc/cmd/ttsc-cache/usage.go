package main

import (
  "encoding/json"
  "errors"
  "os"
  "path/filepath"
  "strings"
)

type usageReceipt struct {
  Gets             int64               `json:"gets"`
  BaseHits         int64               `json:"baseHits"`
  OverlayHits      int64               `json:"overlayHits"`
  Misses           int64               `json:"misses"`
  Puts             int64               `json:"puts"`
  PutBytes         int64               `json:"putBytes"`
  BaseActionIDs    []string            `json:"baseActionIDs"`
  OverlayActionIDs []string            `json:"overlayActionIDs"`
  MissActionIDs    []string            `json:"missActionIDs"`
  PutActionIDs     []string            `json:"putActionIDs"`
  Truncated        bool                `json:"truncated"`
  Storage          *artifactAccounting `json:"storage,omitempty"`
}

const maxUsageActionIDs = 4096

func (usage *usageReceipt) record(destination *[]string, actionID string) {
  if len(usage.BaseActionIDs)+len(usage.OverlayActionIDs)+len(usage.MissActionIDs)+len(usage.PutActionIDs) >= maxUsageActionIDs {
    usage.Truncated = true
    return
  }
  *destination = append(*destination, actionID)
}

func validReceiptName(value string) bool {
  if len(value) != 32 {
    return false
  }
  for _, char := range value {
    if !strings.ContainsRune("0123456789abcdef", char) {
      return false
    }
  }
  return true
}

func writeUsageReceipt(store *artifactStore, usage usageReceipt) error {
  if !validReceiptName(store.receiptName) {
    return errors.New("invalid usage receipt name")
  }
  raw, err := json.Marshal(usage)
  if err != nil {
    return err
  }
  if len(raw) > 1<<20 {
    return errors.New("usage receipt exceeds one MiB")
  }
  stage := filepath.ToSlash(filepath.Join("receipts", randomName()))
  file, err := store.root.OpenFile(stage, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
  if err != nil {
    return err
  }
  defer store.root.Remove(stage)
  _, writeErr := file.Write(append(raw, '\n'))
  syncErr := file.Sync()
  closeErr := file.Close()
  if writeErr != nil || syncErr != nil || closeErr != nil {
    return errors.Join(writeErr, syncErr, closeErr)
  }
  final := filepath.ToSlash(filepath.Join("receipts", store.receiptName))
  return store.root.Rename(stage, final)
}

package driver

import (
  "errors"
  "os"
  "path/filepath"
)

// writePrivateResult publishes only bytes whose write and close both succeeded.
// The caller owns a fresh result path and its parent directory. A temporary file
// in that directory keeps the final artifact absent until native rename succeeds;
// failure closes the descriptor and removes only the allocated temporary file.
func writePrivateResult(fileName string, data []byte) (resultErr error) {
  temporary, err := os.CreateTemp(filepath.Dir(fileName), ".ttsc-result-*")
  if err != nil {
    return err
  }
  temporaryName := temporary.Name()
  closed := false
  published := false
  defer func() {
    if !closed {
      resultErr = errors.Join(resultErr, temporary.Close())
    }
    if !published {
      if err := os.Remove(temporaryName); err != nil && !os.IsNotExist(err) {
        resultErr = errors.Join(resultErr, err)
      }
    }
  }()
  if _, err := temporary.Write(data); err != nil {
    return err
  }
  closed = true
  if err := temporary.Close(); err != nil {
    return err
  }
  if err := os.Rename(temporaryName, fileName); err != nil {
    return err
  }
  published = true
  return nil
}

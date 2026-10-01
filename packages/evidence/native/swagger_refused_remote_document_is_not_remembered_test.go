package evidence

import (
  "testing"
)

/**
 * Verifies a refused URL is not remembered.
 *
 * This is the asymmetry that makes remembering a URL survivable at all. A local
 * rejection is keyed by the bytes that caused it, so repairing the document
 * changes the key and clears the entry. A URL is keyed by its address, and
 * nothing an author can do changes that — so one refused connection would
 * poison the URL for the whole session, with no edit able to invalidate it and
 * a restart the only way out.
 *
 *  1. Remember a rejected URL outcome.
 *  2. Look the same URL up.
 *  3. Assert nothing was remembered, so the next cycle tries again.
 *
 * @evidence contracts/testing.md#behavioral-verification rememberSwaggerDocument/lookupSwaggerDocument refuse seeded rejected URL state.
 * @evidence contracts/testing.md#independent-expectations Literal Rejected flag and connection-refused reason independently identify transient failure.
 * @evidence contracts/testing.md#distinguishing-cases A rejected URL outcome is offered to rememberSwaggerDocument and the address lookup must miss. The remembered-and-hit counterpart for a successful URL is the separate remote-cache test; no later successful store for the same URL is exercised here.
 * @evidence contracts/testing.md#execution-ownership TestSwaggerRefusedRemoteDocumentIsNotRemembered is a selectable native Go unit entry. It calls rememberSwaggerDocument and lookupSwaggerDocument against isolated in-memory caches in-process; no consumer, Node process, native build or product host is started.
 */
func TestSwaggerRefusedRemoteDocumentIsNotRemembered(t *testing.T) {
  source := "https://example.com/openapi.json"
  isolateSwaggerCache(t)
  rememberSwaggerDocument(source, "", swaggerDocumentOutcome{
    Rejected: true,
    Problem:  "connection refused",
  })
  if _, hit := lookupSwaggerDocument(source, ""); hit {
    t.Fatal("a transient failure must not outlive the evaluation that saw it")
  }
}

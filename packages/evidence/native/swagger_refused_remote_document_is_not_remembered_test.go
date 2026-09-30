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
 * @evidence contracts/testing.md#distinguishing-cases Rejected address must not poison successful remote-session storage.
 * @evidence contracts/testing.md#execution-ownership TestSwaggerRefusedRemoteDocumentIsNotRemembered is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestSwaggerRefusedRemoteDocumentIsNotRemembered(t *testing.T) {
  source := "https://example.com/openapi.json"
  swaggerRemoteDocuments = newSwaggerCache()
  rememberSwaggerDocument(source, "", swaggerDocumentOutcome{
    Rejected: true,
    Problem:  "connection refused",
  })
  if _, hit := lookupSwaggerDocument(source, ""); hit {
    t.Fatal("a transient failure must not outlive the evaluation that saw it")
  }
}

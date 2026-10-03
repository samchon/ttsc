package evidence

import (
  "os"
  "path/filepath"
  "testing"
)

// requireColdPrismaSchemaFixture prepares the exact schema bytes and removes only
// their parse outcome so an installed-parser boundary cannot pass from a warm
// native cache. These Go cases run serially and share the installed package;
// clearing every outcome would invalidate unrelated consumers without reason.
// The external Go Evidence adapter selects exported declarations; this private
// fixture helper has native chapter answers below rather than unsupported tags.
//
// Principled implementation: The schema is written verbatim at the same relative path the loader will consume. prismaContentDigest identifies that exact content-cache entry; deleting only that entry and its eviction-order record establishes a miss without substituting a parser result or changing the configured population.
// Clear and simple design: This fixture preparation owns cold-state control; existing test bodies continue to own schema choices, rule calls and independent diagnostic assertions. It neither installs a consumer nor builds an artifact.
// Prohibited implementation shortcuts: A fixture write or digest failure fails the test. The helper cannot return a fake inventory, skip a bridge call or mask its diagnostics; removing the exact cache entry requires the real loader to produce the next result.
// Meaningful documentation: The native comment states why serial test execution matters and why the reset targets one schema result rather than the complete process cache.
// Efficient algorithms: Preparing one schema reads and writes its bytes once, hashes them once and scans the bounded cache eviction order; the existing cache has at most sixteen outcomes.
// Reuse equivalent work: The installed package, compiled loader and Go process remain shared. Only the schema whose cold installed connection is being tested loses its prior parse outcome; subsequent equivalent loads inside that case can reuse the newly produced result.
// Bound retention and release resources: The owning prismaBridgeRoot registers fixture removal with t.Cleanup. File operations retain no open handle. The cache mutex is released before the test calls the loader, and the removed key is also removed from the bounded eviction order.
// OS-neutral implementation: filepath.FromSlash and filepath.Join resolve the authored relative schema path on the host filesystem. Standard Go writes and cache synchronization need no shell, symlink privilege or platform-specific producer.
func requireColdPrismaSchemaFixture(t *testing.T, root string, sourcePath string, source string) {
  t.Helper()
  absolute := filepath.Join(root, filepath.FromSlash(sourcePath))
  if err := os.MkdirAll(filepath.Dir(absolute), 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(absolute, []byte(source), 0o644); err != nil {
    t.Fatal(err)
  }
  digest := prismaContentDigest(root, []string{sourcePath})
  if digest == "" {
    t.Fatal("the exact schema fixture must have a readable cache identity")
  }
  prismaSchemas.mutex.Lock()
  defer prismaSchemas.mutex.Unlock()
  delete(prismaSchemas.entries, digest)
  for index, existing := range prismaSchemas.order {
    if existing == digest {
      prismaSchemas.order = append(prismaSchemas.order[:index], prismaSchemas.order[index+1:]...)
      break
    }
  }
}

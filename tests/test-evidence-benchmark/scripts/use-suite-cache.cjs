const path = require("node:path");

// The suite and the real benchmark CLI it launches compile the same typia Go
// plugin. Resolve one absolute cache root before ttsx builds this suite so the
// nested pnpm start can reuse that binary instead of linking it a second time.
const suiteRoot = path.resolve(__dirname, "..");
process.env.TTSC_CACHE_DIR = path.resolve(
  suiteRoot,
  process.env.TTSC_CACHE_DIR ?? process.env.TTSC_TEST_CACHE_DIR ?? path.join(".cache", "ttsc"),
);

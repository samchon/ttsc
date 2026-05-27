// Positive: two imports of the same module specifier.
import { stringify } from "node:querystring";
// expect: no-duplicate-imports error
import { parse } from "node:querystring";

// Negative: imports from different modules.
import { join } from "node:path";
import { tmpdir } from "node:os";

JSON.stringify({ stringify, parse, join, tmpdir });

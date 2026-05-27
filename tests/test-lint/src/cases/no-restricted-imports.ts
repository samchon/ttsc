// Positive: hard-coded deny list flags `lodash` at the specifier.
// expect: no-restricted-imports error
import _ from "lodash";

// Positive: a `from` re-export hits the same deny list.
// expect: no-restricted-imports error
export { isArray } from "underscore";

// Negative: any specifier outside the deny list passes through.
import * as fs from "node:fs";

void _;
void fs;

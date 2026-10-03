// @ttsc-corpus-options: no-restricted-imports {"paths":["lodash"]}
// Positive: the configured exact path is rejected.
// expect: no-restricted-imports error
import _ from "lodash";

// Negative: re-exports outside the configured paths remain unrestricted.
export { isArray } from "underscore";

// Arbitrary imports remain accepted.
import * as fs from "node:fs";

void _;
void fs;

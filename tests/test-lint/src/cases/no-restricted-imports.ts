// No options means no project policy is inferred.
import _ from "lodash";

// Re-exports are likewise unrestricted until paths or patterns are supplied.
export { isArray } from "underscore";

// Arbitrary imports remain accepted.
import * as fs from "node:fs";

void _;
void fs;

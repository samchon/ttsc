// Positive: two mergeable named value imports of the same module.
import { first } from "some-module";
// expect: no-duplicate-imports error
import { second } from "some-module";

// Positive: under the official default (allowSeparateTypeImports: false),
// a clause-level type import joins the comparison with the value import
// above, and named type bindings merge with named value bindings.
import { runtime } from "type-and-value";
// expect: no-duplicate-imports error
import type { IEntity } from "type-and-value";

// Negative: named and namespace imports cannot be merged into one
// declaration, so the repeated module specifier is not a duplicate.
import { named } from "unmergeable-namespace";
import * as namespace from "unmergeable-namespace";

// Negative: a type-only default import and a type-only named import
// cannot be merged into one declaration (ESLint 9.30.1 parity).
import type DefaultType from "unmergeable-type-forms";
import type { NamedType } from "unmergeable-type-forms";

// Negative: imports from different modules.
import { alpha } from "other-module-a";
import { beta } from "other-module-b";

JSON.stringify({ first, second, runtime, named, namespace, alpha, beta });

import bDefault, { bNamed } from "./b.mjs";
import * as aNamespace from "./a.mjs";
console.log(globalThis.__sortImportsTrace.join(","));
void bDefault;
void bNamed;
void aNamespace;

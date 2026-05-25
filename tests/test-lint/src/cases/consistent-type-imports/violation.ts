// expect: consistentTypeImports error
import { Foo } from "./types-fixture";
const x: Foo | null = null;
JSON.stringify(x);

// @ttsc-corpus-clean: typescript/consistent-type-imports
import type { Foo } from "./types-fixture";
const x: Foo | null = null;
import { value } from "./values";
console.log(value);

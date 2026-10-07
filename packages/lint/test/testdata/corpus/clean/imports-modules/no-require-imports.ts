// @ttsc-corpus-clean: typescript/no-require-imports
import value from "virtual-module";
const dynamic = import("virtual-module");
console.log(value, dynamic);

import { observed } from "./native-factory";
import { value } from "./declared-owned.cjs";
console.log(value);
console.log("TTSC_DECLARED_REGISTER:" + JSON.stringify(observed));

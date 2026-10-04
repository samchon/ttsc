import { observed as first, argumentsObserved } from "./a/index"; import { observed as second } from "./b/index"; export const values = ["arguments=" + argumentsObserved, first, second];

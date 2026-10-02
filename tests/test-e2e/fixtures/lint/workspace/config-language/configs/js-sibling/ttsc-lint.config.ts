import { rules } from "./rules.js";
export default Object.assign({ rules }, {
    files: ["js-sibling.ts"],
    extends: "../plain-ts/ttsc-lint.config.ts"
});

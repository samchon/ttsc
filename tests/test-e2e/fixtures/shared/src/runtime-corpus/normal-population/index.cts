import { value as flat } from "./flat/main";
import { value as nested } from "./nested/src/main";
import { value as clear } from "./include/clear";
import { value as release } from "./include/build/release";
import { identity as script } from "./same-name/scripts/index";
import { identity as source } from "./same-name/src/index";
import { value as required } from "./required/entry/index";
import { value as composite } from "./composite/app/scripts/report";
import { message as nestedPackage } from "./nested-package/packages/app/src/main";

export const observed = { flat, nested, include: [clear, release], sameName: [script, source], required, composite, nestedPackage };

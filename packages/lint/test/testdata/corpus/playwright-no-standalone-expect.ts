declare const test: any;
declare const expect: any;
declare const page: any;
import { expect } from "@playwright/test";

// expect: playwright/no-standalone-expect error
expect(1).toBe(1);

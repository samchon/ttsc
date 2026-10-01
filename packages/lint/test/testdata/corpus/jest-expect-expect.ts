declare const describe: any;
declare const test: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;
declare const afterEach: any;
declare const beforeAll: any;
declare const afterAll: any;
import { test } from "@jest/globals";

// expect: jest/expect-expect error
test("loads data", () => {
  const value = 1 + 1;
});

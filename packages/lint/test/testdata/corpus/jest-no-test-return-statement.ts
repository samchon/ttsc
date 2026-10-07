declare const describe: any;
declare const test: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;
declare const afterEach: any;
declare const beforeAll: any;
declare const afterAll: any;
import { test } from "@jest/globals";

test("returns", () => {
  // expect: jest/no-test-return-statement error
  return 1;
});

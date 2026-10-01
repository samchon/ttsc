declare const describe: any;
declare const test: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;
declare const afterEach: any;
declare const beforeAll: any;
declare const afterAll: any;
import { test, expect } from "@jest/globals";

test("checks value", () => {
  // expect: jest/valid-expect error
  expect(1);
});

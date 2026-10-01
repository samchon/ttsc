declare const describe: any;
declare const test: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;
declare const afterEach: any;
declare const beforeAll: any;
declare const afterAll: any;
import { fit, expect } from "@jest/globals";

// expect: jest/no-test-prefixes error
fit("focuses", () => {
  expect(1).toBe(1);
});

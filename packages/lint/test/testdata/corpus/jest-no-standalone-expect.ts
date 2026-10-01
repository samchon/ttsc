declare const describe: any;
declare const test: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;
declare const afterEach: any;
declare const beforeAll: any;
declare const afterAll: any;
import { describe, expect } from "@jest/globals";

describe("suite", () => {
  // expect: jest/no-standalone-expect error
  expect(1).toBe(1);
});

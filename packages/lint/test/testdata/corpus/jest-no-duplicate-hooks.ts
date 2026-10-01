declare const describe: any;
declare const test: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;
declare const afterEach: any;
declare const beforeAll: any;
declare const afterAll: any;
import { describe, beforeEach } from "@jest/globals";

describe("suite", () => {
  beforeEach(() => {});
  // expect: jest/no-duplicate-hooks error
  beforeEach(() => {});
});

// @ttsc-corpus-clean: jest/no-export
import { test, expect } from "@jest/globals"; const helper = 1; test("private", () => { expect(helper).toBe(1); });

// @ttsc-corpus-clean: jest/prefer-to-have-length
import { test, expect } from "@jest/globals"; test("length", () => { expect([1, 2, 3]).toHaveLength(3); });

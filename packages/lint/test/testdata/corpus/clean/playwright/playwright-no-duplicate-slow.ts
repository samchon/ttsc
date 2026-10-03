// @ttsc-corpus-clean: playwright/no-duplicate-slow
import { test } from "@playwright/test"; test("once", () => { test.slow(); });

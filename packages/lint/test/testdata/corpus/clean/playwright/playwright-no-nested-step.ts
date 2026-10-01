// @ttsc-corpus-clean: playwright/no-nested-step
import { test } from "@playwright/test"; test("step", async () => { await test.step("one", async () => {}); });

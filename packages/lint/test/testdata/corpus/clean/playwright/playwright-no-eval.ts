// @ttsc-corpus-clean: playwright/no-eval
import { test } from "@playwright/test"; test("locator", ({ page }) => { page.getByRole("button"); });

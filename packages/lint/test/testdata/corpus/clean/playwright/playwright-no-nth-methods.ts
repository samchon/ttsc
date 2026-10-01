// @ttsc-corpus-clean: playwright/no-nth-methods
import { test } from "@playwright/test"; test("role", ({ page }) => { page.getByRole("button"); });

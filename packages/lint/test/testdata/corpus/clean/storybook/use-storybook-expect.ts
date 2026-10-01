// @ttsc-corpus-clean: storybook/use-storybook-expect
import { expect } from "@storybook/test"; export default { component: Button }; export const Primary = { play: () => { expect(button).toBeVisible(); } };

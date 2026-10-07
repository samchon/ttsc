// expect: storybook/use-storybook-testing-library error
import { screen } from "@testing-library/react";
export default { component: Button };
export const Primary = {};
void screen;

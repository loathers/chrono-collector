// @ts-check

/** @type import("prettier").Options */
export default {
  plugins: ["@trivago/prettier-plugin-sort-imports"],
  importOrder: ["<THIRD_PARTY_MODULES>", "^[~.]/"],
  importOrderSeparation: true,
  importOrderSortSpecifiers: true,
};

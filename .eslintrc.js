/** @type {import("eslint").Linter.Config} */
module.exports = {
    root: true,
    extends: ["eslint:recommended", "next", "prettier"],
    parser: "@typescript-eslint/parser",
    parserOptions: {
        project: true,
    },
    rules: {
        "react/no-unescaped-entities": 0,
        "@next/next/no-img-element": "off",
        "jsx-a11y/alt-text": 0,
        "@next/next/google-font-display": "off",
        "@next/next/no-page-custom-font": "off",
    },
};

import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import sort from "eslint-plugin-sort";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [".react-router/", "build/", "node_modules/", "playwright-report/", "test-results/", "logs/", "*.config.*.timestamp-*", ".eslintcache"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  sort.configs["flat/recommended"],
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      sourceType: "module",
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-empty-object-type": "off",

      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
          varsIgnorePattern: "^_",
        },
      ],
      curly: ["warn", "multi-line"],
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-alert": "warn",
      "no-console": "warn",
      "no-debugger": "error",
      "no-empty-pattern": ["error", { allowObjectPatternsAsParameters: true }],

      "no-var": "error",
      "prefer-const": "warn",
      "react-refresh/only-export-components": "warn",

      "sort/import-members": "warn",
      "sort/imports": "off",
      "sort/object-properties": "warn",
    },
  }
);

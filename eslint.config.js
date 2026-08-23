import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      ".react-router/",
      "build/",
      "node_modules/",
      "playwright-report/",
      "test-results/",
      "logs/",
      "*.config.*.timestamp-*",
      ".eslintcache",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": "warn",

      "no-console": "warn",
      "no-alert": "warn",
      "no-debugger": "error",
      "no-empty-pattern": ["error", { allowObjectPatternsAsParameters: true }],
      "no-var": "error",
      "prefer-const": "warn",
      eqeqeq: ["warn", "always", { null: "ignore" }],
      curly: ["warn", "multi-line"],

      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
      "@typescript-eslint/no-empty-object-type": "off",
    },
  }
);

import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

// Minimal stand-in for `react/jsx-uses-vars` (we do not ship eslint-plugin-react):
// marks identifiers referenced as JSX tags (<Foo />, <Foo.Bar />) as used so that
// `no-unused-vars` can cover component/icon/constant imports without a blanket
// exemption for every capitalized binding.
const jsxUsesVars = {
  rules: {
    'jsx-uses-vars': {
      meta: { type: 'problem', schema: [] },
      create(context) {
        return {
          JSXOpeningElement(node) {
            let name = node.name
            if (name.type === 'JSXNamespacedName') return
            while (name.type === 'JSXMemberExpression') name = name.object
            if (name.type !== 'JSXIdentifier') return
            // Lowercase tags (<div>, <svg>) are intrinsic elements, not variables.
            if (/^[a-z]/.test(name.name)) return
            context.sourceCode.markVariableAsUsed(name.name, node)
          },
        }
      },
    },
  },
}

export default [
  { ignores: ['dist', 'dev-dist', 'public', 'node_modules', 'test-results', 'playwright-report'] },
  {
    files: ['**/*.{js,jsx,mjs}'],
    languageOptions: {
      ecmaVersion: 2023,
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaVersion: 'latest', ecmaFeatures: { jsx: true }, sourceType: 'module' },
    },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh, 'jsx-vars': jsxUsesVars },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'jsx-vars/jsx-uses-vars': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
]

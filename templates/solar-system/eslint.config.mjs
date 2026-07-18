import nextVitals from 'eslint-config-next/core-web-vitals'

const generatedAppImportRules = {
  files: ['**/*.{ts,tsx}'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: ['../../*'],
      },
    ],
  },
}

const generatedComponentRules = {
  files: ['components/**/*.tsx', 'app/**/components/**/*.tsx'],
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        selector: 'ExportDefaultDeclaration',
        message: 'Component files must use one named PascalCase export.',
      },
    ],
  },
}

const eslintConfig = [...nextVitals, generatedAppImportRules, generatedComponentRules]

export default eslintConfig
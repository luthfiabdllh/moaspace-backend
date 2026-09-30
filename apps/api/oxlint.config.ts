import { defineConfig } from 'oxlint'

export default defineConfig({
  rules: {
    'no-unused-vars': 'warn',
  },
  overrides: [
    {
      files: ['**/*.{ts,mts,cts,tsx}'],
      rules: {
        'typescript/no-extraneous-class': ['error', { allowWithDecorator: true }],
      },
    },
  ],
})

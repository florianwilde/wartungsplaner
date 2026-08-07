import js from '@eslint/js'
import next from 'eslint-config-next'
import prettier from 'eslint-config-prettier'
import unusedImports from 'eslint-plugin-unused-imports'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'src/generated/**',
      'playwright-report/**',
      'test-results/**',
      'docs/bilder/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...next,

  // Allgemeine Regeln für alles.
  {
    plugins: { 'unused-imports': unusedImports },
    rules: {
      // Ungenutzte Importe entfernt `--fix` selbst; ungenutzte Variablen
      // bleiben eine Warnung, solange sie nicht mit `_` beginnen.
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],

      // `any` ist in dieser Anwendung nirgends nötig.
      '@typescript-eslint/no-explicit-any': 'error',

      // Debug-Ausgaben gehören nicht in den Auslieferungsstand; Warnungen
      // und Fehler dagegen schon.
      'no-console': ['warn', { allow: ['warn', 'error'] }],

      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-var': 'error',
      'prefer-const': 'error',
    },
  },

  // Regeln, die den Typprüfer brauchen. Nur für TypeScript-Dateien, und mit
  // dem eigenen Parser: `eslint-config-next` setzt sonst seinen eigenen ein,
  // der keine Typinformationen weiterreicht.
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Ein vergessenes `await` auf einer Server Action verschluckt Fehler
      // und schreibt womöglich gar nichts – das darf nicht durchrutschen.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
    },
  },

  // Skripte, Tests und der Hintergrundlauf schreiben ins Terminal
  // beziehungsweise ins Containerprotokoll – dort ist `console.log` die
  // Ausgabe und keine vergessene Debug-Zeile.
  {
    files: [
      'scripts/**/*.ts',
      'prisma/**/*.ts',
      'e2e/**/*.ts',
      '**/*.test.ts',
      'src/server/cron.ts',
    ],
    rules: { 'no-console': 'off' },
  },

  // Muss zuletzt stehen: schaltet alle Regeln ab, die Prettier ohnehin regelt.
  prettier,
)

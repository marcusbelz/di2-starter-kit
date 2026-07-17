// eslint.config.snippet.mjs — wiring example for no-raw-font-size.mjs in an
// ESLint flat config. Copy the relevant parts into your project's
// eslint.config.mjs; the paths below are EXAMPLE VALUES.
//
// The carve-out path list is the machine-readable form of the convention's
// scope (see ../brand.md "Enforcement"): marketing, legal, and public auth
// pages may deliberately carry their own large formats; tests reference class
// strings as test data. The app scope is defined as the COMPLEMENT of the
// carve-out list — a forgotten new public page fails loudly in the build
// instead of drifting silently (fail-closed).
//
// Activation order matters: migrate the app scope first, enable the guard
// LAST, when the app scope is clean — otherwise every unfinished file needs a
// temporary exception, and temporary exceptions like to become permanent.

import noRawFontSize from './eslint-rules/no-raw-font-size.mjs'

const FONT_SIZE_CARVE_OUT = [
  'src/app/page.tsx', // landing page: deliberately its own large formats
  'src/app/imprint/**',
  'src/app/privacy/**',
  'src/app/login/**',
  'src/**/*.test.{ts,tsx}', // tests reference class strings as test data
]

export default [
  {
    files: ['src/**/*.{ts,tsx,js,jsx}'],
    plugins: {
      project: {
        rules: { 'no-raw-font-size': noRawFontSize },
      },
    },
    rules: {
      // error, not warn: only a broken build is enforcement.
      'project/no-raw-font-size': 'error',
    },
  },
  {
    files: FONT_SIZE_CARVE_OUT,
    rules: { 'project/no-raw-font-size': 'off' },
  },
]

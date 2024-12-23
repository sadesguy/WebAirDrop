export default {
  plugins: {
    'postcss-import': {},
    'tailwindcss/nesting': 'postcss-nested',
    tailwindcss: {},
    autoprefixer: {},
    ...(process.env.NODE_ENV === 'production'
      ? {
          cssnano: {
            preset: ['default', {
              discardComments: {
                removeAll: true,
              },
            }],
          },
        }
      : {}),
  },
}
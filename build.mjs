// Build script: bundles the TypeScript app with esbuild and assembles three outputs.
//  - dist/        the Artifact page (HTML fragment: the platform adds the document skeleton)
//  - dist-local/  a full HTML document with locally vendored React, for offline browser tests
//  - dist-site/   the public website (GitHub Pages): proper document head, favicon, local React
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, existsSync } from 'node:fs';

const REACT_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js';
const REACT_DOM_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js';
const FONTS = 'https://fonts.googleapis.com/css2?family=Nunito+Sans:opsz,wght@6..12,400;6..12,500;6..12,600;6..12,700;6..12,800&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap';

// React comes from the UMD globals loaded before the app script.
const reactGlobals = {
  name: 'react-globals',
  setup(b) {
    b.onResolve({ filter: /^react(-dom)?(\/client)?$/ }, (a) => ({ path: a.path, namespace: 'rg' }));
    b.onLoad({ filter: /.*/, namespace: 'rg' }, (a) => ({
      contents: a.path === 'react' ? 'module.exports = window.React;' : 'module.exports = window.ReactDOM;',
      loader: 'js',
    }));
  },
};

const result = await build({
  entryPoints: ['src/main.tsx'],
  bundle: true,
  write: false,
  format: 'iife',
  target: ['es2019', 'chrome90', 'safari14', 'firefox90'],
  minify: true,
  jsx: 'transform',
  jsxFactory: 'React.createElement',
  jsxFragment: 'React.Fragment',
  plugins: [reactGlobals],
  logLevel: 'warning',
  legalComments: 'none',
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = readFileSync('src/styles.css', 'utf8');
const firstFrame = readFileSync('src/first-frame.html', 'utf8');

const head = `<title>LearnSpace</title>
<meta name="description" content="LearnSpace — apprendre à ton rythme avec Léa, ton assistante.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${FONTS}">
<style>${css}</style>`;

const body = (react, reactDom) => `<div id="root">${firstFrame}</div>
<script src="${react}"></script>
<script src="${reactDom}"></script>
<script>${js}</script>`;

for (const d of ['dist', 'dist-local', 'dist-site']) { if (existsSync(d)) rmSync(d, { recursive: true }); mkdirSync(d, { recursive: true }); }
writeFileSync('dist/index.html', `${head}\n${body(REACT_CDN, REACT_DOM_CDN)}\n`);
cpSync('public/assets', 'dist/assets', { recursive: true });

// Local test page: mimics the artifact skeleton (charset, viewport, small reset)
mkdirSync('dist-local/vendor', { recursive: true });
cpSync('node_modules/react/umd/react.production.min.js', 'dist-local/vendor/react.js');
cpSync('node_modules/react-dom/umd/react-dom.production.min.js', 'dist-local/vendor/react-dom.js');
cpSync('public/assets', 'dist-local/assets', { recursive: true });
writeFileSync('dist-local/index.html', `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light;padding:env(safe-area-inset-top,0) 0 env(safe-area-inset-bottom,0)}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style></head><body>
${head}
${body('vendor/react.js', 'vendor/react-dom.js')}
</body></html>`);

// Public website: a complete document (the same app, React served next to it)
const FAVICON = "data:image/svg+xml," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='#0C2643'/><g transform='translate(4 3.6) scale(.75)' fill='#fff'><path d='M16 5 2.5 11.6 16 18.2l11-5.4v6.7h2.6v-7.9Z'/><path d='M8.2 15.6v5.1c0 2 3.5 4.1 7.8 4.1s7.8-2.1 7.8-4.1v-5.1L16 19.4Z' opacity='.78'/></g></svg>`);
mkdirSync('dist-site/vendor', { recursive: true });
cpSync('node_modules/react/umd/react.production.min.js', 'dist-site/vendor/react.js');
cpSync('node_modules/react-dom/umd/react-dom.production.min.js', 'dist-site/vendor/react-dom.js');
cpSync('public/assets', 'dist-site/assets', { recursive: true });
writeFileSync('dist-site/.nojekyll', '');
writeFileSync('dist-site/index.html', `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0C2643">
<link rel="icon" href="${FAVICON}">
<meta property="og:type" content="website">
<meta property="og:title" content="LearnSpace">
<meta property="og:description" content="Apprendre à ton rythme avec Léa, ton assistante.">
<style>:root{color-scheme:light}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>
${head}
</head>
<body>
<noscript><p style="padding:24px;font:16px system-ui,sans-serif">Active JavaScript pour utiliser LearnSpace.</p></noscript>
${body('vendor/react.js', 'vendor/react-dom.js')}
</body>
</html>
`);

const kb = (n) => (n / 1024).toFixed(0) + ' KB';
console.log('built', 'js', kb(js.length), 'css', kb(css.length), 'page', kb(readFileSync('dist/index.html').length));

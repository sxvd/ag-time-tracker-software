import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build, transform } from 'esbuild'

const root = dirname(fileURLToPath(new URL('../package.json', import.meta.url)))
const finalPath = join(root, 'artifacts', 'standalone', 'AirGradient-Time-Tracker-Standalone.html')

const appFiles = [
  'src/domain/data.js',
  'src/standalone/mock-api.js',
  'src/domain/selectors.js',
  'src/ui/components.jsx',
  'src/ui/breezy.jsx',
  'src/ui/FeedbackModal.jsx',
  'src/state/store.jsx',
  'src/views/PersonalView.jsx',
  'src/views/CompanyView.jsx',
  'src/views/JourneyView.jsx',
  'src/views/MiscViews.jsx',
  'src/views/TodayView.jsx',
  'src/app/app.jsx',
]

const escapeScript = (code) => code.replace(/<\/script/gi, '<\\/script')

const reactBundle = await build({
  stdin: {
    contents: `
      import React from 'react'
      import { createRoot } from 'react-dom/client'
      window.React = React
      window.ReactDOM = { createRoot }
    `,
    resolveDir: root,
    loader: 'js',
  },
  bundle: true,
  write: false,
  format: 'iife',
  target: ['chrome89', 'edge89'],
  minify: true,
})

const scripts = [reactBundle.outputFiles[0].text]

const breezyUris = Object.fromEntries(
  readdirSync(join(root, 'public', 'assets', 'breezy-sm'))
    .filter((file) => file.endsWith('.png'))
    .map((file) => {
      const key = file.replace(/\.png$/, '')
      const bytes = readFileSync(join(root, 'public', 'assets', 'breezy-sm', file))
      return [key, `data:image/png;base64,${bytes.toString('base64')}`]
    }),
)
breezyUris.break = breezyUris.coffee
scripts.push(`window.__BZ_URIS=${JSON.stringify(breezyUris)};`)

for (const file of appFiles) {
  const source = readFileSync(join(root, file), 'utf8')
  const loader = extname(file) === '.jsx' ? 'jsx' : 'js'
  const result = await transform(source, {
    loader,
    jsx: 'transform',
    jsxFactory: 'React.createElement',
    jsxFragment: 'React.Fragment',
    format: 'iife',
    target: ['chrome89', 'edge89'],
    minify: true,
  })
  scripts.push(`/* ${file} */\n${result.code}`)
}

const css = readFileSync(join(root, 'src', 'styles.css'), 'utf8')
const scriptTags = scripts.map((script) => `<script>\n${escapeScript(script)}\n</script>`).join('\n')

const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="ag-standalone-demo" content="Runs without localhost. Data is stored in this browser only." />
    <title>AirGradient Time Tracker - Standalone Demo</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Catamaran:wght@500;600;700;800&family=Cabin:wght@400;500;600;700&family=Spline+Sans+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
    <style>
${css}
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script>
      window.__agShowStandaloneError = function(error) {
        console.error(error);
        var text = String(error && (error.stack || error.message) || error).replace(/[&<>]/g, function(c) {
          return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c];
        });
        document.body.innerHTML = '<div style="font-family:system-ui,sans-serif;max-width:720px;margin:48px auto;padding:24px;border:1px solid #d6e4ef;border-radius:12px"><h1 style="margin:0 0 8px;color:#1C75BC">Standalone demo could not start</h1><p style="margin:0 0 14px;color:#566579">Please open this file in a current Chrome or Microsoft Edge browser. If it still fails, send the error below.</p><pre style="white-space:pre-wrap;background:#f4f8fb;padding:12px;border-radius:8px;color:#263746">' + text + '</pre></div>';
      };
      window.addEventListener('error', function(event) { window.__agShowStandaloneError(event.error || event.message); });
      window.addEventListener('unhandledrejection', function(event) { window.__agShowStandaloneError(event.reason); });
    </script>
${scriptTags}
  </body>
</html>
`

mkdirSync(dirname(finalPath), { recursive: true })
writeFileSync(finalPath, html, 'utf8')
console.log(`Standalone HTML written to ${finalPath}`)

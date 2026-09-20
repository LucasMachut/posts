// Fabrique « Posts (PC).html » : l'application en un seul fichier, qui s'ouvre en double-clic
// sans serveur (Chrome refuse les modules JavaScript depuis un fichier local).
//   node app/build-pc.js
const fs = require('fs'), path = require('path');
const APP = __dirname, OUT = path.join(APP, '..', 'Posts (PC).html');
const ORDER = ['model', 'state', 'geometry', 'veil', 'grain', 'photos', 'gestures', 'render', 'export', 'generator', 'ui', 'main'];

function bundleModule(name) {
  let src = fs.readFileSync(path.join(APP, 'js', name + '.js'), 'utf8');
  const exported = [];
  src = src.replace(/^import\s+\*\s+as\s+(\w+)\s+from\s+'\.\/(\w+)\.js';\s*$/gm, (_, alias, mod) => `const ${alias} = __m_${mod};`);
  src = src.replace(/^import\s+\{([^}]+)\}\s+from\s+'\.\/(\w+)\.js';\s*$/gm, (_, names, mod) => `const {${names}} = __m_${mod};`);
  src = src.replace(/^export\s+(const|let|function|async function)\s+(\w+)/gm, (_, kind, id) => { exported.push(id); return `${kind} ${id}`; });
  if (/^export\b/m.test(src)) throw new Error('export non gere dans ' + name);
  if (/^import\b/m.test(src)) throw new Error('import non gere dans ' + name);
  const ret = exported.map(id => `get ${id}() { return ${id}; }`).join(', ');
  return `const __m_${name} = (() => {\n${src}\nreturn { ${ret} };\n})();\n`;
}

let html = fs.readFileSync(path.join(APP, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(APP, 'css', 'app.css'), 'utf8');
const js = ORDER.map(bundleModule).join('\n');
html = html
  .replace(/<link rel="manifest"[^>]*>\s*/, '')
  .replace(/href="icons\//g, 'href="app/icons/')
  // remplacements par fonction : dans une chaine de remplacement, « $$ » deviendrait « $ »
  .replace('<link rel="stylesheet" href="css/app.css">', () => `<style>\n${css}\n</style>`)
  .replace('<script type="module" src="js/main.js"></script>', () => `<script>\n${js}\n</script>`);
fs.writeFileSync(OUT, html);
console.log('ecrit :', OUT, Math.round(html.length / 1024) + ' Ko');

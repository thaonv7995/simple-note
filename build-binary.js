import fs from 'fs';
import { execSync } from 'child_process';

const indexHtml = fs.readFileSync('public/index.html', 'utf8');
const styleCss = fs.readFileSync('public/style.css', 'utf8');
const bundleJs = fs.readFileSync('public/bundle.js', 'utf8');
const faviconSvg = fs.readFileSync('public/favicon.svg', 'utf8');

let serverCode = fs.readFileSync('server.js', 'utf8');

const staticCode = `
      if (ext === ".html") { res.setHeader("Cache-Control", "no-cache"); res.writeHead(200, { "Content-Type": "text/html" }); return res.end(${JSON.stringify(indexHtml)}); }
      if (ext === ".css") { res.setHeader("Cache-Control", "public, max-age=31536000"); res.writeHead(200, { "Content-Type": "text/css" }); return res.end(${JSON.stringify(styleCss)}); }
      if (ext === ".js") { res.setHeader("Cache-Control", "public, max-age=31536000"); res.writeHead(200, { "Content-Type": "application/javascript" }); return res.end(${JSON.stringify(bundleJs)}); }
      if (ext === ".svg") { res.setHeader("Cache-Control", "public, max-age=31536000"); res.writeHead(200, { "Content-Type": "image/svg+xml" }); return res.end(${JSON.stringify(faviconSvg)}); }
      res.writeHead(404); return res.end("Not Found");
`;

serverCode = serverCode.replace(
  /fs\.readFile\(filePath[\s\S]*?\}\);[\s\S]*?return;/m,
  staticCode
);

serverCode = serverCode.replace(
  /if \(process\.argv\[1\] && import\.meta\.url === pathToFileURL\(process\.argv\[1\]\)\.href\) \{/,
  `if (true) {`
);

serverCode = serverCode.replace(
  /const projectDir = path\.dirname\(fileURLToPath\(import\.meta\.url\)\);/,
  `const projectDir = process.cwd();`
);

fs.writeFileSync('server.bundled.js', serverCode);

console.log('Converting to CommonJS with esbuild...');
execSync('npx esbuild server.bundled.js --bundle --platform=node --format=cjs --outfile=server.cjs', { stdio: 'inherit' });

console.log('Compiling native binaries with pkg...');
execSync('npx pkg server.cjs --targets node18-macos-arm64,node18-macos-x64,node18-linux-x64,node18-win-x64 --out-path dist-bin', { stdio: 'inherit' });

fs.unlinkSync('server.bundled.js');
fs.unlinkSync('server.cjs');
console.log('Native binaries are located in dist-bin/ directory!');

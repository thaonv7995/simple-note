import fs from 'fs';
import { execSync } from 'child_process';

const indexHtml = fs.readFileSync('public/index.html', 'utf8');
const styleCss = fs.readFileSync('public/style.css', 'utf8');
const bundleJs = fs.readFileSync('public/bundle.js', 'utf8');
const faviconSvg = fs.readFileSync('public/favicon.svg', 'utf8');

let serverCode = fs.readFileSync('server.js', 'utf8');

const staticCode = `
  async function serveFile(response, filename, contentType, cacheControl = "no-cache") {
      let content = "";
      if (filename === "index.html") { content = ${JSON.stringify(indexHtml)}; }
      else if (filename === "style.css" || filename.includes("style.css")) { content = ${JSON.stringify(styleCss)}; }
      else if (filename === "bundle.js" || filename.includes("bundle.js")) { content = ${JSON.stringify(bundleJs)}; }
      else if (filename === "favicon.svg" || filename.includes("favicon.svg")) { content = ${JSON.stringify(faviconSvg)}; }
      else {
          sendJson(response, 404, { error: "Not found" });
          return;
      }
      response.writeHead(200, {
        "Content-Type": contentType,
        "Content-Length": Buffer.byteLength(content, "utf8"),
        "Cache-Control": cacheControl
      });
      response.end(content);
  }
`;

serverCode = serverCode.replace(
  /async function serveFile\([\s\S]*?\}\n\}/m,
  () => staticCode
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

import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
const dist = "dist",
  assets = {};
async function embed(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = join(directory, entry.name);
    if (entry.isDirectory()) await embed(file);
    else if (entry.name.endsWith(".png"))
      assets[file.replace(/^public\//, "")] =
        `data:image/png;base64,${(await readFile(file)).toString("base64")}`;
  }
}
await embed("public/assets");
assets["data/asset-manifest.json"] =
  "https://github.com/iamDuckduck/shadowverse-puzzle-lab/blob/main/public/data/asset-manifest.json";
const files = await readdir(join(dist, "assets"));
const jsFile = files.find((f) => /^index-.*\.js$/.test(f)),
  cssFile = files.find((f) => /^index-.*\.css$/.test(f));
if (!jsFile || !cssFile) throw new Error("Run the production build first.");
const js = (await readFile(join(dist, "assets", jsFile), "utf8")).replace(
  /<\/script/gi,
  "<\\/script",
);
const css = await readFile(join(dist, "assets", cssFile), "utf8");
const html = `<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>斬殺研究室 · 可下載預覽</title><style>${css}</style><div id="root"></div><script>window.__WB_ASSETS=${JSON.stringify(assets)};</script><script type="module">${js}</script></html>`;
await mkdir("preview", { recursive: true });
await writeFile("preview/play.html", html);
console.log(
  `Created preview/play.html (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(1)} MB), with original assets embedded. Download and open in a desktop browser; no server required.`,
);

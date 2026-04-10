import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const sourceSvg = join(rootDir, "assets", "icons", "chordforge-app-icon.svg");
const outputDir = join(rootDir, "assets", "native-icons");
const iconsetDir = join(outputDir, "ChordForge.iconset");
const pngDir = join(outputDir, "png");
const masterPng = join(outputDir, "ChordForge.png");
const icnsFile = join(outputDir, "ChordForge.icns");
const icoFile = join(outputDir, "ChordForge.ico");
const faviconFile = join(rootDir, "app", "favicon.ico");

const iconsetSizes = [
  ["icon_16x16.png", 16],
  ["icon_16x16@2x.png", 32],
  ["icon_32x32.png", 32],
  ["icon_32x32@2x.png", 64],
  ["icon_128x128.png", 128],
  ["icon_128x128@2x.png", 256],
  ["icon_256x256.png", 256],
  ["icon_256x256@2x.png", 512],
  ["icon_512x512.png", 512],
  ["icon_512x512@2x.png", 1024],
];

const icoSizes = [16, 24, 32, 48, 64, 128, 256];

function ensureDir(pathname) {
  mkdirSync(pathname, { recursive: true });
}

function cleanDir(pathname) {
  rmSync(pathname, { recursive: true, force: true });
  mkdirSync(pathname, { recursive: true });
}

function run(command, args) {
  execFileSync(command, args, { stdio: "inherit" });
}

function renderMasterPng() {
  const quickLookPng = join(outputDir, `${basename(sourceSvg)}.png`);

  rmSync(quickLookPng, { force: true });
  rmSync(masterPng, { force: true });

  run("qlmanage", ["-t", "-s", "1024", "-o", outputDir, sourceSvg]);

  if (!existsSync(quickLookPng)) {
    throw new Error(`Quick Look did not produce a PNG at ${quickLookPng}`);
  }

  renameSync(quickLookPng, masterPng);
}

function renderPng(size, outFile) {
  run("sips", [
    "-s",
    "format",
    "png",
    "-z",
    String(size),
    String(size),
    masterPng,
    "--out",
    outFile,
  ]);
}

function writeIco({ entries, outFile }) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);

  let offset = header.length + entries.length * 16;
  const directory = [];
  const payloads = [];

  entries.forEach(({ size, file }) => {
    const data = readFileSync(file);
    const record = Buffer.alloc(16);

    record.writeUInt8(size === 256 ? 0 : size, 0);
    record.writeUInt8(size === 256 ? 0 : size, 1);
    record.writeUInt8(0, 2);
    record.writeUInt8(0, 3);
    record.writeUInt16LE(1, 4);
    record.writeUInt16LE(32, 6);
    record.writeUInt32LE(data.length, 8);
    record.writeUInt32LE(offset, 12);

    directory.push(record);
    payloads.push(data);
    offset += data.length;
  });

  writeFileSync(outFile, Buffer.concat([header, ...directory, ...payloads]));
}

if (!existsSync(sourceSvg)) {
  throw new Error(`Missing source artwork: ${sourceSvg}`);
}

ensureDir(outputDir);
cleanDir(iconsetDir);
cleanDir(pngDir);

renderMasterPng();

iconsetSizes.forEach(([filename, size]) => {
  renderPng(size, join(iconsetDir, filename));
});

const icoEntries = icoSizes.map((size) => {
  const file = join(pngDir, `icon-${size}.png`);
  renderPng(size, file);
  return { size, file };
});

run("iconutil", ["-c", "icns", iconsetDir, "-o", icnsFile]);
writeIco({ entries: icoEntries, outFile: icoFile });
copyFileSync(icoFile, faviconFile);
rmSync(iconsetDir, { recursive: true, force: true });
rmSync(pngDir, { recursive: true, force: true });

console.log("");
console.log("Generated native icons:");
console.log(`- ${masterPng}`);
console.log(`- ${icnsFile}`);
console.log(`- ${icoFile}`);
console.log(`- ${faviconFile}`);

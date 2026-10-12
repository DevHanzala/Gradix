// Regenerates the OCR test fixtures:
//   node tests/fixtures/generateFixtures.mjs
// ocr-sample.png      - an image of printed English text
// scanned-sample.pdf  - a PDF whose only content is that image (no text layer)
import { writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createCanvas } from "@napi-rs/canvas";
import { PDFDocument } from "pdf-lib";

const dir = path.dirname(fileURLToPath(import.meta.url));

const lines = [
  "Photosynthesis is the process plants use to make food.",
  "Leaves capture sunlight with a green pigment called chlorophyll.",
  "Water from the roots and carbon dioxide from the air are combined.",
  "The plant produces glucose for energy and releases oxygen.",
  "This process supports almost all life on planet Earth.",
];

const width = 1600;
const height = 120 + lines.length * 70;
const canvas = createCanvas(width, height);
const ctx = canvas.getContext("2d");
ctx.fillStyle = "#ffffff";
ctx.fillRect(0, 0, width, height);
ctx.fillStyle = "#000000";
ctx.font = "40px sans-serif";
lines.forEach((line, i) => ctx.fillText(line, 60, 90 + i * 70));

const png = canvas.toBuffer("image/png");
writeFileSync(path.join(dir, "ocr-sample.png"), png);

const pdf = await PDFDocument.create();
const image = await pdf.embedPng(png);
const page = pdf.addPage([image.width / 2, image.height / 2]);
page.drawImage(image, { x: 0, y: 0, width: image.width / 2, height: image.height / 2 });
writeFileSync(path.join(dir, "scanned-sample.pdf"), await pdf.save());

console.log("fixtures written");

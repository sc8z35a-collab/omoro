// One-off asset pipeline: .raw/*.jpg (public-domain / CC0 sources) -> site/public/img/*.webp
// Note: tape2-dark / measure2-dark are produced with ImageMagick: convert X.jpg -fuzz 14-22% -fill "#0f1318" -opaque white X-dark.jpg
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const jobs = [
  { src: "lantern-red", out: "m01-lanterns" },
  { src: "lantern-single", out: "m02-lone-lantern", position: "centre" },
  { src: "beacon", out: "m03-beacon" },
  { src: "tape2-dark", out: "m04-tape" },
  { src: "measure2-dark", out: "m05-measure" },
  { src: "baseball", out: "m06-baseball" },
  { src: "spotlight2", out: "stage-beams" },
  { src: "mic", out: "stage-mic" },
  { src: "spotlight", out: "stage-blue" },
  { src: "lantern-neon", out: "lantern-neon" },
  { src: "confetti", out: "confetti" },
  { src: "glitter", out: "glitter" },
];
mkdirSync("site/public/img", { recursive: true });
for (const job of jobs) {
  for (const [suffix, width, height] of [["", 1600, 1100], ["-sm", 800, 560]]) {
    await sharp(`.raw/${job.src}.jpg`).resize(width, height, { fit: "cover", position: job.position || "attention" })
      .webp({ quality: suffix ? 70 : 76 }).toFile(`site/public/img/${job.out}${suffix}.webp`);
  }
  console.log("ok", job.out);
}

// Builds site/public/og.jpg (1200x630) from a CC0 photo + SVG typography.
import sharp from "sharp";
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#0b0c0d" stop-opacity=".96"/><stop offset=".7" stop-color="#0b0c0d" stop-opacity=".55"/><stop offset="1" stop-color="#0b0c0d" stop-opacity=".2"/></linearGradient></defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <rect x="70" y="70" width="60" height="8" fill="#d8ff4f"/>
  <text x="70" y="140" font-family="Noto Sans CJK JP" font-weight="900" font-size="46" fill="#eef0e8">OMORO.</text>
  <text x="70" y="330" font-family="Noto Sans CJK JP" font-weight="900" font-size="120" fill="#eef0e8">それが、</text>
  <text x="70" y="470" font-family="Noto Sans CJK JP" font-weight="900" font-size="120" fill="#d8ff4f">面白い<tspan fill="#eef0e8">ねえ。</tspan></text>
  <text x="70" y="560" font-family="Noto Sans Mono CJK JP" font-size="24" fill="#c9ccc2">水曜日のダウソタウソ、あの間をもう一度。— NON-OFFICIAL FAN ARCHIVE</text>
</svg>`;
await sharp("site/public/img/m01-lanterns.webp").resize(1200, 630, { fit: "cover" }).modulate({ brightness: .7 })
  .composite([{ input: Buffer.from(svg) }]).jpeg({ quality: 84 }).toFile("site/public/og.jpg");
console.log("og.jpg ok");

import fs from "node:fs";
import { execFileSync } from "node:child_process";
const S = process.argv[2];
const photos = JSON.parse(fs.readFileSync(`${S}/photos_map.json`, "utf8")); // {UPPERcode: photoUrl}
const matchedUrls = JSON.parse(fs.readFileSync(`${S}/matched_urls.json`, "utf8")); // {UPPERcode: productUrl} for Referer
const ourCodes = fs.readFileSync(`${S}/our_codes.txt`, "utf8").split("\n").map(c => c.trim()).filter(Boolean);
const OUT = "/Users/calugareanusandu/Programare/Work/nadinauto2.09/public/produse";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";
function slugify(v) {
  return v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
let ok = 0, skip = 0;
for (const code of ourCodes) {
  const up = code.toUpperCase();
  const photo = photos[up];
  if (!photo) { skip++; continue; }
  const ref = matchedUrls[up] || "https://catalog.polcar.com/";
  const dest = `${OUT}/${slugify(code)}.webp`;
  try {
    execFileSync("curl", ["-s", "-A", UA, "-e", ref, photo, "-o", dest, "--fail"], { stdio: "ignore" });
    if (fs.statSync(dest).size > 500) { ok++; process.stderr.write("."); }
    else { fs.unlinkSync(dest); process.stderr.write("x"); }
  } catch { process.stderr.write("E"); }
}
console.error(`\ndownloaded: ${ok}, no-photo: ${skip}`);

// tsc only compiles .ts -> dist/. The app loads views/ and public/ relative to
// __dirname, so copy them next to the compiled code. User uploads are skipped:
// they are served from src/public/uploads (see app.ts).
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const skipUploads = (src) => !src.split(path.sep).includes("uploads");

for (const dir of ["views", "public"]) {
  const from = path.join(root, "src", dir);
  const to = path.join(root, "dist", dir);
  fs.rmSync(to, { recursive: true, force: true });
  fs.cpSync(from, to, { recursive: true, filter: skipUploads });
  console.log(`copied src/${dir} -> dist/${dir}`);
}

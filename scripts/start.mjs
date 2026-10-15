// Runs the production build from source: `npm run build && npm start`.
// The standalone server changes its working directory, so the data folder is
// pinned to ./data in the project root unless DATA_DIR is set.
import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

const root = process.cwd()
if (fs.existsSync(path.join(root, ".env"))) process.loadEnvFile(path.join(root, ".env"))
process.env.DATA_DIR = path.resolve(root, process.env.DATA_DIR || "data")

const standalone = path.join(root, ".next", "standalone")
if (!fs.existsSync(path.join(standalone, "server.js"))) {
  console.error("No build found. Run `npm run build` first.")
  process.exit(1)
}
// The standalone server serves these only when they sit next to it.
fs.cpSync(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"), { recursive: true })
if (fs.existsSync(path.join(root, "public"))) fs.cpSync(path.join(root, "public"), path.join(standalone, "public"), { recursive: true })

await import(pathToFileURL(path.join(standalone, "server.js")).href)

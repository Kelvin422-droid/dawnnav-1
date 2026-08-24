import fs from "node:fs/promises";
import path from "node:path";
import yaml from "../vendor/js-yaml.mjs";

const root = path.resolve(import.meta.dirname, "..");
const source = path.join(root, "data", "webstack.yml");
const outputDirectory = path.join(root, "app", "_generated");
const output = path.join(outputDirectory, "webstack.seed.json");
const data = yaml.load(await fs.readFile(source, "utf8"));

await fs.mkdir(outputDirectory, { recursive: true });
await fs.writeFile(output, `${JSON.stringify(data)}\n`, "utf8");
console.log(`Generated ${path.relative(root, output)} with ${data.length} categories.`);

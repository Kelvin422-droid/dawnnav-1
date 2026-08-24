import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import yaml from "../vendor/js-yaml.mjs";

const root = path.resolve(import.meta.dirname, "..");
const distDirectory = path.join(root, "dist");

await rm(distDirectory, { recursive: true, force: true });
await mkdir(path.join(distDirectory, "server"), { recursive: true });
await mkdir(path.join(distDirectory, "client"), { recursive: true });
await mkdir(path.join(distDirectory, ".openai"), { recursive: true });

const hugo = spawnSync(
  "hugo",
  ["--destination", path.join(distDirectory, "client"), "--cleanDestinationDir"],
  { cwd: root, encoding: "utf8", shell: process.platform === "win32" }
);
if (hugo.stdout) process.stdout.write(hugo.stdout);
if (hugo.stderr) process.stderr.write(hugo.stderr);
if (hugo.status !== 0) {
  throw new Error(`Hugo 构建失败，退出码：${hugo.status ?? "unknown"}`);
}

await cp(path.join(root, "worker"), path.join(distDirectory, "server"), {
  recursive: true
});
await cp(
  path.join(root, ".openai", "hosting.json"),
  path.join(distDirectory, ".openai", "hosting.json")
);
await cp(
  path.join(root, "drizzle"),
  path.join(distDirectory, ".openai", "drizzle"),
  { recursive: true }
);

const seed = yaml.load(await readFile(path.join(root, "data", "webstack.yml"), "utf8"));
await writeFile(
  path.join(distDirectory, "client", "webstack.seed.json"),
  JSON.stringify(seed),
  "utf8"
);

console.log("动态网站构建完成：dist/");

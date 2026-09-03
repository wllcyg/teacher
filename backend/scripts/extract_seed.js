// 从原单文件应用里抽取 seed() 示例数据，转成 JSON。
// 用法: node extract_seed.js <page_index.html> <out.json>
const fs = require("fs");

const html = fs.readFileSync(process.argv[2], "utf8");
const start = html.indexOf("// ==SAMPLE-START==");
const end = html.indexOf("// ==SAMPLE-END==");
if (start < 0 || end < 0) {
  console.error("未找到 SAMPLE 标记");
  process.exit(1);
}
const chunk = html.slice(start, end);
const retIdx = chunk.indexOf("return");
if (retIdx < 0) {
  console.error("未找到 return 语句");
  process.exit(1);
}
let objText = chunk.slice(retIdx + "return".length).trim().replace(/;\s*$/, "");
const obj = new Function("return " + objText)();
fs.writeFileSync(process.argv[3], JSON.stringify(obj, null, 2));
const keys = Object.keys(obj);
console.log("seedVersion:", obj.seedVersion);
for (const k of keys) {
  if (k === "seedVersion") continue;
  console.log(k, ":", obj[k].length, "行");
}

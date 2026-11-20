import fs from "node:fs/promises";
import path from "node:path";
import { Workbook, SpreadsheetFile } from "file:///C:/Users/feiyu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs";

const outputDir = path.resolve("outputs/01a04687-6ed7-72d3-a3a4-54d899bde3bf");
await fs.mkdir(outputDir, { recursive: true });

const period2 = [
  ["10体力", 834, 834],
  ["1480宝石", 128, 1],
  ["190宝石", 1296, 72],
  ["350宝石", 4620, 154],
  ["60分钟无限体力", 858, 143],
  ["60宝石", 3144, 524],
  ["780宝石", 2040, 30],
  ["7880宝石", 648, 1],
  ["新手礼包", 1170, 195],
  ["星途101刷新券", 66, 11],
  ["星途101挑战票", 432, 36],
  ["星途101赛季末18元冲刺礼", 792, 44],
  ["道具礼包", 8580, 286],
  ["食物礼包", 522, 29],
];

const period3 = [
  ["10体力", 1102, 1102],
  ["1480宝石", 128, 1],
  ["190宝石", 2952, 164],
  ["2980宝石", 1032, 4],
  ["350宝石", 6120, 204],
  ["60分钟无限体力", 1014, 169],
  ["60宝石", 4698, 783],
  ["780宝石", 2312, 34],
  ["7880宝石", 1944, 3],
  ["新手礼包", 1686, 281],
  ["星途101刷新券", 42, 7],
  ["星途101挑战票", 828, 69],
  ["星途101新赛季18元冲刺礼", 810, 45],
  ["星途101赛季末18元冲刺礼", 324, 18],
  ["道具礼包", 11070, 369],
  ["食物礼包", 540, 30],
];

function normalizeName(value) {
  return String(value)
    .normalize("NFKC")
    .replace(/[‐‑‒–—―]/g, "-")
    .replace(/[，、]/g, ",")
    .replace(/[：]/g, ":")
    .replace(/[（]/g, "(")
    .replace(/[）]/g, ")")
    .replace(/\s+/g, "")
    .trim();
}

function categoryOf(name) {
  if (name.includes("体力")) return "体力";
  if (name.includes("宝石")) return "宝石";
  if (name.startsWith("星途")) return "星途";
  if (name.includes("礼包")) return "礼包";
  return "其他";
}

const rawRows = [];
for (const [name, revenue, buys] of period2) {
  const normalized = normalizeName(name);
  rawRows.push(["二测", "2026-09-02 至 2026-09-07", name, normalized, categoryOf(normalized), revenue, buys, name === normalized ? "无需合并" : "符号/空格归一后合并", "AppLogger-计费点统计"]);
}
for (const [name, revenue, buys] of period3) {
  const normalized = normalizeName(name);
  rawRows.push(["三测", "2026-10-21 至 2026-10-27", name, normalized, categoryOf(normalized), revenue, buys, name === normalized ? "无需合并" : "符号/空格归一后合并", "AppLogger-计费点统计"]);
}

const groupedItems = [
  ["体力", ["10体力", "60分钟无限体力"]],
  ["宝石", ["60宝石", "190宝石", "350宝石", "780宝石", "1480宝石", "2980宝石", "7880宝石"]],
  ["礼包", ["新手礼包", "食物礼包", "道具礼包"]],
  ["星途", ["星途101挑战票", "星途101刷新券", "星途101新赛季18元冲刺礼", "星途101赛季末18元冲刺礼"]],
];

const wb = Workbook.create();
const report = wb.worksheets.add("计费点对比");
const raw = wb.worksheets.add("数据明细与合并映射");

report.showGridLines = false;
report.tabColor = "#4472C4";
raw.showGridLines = false;
raw.tabColor = "#70AD47";

// Main report title and notes.
report.mergeCells("A1:N1");
report.getRange("A1").values = [["保卫萝卜4微信小游戏｜二测 vs 三测计费点收入对比"]];
report.getRange("A1:N1").format = {
  fill: "#5B9BD5",
  font: { name: "Microsoft YaHei", size: 16, bold: true, color: "#FFFFFF" },
  horizontalAlignment: "center",
  verticalAlignment: "center",
};
report.getRange("A1:N1").format.rowHeight = 34;

report.mergeCells("A2:N2");
report.getRange("A2").values = [["数据源：AppLogger（保卫萝卜4·微信小游戏）计费点统计｜二测：2026-09-02 至 2026-09-07｜三测：2026-10-21 至 2026-10-27"]];
report.getRange("A2:N2").format = {
  fill: "#DDEBF7",
  font: { name: "Microsoft YaHei", size: 10, color: "#1F4E78" },
  horizontalAlignment: "left",
  verticalAlignment: "center",
};
report.getRange("A2:N2").format.rowHeight = 24;

report.mergeCells("A3:N3");
report.getRange("A3").values = [["名称核对：已执行全/半角、连接符、中文标点及空格归一；本次未发现仅因符号不同而产生的重复计费点，语义不同的“新赛季/赛季末冲刺礼”分别保留。"]];
report.getRange("A3:N3").format = {
  fill: "#FFF2CC",
  font: { name: "Microsoft YaHei", size: 10, color: "#7F6000" },
  horizontalAlignment: "left",
  verticalAlignment: "center",
  wrapText: true,
};
report.getRange("A3:N3").format.rowHeight = 30;

// Two-level header.
report.mergeCells("A4:A5"); report.getRange("A4").values = [["汇总"]];
report.mergeCells("B4:B5"); report.getRange("B4").values = [["付费项"]];
report.mergeCells("C4:D4"); report.getRange("C4").values = [["收入"]];
report.mergeCells("E4:F4"); report.getRange("E4").values = [["收入贡献占比"]];
report.mergeCells("G4:H4"); report.getRange("G4").values = [["收入-按类型汇总"]];
report.mergeCells("I4:J4"); report.getRange("I4").values = [["类型收入贡献占比"]];
report.mergeCells("K4:N4"); report.getRange("K4").values = [["对比（三测 - 二测）"]];
report.getRange("C5:N5").values = [["二测", "三测", "二测", "三测", "二测", "三测", "二测", "三测", "变动值", "变动值-类型", "变动幅度-类型", "单项变化率"]];
report.getRange("A4:N5").format = {
  fill: "#8EAADB",
  font: { name: "Microsoft YaHei", size: 10, bold: true, color: "#000000" },
  horizontalAlignment: "center",
  verticalAlignment: "center",
  wrapText: true,
  borders: { preset: "all", style: "thin", color: "#7F7F7F" },
};
report.getRange("C5:N5").format.fill = "#B4C6E7";
report.getRange("A4:N5").format.rowHeight = 28;

const rawLastRow = rawRows.length + 2;
let reportRow = 6;
const categoryRanges = [];
for (const [category, items] of groupedItems) {
  const start = reportRow;
  for (const item of items) {
    report.getRange(`A${reportRow}:B${reportRow}`).values = [[category, item]];
    report.getRange(`C${reportRow}`).formulas = [[`=SUMIFS('数据明细与合并映射'!$F$3:$F$${rawLastRow},'数据明细与合并映射'!$D$3:$D$${rawLastRow},$B${reportRow},'数据明细与合并映射'!$A$3:$A$${rawLastRow},"二测")`]];
    report.getRange(`D${reportRow}`).formulas = [[`=SUMIFS('数据明细与合并映射'!$F$3:$F$${rawLastRow},'数据明细与合并映射'!$D$3:$D$${rawLastRow},$B${reportRow},'数据明细与合并映射'!$A$3:$A$${rawLastRow},"三测")`]];
    report.getRange(`K${reportRow}`).formulas = [[`=D${reportRow}-C${reportRow}`]];
    report.getRange(`N${reportRow}`).formulas = [[`=IFERROR(K${reportRow}/C${reportRow},"")`]];
    reportRow += 1;
  }
  const end = reportRow - 1;
  categoryRanges.push({ category, start, end });
  report.mergeCells(`A${start}:A${end}`);
  report.mergeCells(`G${start}:G${end}`);
  report.mergeCells(`H${start}:H${end}`);
  report.mergeCells(`I${start}:I${end}`);
  report.mergeCells(`J${start}:J${end}`);
  report.mergeCells(`L${start}:L${end}`);
  report.mergeCells(`M${start}:M${end}`);
  report.getRange(`G${start}`).formulas = [[`=SUM(C${start}:C${end})`]];
  report.getRange(`H${start}`).formulas = [[`=SUM(D${start}:D${end})`]];
  report.getRange(`L${start}`).formulas = [[`=H${start}-G${start}`]];
  report.getRange(`M${start}`).formulas = [[`=IFERROR(L${start}/G${start},"")`]];
}

const totalRow = reportRow;
report.mergeCells(`A${totalRow}:B${totalRow}`);
report.getRange(`A${totalRow}`).values = [["总计"]];
report.getRange(`C${totalRow}`).formulas = [[`=SUM(C6:C${totalRow - 1})`]];
report.getRange(`D${totalRow}`).formulas = [[`=SUM(D6:D${totalRow - 1})`]];
report.getRange(`E${totalRow}:F${totalRow}`).values = [[1, 1]];
report.getRange(`G${totalRow}`).formulas = [[`=C${totalRow}`]];
report.getRange(`H${totalRow}`).formulas = [[`=D${totalRow}`]];
report.getRange(`I${totalRow}:J${totalRow}`).values = [[1, 1]];
report.getRange(`K${totalRow}`).formulas = [[`=D${totalRow}-C${totalRow}`]];
report.getRange(`L${totalRow}`).formulas = [[`=K${totalRow}`]];
report.getRange(`M${totalRow}:N${totalRow}`).formulas = [[`=IFERROR(L${totalRow}/G${totalRow},"")`, `=IFERROR(K${totalRow}/C${totalRow},"")`]];

// Fill contribution formulas after total row exists.
for (let r = 6; r < totalRow; r++) {
  report.getRange(`E${r}`).formulas = [[`=IFERROR(C${r}/$C$${totalRow},0)`]];
  report.getRange(`F${r}`).formulas = [[`=IFERROR(D${r}/$D$${totalRow},0)`]];
}
for (const { start } of categoryRanges) {
  report.getRange(`I${start}`).formulas = [[`=IFERROR(G${start}/$C$${totalRow},0)`]];
  report.getRange(`J${start}`).formulas = [[`=IFERROR(H${start}/$D$${totalRow},0)`]];
}

// Main table formatting.
report.getRange(`A6:N${totalRow}`).format = {
  font: { name: "Microsoft YaHei", size: 10, color: "#222222" },
  verticalAlignment: "center",
  borders: { preset: "all", style: "thin", color: "#A6A6A6" },
};
report.getRange(`A6:A${totalRow - 1}`).format = { fill: "#D9E2F3", font: { name: "Microsoft YaHei", size: 10, bold: true }, horizontalAlignment: "center", verticalAlignment: "center", borders: { preset: "all", style: "thin", color: "#A6A6A6" } };
report.getRange(`B6:B${totalRow - 1}`).format = { font: { name: "Microsoft YaHei", size: 10 }, horizontalAlignment: "left", verticalAlignment: "center", borders: { preset: "all", style: "thin", color: "#A6A6A6" } };
report.getRange(`C6:D${totalRow}`).format.horizontalAlignment = "right";
report.getRange(`E6:F${totalRow}`).format.fill = "#FCE4D6";
report.getRange(`G6:J${totalRow - 1}`).format.fill = "#E2F0D9";
report.getRange(`K6:N${totalRow - 1}`).format.fill = "#F2F2F2";
report.getRange(`A${totalRow}:N${totalRow}`).format = { fill: "#D9EAF7", font: { name: "Microsoft YaHei", size: 10, bold: true }, verticalAlignment: "center", horizontalAlignment: "center", borders: { preset: "all", style: "thin", color: "#7F7F7F" } };
report.getRange(`C6:D${totalRow}`).format.numberFormat = "#,##0";
report.getRange(`G6:H${totalRow}`).format.numberFormat = "#,##0";
report.getRange(`K6:L${totalRow}`).format.numberFormat = "#,##0;[Green]-#,##0";
report.getRange(`E6:F${totalRow}`).format.numberFormat = "0.00%";
report.getRange(`I6:J${totalRow}`).format.numberFormat = "0.00%";
report.getRange(`M6:N${totalRow}`).format.numberFormat = "0.00%;[Green]-0.00%";
report.getRange(`K6:N${totalRow}`).conditionalFormats.add("cellIs", { operator: "greaterThan", formula: 0, format: { font: { color: "#C00000" } } });
report.getRange(`K6:N${totalRow}`).conditionalFormats.add("cellIs", { operator: "lessThan", formula: 0, format: { font: { color: "#008000" } } });
report.getRange(`N6:N${totalRow - 1}`).conditionalFormats.add("dataBar", { color: "#F4B183", gradient: true, thresholds: ["min", "max"] });

// Sizes and panes.
const widths = [11, 28, 13, 13, 14, 14, 16, 16, 16, 16, 14, 16, 16, 14];
for (let c = 0; c < widths.length; c++) report.getRangeByIndexes(0, c, totalRow, 1).format.columnWidth = widths[c];
report.getRange(`A6:N${totalRow}`).format.rowHeight = 25;
report.freezePanes.freezeRows(5);
report.freezePanes.freezeColumns(2);

// Raw data and normalization audit sheet.
raw.mergeCells("A1:I1");
raw.getRange("A1").values = [["数据明细与合并映射（AppLogger 原始计费点）"]];
raw.getRange("A1:I1").format = { fill: "#70AD47", font: { name: "Microsoft YaHei", size: 14, bold: true, color: "#FFFFFF" }, horizontalAlignment: "center", verticalAlignment: "center" };
raw.getRange("A1:I1").format.rowHeight = 32;
raw.getRange("A2:I2").values = [["周期", "日期范围", "原始计费点", "归一后计费点", "分类", "收入", "购买次数", "合并处理", "来源"]];
raw.getRange("A2:I2").format = { fill: "#A9D18E", font: { name: "Microsoft YaHei", size: 10, bold: true }, horizontalAlignment: "center", verticalAlignment: "center", wrapText: true, borders: { preset: "all", style: "thin", color: "#7F7F7F" } };
raw.getRange(`A3:I${rawLastRow}`).values = rawRows;
raw.getRange(`A3:I${rawLastRow}`).format = { font: { name: "Microsoft YaHei", size: 10 }, verticalAlignment: "center", borders: { preset: "all", style: "thin", color: "#BFBFBF" } };
raw.getRange(`F3:G${rawLastRow}`).format.numberFormat = "#,##0";
raw.getRange(`A3:A${rawLastRow}`).format.horizontalAlignment = "center";
raw.getRange(`E3:E${rawLastRow}`).format.horizontalAlignment = "center";
raw.getRange(`H3:H${rawLastRow}`).format.horizontalAlignment = "center";
const rawWidths = [10, 24, 30, 30, 10, 13, 13, 22, 24];
for (let c = 0; c < rawWidths.length; c++) raw.getRangeByIndexes(0, c, rawLastRow, 1).format.columnWidth = rawWidths[c];
raw.getRange(`A2:I${rawLastRow}`).format.rowHeight = 24;
raw.freezePanes.freezeRows(2);
raw.freezePanes.freezeColumns(2);

await wb.recalculate();

const overview = await wb.inspect({ kind: "sheet", include: "id,name", maxChars: 3000 });
console.log("SHEETS", overview.ndjson ?? overview);
const reportInspect = await wb.inspect({ kind: "region", sheetId: "计费点对比", range: `A1:N${totalRow}`, maxChars: 12000, tableMaxRows: 30, tableMaxCols: 14 });
console.log("REPORT", reportInspect.ndjson ?? reportInspect);
const formulaErrors = await wb.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A", options: { useRegex: true, maxResults: 100 }, maxChars: 5000 });
console.log("ERROR_SCAN", formulaErrors.ndjson ?? formulaErrors);

for (const sheetName of ["计费点对比", "数据明细与合并映射"]) {
  const preview = await wb.render({ sheetName, autoCrop: "all", scale: 1, format: "png" });
  const bytes = new Uint8Array(await preview.arrayBuffer());
  const safeName = sheetName === "计费点对比" ? "preview_report.png" : "preview_raw.png";
  await fs.writeFile(path.join(outputDir, safeName), bytes);
}

const output = await SpreadsheetFile.exportXlsx(wb);
const outputPath = path.join(outputDir, "保卫萝卜4微信小游戏_二测三测计费点收入对比.xlsx");
await output.save(outputPath);
console.log("OUTPUT", outputPath);

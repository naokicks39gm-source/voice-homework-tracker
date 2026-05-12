const { buildSummary } = require('./summary.js');

const mockHistory = [
  { key: "1-1-宿題8", data: { 1: true, 2: true, 5: true } },
  { key: "1-1-宿題9", data: { 3: true } }
];

const summary = buildSummary(mockHistory, 1, 1, 30);
if (summary.length > 0 && summary[0].hw === 8) {
  console.log("✅ 集計テスト成功: キーが正しくパースされました。");
  process.exit(0);
} else {
  console.error("❌ 集計テスト失敗: パースまたはプレフィックスの一致に問題があります。");
  process.exit(1);
}

// 解析ロジックの分離とテスト
function parseInput(input) {
  // 正規表現: (項目名)(数値) (アクション) (番号)
  const regex = /^([^\d]+)(\d+)\s+(.+?)\s+(.+)$/;
  const match = input.match(regex);

  if (!match) {
    throw new Error("Invalid format: " + input);
  }

  return {
    category: match[1],   // "朝学習"
    categoryId: match[2], // "1"
    action: match[3],     // "提出"
    targetIds: match[4]   // "1番2番"
  };
}

// テスト実行
try {
  const testData = "朝学習1 提出 1番2番";
  const result = parseInput(testData);
  console.log("解析成功:", result);
  
  if (result.category === "朝学習" && result.categoryId === "1") {
    console.log("テスト通過: 期待通りの値が抽出されました。");
  }
} catch (e) {
  console.error("テスト失敗:", e.message);
}

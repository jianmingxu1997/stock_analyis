// 查找匹配不上的股票
const fs = require('fs');
const path = require('path');

const TECHNICAL_FILE = path.join(__dirname, 'data', 'factors', 'technical_2026-03-01.json');
const STOCK_POOL_FILE = path.join(__dirname, 'stock-pool-from-total-stocks.json');

console.log('🔍 查找匹配不上的股票...\n');

const techData = JSON.parse(fs.readFileSync(TECHNICAL_FILE, 'utf8'));
const poolData = JSON.parse(fs.readFileSync(STOCK_POOL_FILE, 'utf8'));

const techCodes = new Set(Object.keys(techData.factors));
const missing = poolData.stockPool.filter(s => !techCodes.has(s.tsCode));

console.log(`❌ 匹配不上的 ${missing.length} 只股票:\n`);

missing.forEach((s, i) => {
    console.log(`${i+1}. ${s.tsCode} - ${s.name}`);
    console.log(`   行业：${s.industry}`);
    console.log(`   市值：${s.marketCap.toFixed(2)}亿`);
    console.log(`   股价：${s.price.toFixed(2)}元`);
    console.log(`   PE: ${s.pe}`);
    console.log('');
});

console.log('💡 建议：将这 3 只股票从股票池中剔除\n');

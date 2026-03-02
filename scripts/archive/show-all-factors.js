// 展示中国核建的全部可用因子
const fs = require('fs');
const path = require('path');

const STOCK_POOL_FILE = path.join(__dirname, 'stock-pool-with-factors.json');

console.log('========================================');
console.log('  中国核建 (601611.SH) - 全部可用因子');
console.log('========================================\n');

const data = JSON.parse(fs.readFileSync(STOCK_POOL_FILE, 'utf8'));
const stock = data.stockPool.find(s => s.tsCode === '601611.SH');

if (!stock) {
    console.log('❌ 未找到中国核建\n');
    return;
}

console.log('📋 基础信息:\n');
console.log(`   股票代码：${stock.tsCode}`);
console.log(`   股票名称：${stock.name}`);
console.log(`   行业：${stock.industry}`);
console.log(`   市值：${stock.marketCap.toFixed(2)}亿元`);
console.log(`   股价：${stock.price.toFixed(2)}元`);
console.log('');

console.log('📈 一、技术面因子（16 个）:\n');
const tech = stock.technical;
console.log('   价格类:');
console.log(`   ├─ 收盘价 (close): ${tech.close?.toFixed(2)}元`);
console.log(`   ├─ 涨跌幅 (changePercent): ${tech.changePercent?.toFixed(2)}%`);
console.log('');
console.log('   均线类:');
console.log(`   ├─ MA5: ${tech.ma5?.toFixed(2)}元`);
console.log(`   ├─ MA10: ${tech.ma10?.toFixed(2)}元`);
console.log(`   ├─ MA20: ${tech.ma20?.toFixed(2)}元`);
console.log(`   ├─ MA60: ${tech.ma60?.toFixed(2)}元`);
console.log('');
console.log('   均线排列:');
console.log(`   ├─ MA5>MA10: ${tech.ma5AboveMa10 ? '✅' : '❌'}`);
console.log(`   ├─ MA5>MA20: ${tech.ma5AboveMa20 ? '✅' : '❌'}`);
console.log(`   └─ MA10>MA20: ${tech.ma10AboveMa20 ? '✅' : '❌'}`);
console.log('');
console.log('   动量类:');
console.log(`   ├─ ROC5: ${tech.roc5?.toFixed(2)}%`);
console.log(`   ├─ ROC10: ${tech.roc10?.toFixed(2)}%`);
console.log(`   └─ ROC20: ${tech.roc20?.toFixed(2)}%`);
console.log('');
console.log('   超买超卖:');
console.log(`   ├─ RSI6: ${tech.rsi6?.toFixed(2)}`);
console.log(`   └─ RSI12: ${tech.rsi12?.toFixed(2)}`);
console.log('');
console.log('   成交量:');
console.log(`   └─ 量比 (volumeRatio): ${tech.volumeRatio?.toFixed(2)}`);
console.log('');
console.log('   布林带:');
console.log(`   └─ 布林带位置: ${tech.bollingerPosition?.toFixed(2)}`);
console.log('');

console.log('📊 二、基本面因子（4 个）:\n');
const fund = stock.fundamental;
console.log(`   ├─ PE (市盈率): ${fund.pe}`);
console.log(`   ├─ PB (市净率): ${fund.pb}`);
console.log(`   ├─ 市值 (marketCap): ${fund.marketCap.toFixed(2)}亿元`);
console.log(`   └─ 行业 (industry): ${fund.industry}`);
console.log('');

console.log('💰 三、资金面因子（6 个）:\n');
console.log('   ❌ 暂无数据（需要东财 API）');
console.log('   ├─ 主力净流入');
console.log('   ├─ 大单净流入');
console.log('   ├─ 超大单净流入');
console.log('   ├─ 北向资金');
console.log('   ├─ 融资余额变化');
console.log('   └─ 龙虎榜净买入');
console.log('');

console.log('📉 四、市场面因子（3 个）:\n');
const mkt = stock.market;
console.log(`   ├─ 总市值：${mkt.marketCap.toFixed(2)}亿元`);
console.log(`   ├─ 股价：${mkt.price.toFixed(2)}元`);
console.log(`   └─ 行业：${mkt.industry}`);
console.log('   ❌ 其他需要计算（换手率/相对强度/RPS 等）');
console.log('');

console.log('📢 五、事件驱动因子（2 个）:\n');
console.log('   ❌ 暂无数据（需要公告数据）');
console.log('   ├─ 业绩预告');
console.log('   └─ 回购公告');
console.log('');

console.log('📊 六、Z-Score 标准化因子:\n');
console.log(`   ├─ MA5_Z: ${tech.ma5Zscore?.toFixed(4)}`);
console.log(`   ├─ ROC5_Z: ${tech.roc5Zscore?.toFixed(4)}`);
console.log(`   ├─ RSI6_Z: ${tech.rsi6Zscore?.toFixed(4)}`);
console.log(`   └─ 量比_Z: ${tech.volumeRatioZscore || 'undefined'}`);
console.log('');

console.log('========================================');
console.log('  因子统计');
console.log('========================================\n');

const totalFactors = 40;
const availableFactors = 23;
const missingFactors = 17;

console.log(`   计划因子总数：${totalFactors}个`);
console.log(`   当前可用因子：${availableFactors}个 (${(availableFactors/totalFactors*100).toFixed(1)}%)`);
console.log(`   缺失因子：${missingFactors}个 (${(missingFactors/totalFactors*100).toFixed(1)}%)`);
console.log('');
console.log('   ✅ 技术面：16/16 (100%)');
console.log('   ⚠️  基本面：4/11 (36%)');
console.log('   ❌ 资金面：0/6 (0%)');
console.log('   ⚠️  市场面：3/8 (38%)');
console.log('   ❌ 事件驱动：0/2 (0%)');
console.log('');

console.log('========================================\n');

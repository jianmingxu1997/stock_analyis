// 查看指定股票的因子数据
const fs = require('fs');
const path = require('path');

const STOCK_POOL_FILE = path.join(__dirname, 'stock-pool-with-factors.json');

const targetStocks = ['000969.SZ', '002046.SZ', '601611.SH'];
const stockNames = {
    '000969.SZ': '安泰科技',
    '002046.SZ': '国机精工',
    '601611.SH': '中国核建'
};

console.log('========================================');
console.log('  查看指定股票因子数据');
console.log('========================================\n');

const data = JSON.parse(fs.readFileSync(STOCK_POOL_FILE, 'utf8'));
const pool = data.stockPool;

targetStocks.forEach(tsCode => {
    const stock = pool.find(s => s.tsCode === tsCode);
    
    if (stock) {
        console.log(`📊 ${tsCode} - ${stockNames[tsCode]}\n`);
        
        console.log('📋 基础信息:');
        console.log(`   行业：${stock.industry}`);
        console.log(`   市值：${stock.marketCap.toFixed(2)}亿`);
        console.log(`   股价：${stock.price.toFixed(2)}元`);
        console.log(`   PE: ${stock.pe}`);
        console.log(`   PB: ${stock.pb}\n`);
        
        console.log('📈 技术面因子:');
        const tech = stock.technical;
        console.log(`   收盘价：${tech.close?.toFixed(2)}`);
        console.log(`   涨跌幅：${tech.changePercent?.toFixed(2)}%`);
        console.log(`   MA5: ${tech.ma5?.toFixed(2)}`);
        console.log(`   MA10: ${tech.ma10?.toFixed(2)}`);
        console.log(`   MA20: ${tech.ma20?.toFixed(2)}`);
        console.log(`   MA60: ${tech.ma60?.toFixed(2)}`);
        console.log(`   MA5>MA10: ${tech.ma5AboveMa10 ? '✅' : '❌'}`);
        console.log(`   MA5>MA20: ${tech.ma5AboveMa20 ? '✅' : '❌'}`);
        console.log(`   MA10>MA20: ${tech.ma10AboveMa20 ? '✅' : '❌'}`);
        console.log(`   ROC5: ${tech.roc5?.toFixed(2)}%`);
        console.log(`   ROC10: ${tech.roc10?.toFixed(2)}%`);
        console.log(`   ROC20: ${tech.roc20?.toFixed(2)}%`);
        console.log(`   RSI6: ${tech.rsi6?.toFixed(2)}`);
        console.log(`   RSI12: ${tech.rsi12?.toFixed(2)}`);
        console.log(`   量比：${tech.volumeRatio?.toFixed(2)}`);
        console.log(`   布林带位置：${tech.bollingerPosition?.toFixed(2)}\n`);
        
        console.log('📊 Z-Score 标准化因子:');
        console.log(`   MA5_Z: ${tech.ma5Zscore?.toFixed(3)}`);
        console.log(`   ROC5_Z: ${tech.roc5Zscore?.toFixed(3)}`);
        console.log(`   RSI6_Z: ${tech.rsi6Zscore?.toFixed(3)}`);
        console.log(`   量比_Z: ${tech.volumeRatioZscore?.toFixed(3)}\n`);
        
        console.log('----------------------------------------\n');
    } else {
        console.log(`❌ 未找到 ${tsCode} - ${stockNames[tsCode]}\n`);
    }
});

console.log('========================================\n');

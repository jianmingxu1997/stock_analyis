// 整合技术面因子到股票池
const fs = require('fs');
const path = require('path');

const TECHNICAL_FILE = path.join(__dirname, 'data', 'factors', 'technical_2026-03-01.json');
const STOCK_POOL_FILE = path.join(__dirname, 'stock-pool-from-total-stocks.json');
const OUTPUT_FILE = path.join(__dirname, 'stock-pool-with-factors.json');

console.log('========================================');
console.log('  整合技术面因子到股票池');
console.log('========================================\n');

// 读取技术面因子
console.log('📖 读取技术面因子...');
const technicalData = JSON.parse(fs.readFileSync(TECHNICAL_FILE, 'utf8'));
const technicalFactors = technicalData.factors;
console.log(`✅ 技术面因子：${Object.keys(technicalFactors).length}只股票\n`);

// 读取股票池
console.log('📖 读取股票池...');
const stockPoolData = JSON.parse(fs.readFileSync(STOCK_POOL_FILE, 'utf8'));
const stockPool = stockPoolData.stockPool;
console.log(`✅ 股票池：${stockPool.length}只股票\n`);

// 匹配交集
console.log('🔗 匹配交集...');
const mergedStocks = [];
let matched = 0;
let noTechnical = 0;

stockPool.forEach(stock => {
    const tsCode = stock.tsCode;
    const techFactor = technicalFactors[tsCode];
    
    if (techFactor && techFactor.technical) {
        matched++;
        mergedStocks.push({
            // 股票池基础信息
            tsCode,
            name: stock.name,
            industry: stock.industry,
            marketCap: stock.marketCap,
            price: stock.price,
            pe: stock.pe,
            pb: stock.pb,
            
            // 技术面因子
            technical: {
                close: techFactor.technical.close,
                changePercent: techFactor.technical.changePercent,
                ma5: techFactor.technical.ma5,
                ma10: techFactor.technical.ma10,
                ma20: techFactor.technical.ma20,
                ma60: techFactor.technical.ma60,
                ma5AboveMa10: techFactor.technical.ma5_above_ma10,
                ma5AboveMa20: techFactor.technical.ma5_above_ma20,
                ma10AboveMa20: techFactor.technical.ma10_above_ma20,
                roc5: techFactor.technical.roc5,
                roc10: techFactor.technical.roc10,
                roc20: techFactor.technical.roc20,
                rsi6: techFactor.technical.rsi6,
                rsi12: techFactor.technical.rsi12,
                volumeRatio: techFactor.technical.volumeRatio,
                bollingerPosition: techFactor.technical.bollingerPosition,
                
                // Z-Score 标准化字段
                ma5Zscore: techFactor.technical.ma5_zscore,
                roc5Zscore: techFactor.technical.roc5_zscore,
                rsi6Zscore: techFactor.technical.rsi6_zscore,
                volumeRatioZscore: techFactor.technical.volume_ratio_zscore
            },
            
            // 基本面因子（待补充）
            fundamental: {
                pe: parseFloat(stock.pe) || null,
                pb: parseFloat(stock.pb) || null,
                marketCap: stock.marketCap,
                industry: stock.industry
            },
            
            // 市场面因子
            market: {
                marketCap: stock.marketCap,
                price: stock.price,
                industry: stock.industry
            }
        });
    } else {
        noTechnical++;
    }
});

console.log(`✅ 匹配成功：${matched}只`);
console.log(`⚠️ 无技术因子：${noTechnical}只`);
console.log(`📊 匹配率：${(matched / stockPool.length * 100).toFixed(1)}%\n`);

// 按市值排序
mergedStocks.sort((a, b) => b.marketCap - a.marketCap);

// 保存结果
const result = {
    mergeDate: new Date().toISOString(),
    stats: {
        stockPoolTotal: stockPool.length,
        technicalTotal: Object.keys(technicalFactors).length,
        matched: matched,
        noTechnical: noTechnical,
        matchRate: (matched / stockPool.length * 100).toFixed(1)
    },
    stockPool: mergedStocks
};

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), 'utf8');
console.log(`📁 结果已保存到：${OUTPUT_FILE}\n`);

// 显示示例
console.log('📊 示例数据（前 5 只）:\n');
mergedStocks.slice(0, 5).forEach((s, i) => {
    console.log(`${i+1}. ${s.tsCode} - ${s.name}`);
    console.log(`   市值：${s.marketCap.toFixed(2)}亿`);
    console.log(`   股价：${s.price.toFixed(2)}元`);
    console.log(`   PE: ${s.pe}`);
    console.log(`   技术因子：MA5=${s.technical.ma5?.toFixed(2)}, RSI6=${s.technical.rsi6?.toFixed(2)}, 量比=${s.technical.volumeRatio?.toFixed(2)}`);
    console.log('');
});

console.log('========================================');
console.log('  整合完成！');
console.log('========================================\n');

console.log('✅ 下一步：');
console.log('  1. 设计选股策略（等权重综合评分）');
console.log('  2. 实现选股代码');
console.log('  3. 测试选股结果\n');

// 整合所有因子到股票池（技术面 + 基本面 + 市场面）
const fs = require('fs');
const path = require('path');

const STOCK_POOL_FILE = path.join(__dirname, 'stock-pool-from-total-stocks.json');
const TECHNICAL_FILE = path.join(__dirname, 'data', 'factors', 'technical_2026-03-01.json');
const MARKET_FILE = path.join(__dirname, 'data', 'factors', 'market-factors-2026-03-01.json');
const OUTPUT_FILE = path.join(__dirname, 'stock-pool-complete-factors.json');

console.log('========================================');
console.log('  整合所有因子到股票池');
console.log('========================================\n');

// 读取股票池
console.log('📖 读取股票池...');
const stockPoolData = JSON.parse(fs.readFileSync(STOCK_POOL_FILE, 'utf8'));
const stockPool = stockPoolData.stockPool;
console.log(`✅ 股票池：${stockPool.length}只\n`);

// 读取技术面因子
console.log('📖 读取技术面因子...');
const technicalData = JSON.parse(fs.readFileSync(TECHNICAL_FILE, 'utf8'));
console.log(`✅ 技术面因子：${Object.keys(technicalData.factors).length}只\n`);

// 读取市场面因子
console.log('📖 读取市场面因子...');
const marketData = JSON.parse(fs.readFileSync(MARKET_FILE, 'utf8'));
console.log(`✅ 市场面因子：${Object.keys(marketData.factors).length}只\n`);

// 整合因子
console.log('🔗 整合因子到股票池...\n');

let matched = 0;
let noTechnical = 0;
let noMarket = 0;

stockPool.forEach(stock => {
    const tsCode = stock.tsCode;
    const techFactor = technicalData.factors[tsCode];
    const marketFactor = marketData.factors[tsCode];
    
    if (techFactor && techFactor.technical) {
        matched++;
        
        // 添加技术面因子
        stock.technical = {
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
        };
        
        // 添加市场面因子
        if (marketFactor) {
            stock.market = {
                ...stock.market,
                turnoverRatio: marketFactor.turnoverRatio,
                avgTurnover20: marketFactor.avgTurnover20,
                amplitude: marketFactor.amplitude,
                relativeStrength: marketFactor.relativeStrength,
                rps120: marketFactor.rps120
            };
        } else {
            noMarket++;
        }
    } else {
        noTechnical++;
    }
});

console.log(`✅ 匹配成功：${matched}只`);
console.log(`⚠️ 无技术因子：${noTechnical}只`);
console.log(`⚠️ 无市场因子：${noMarket}只`);
console.log(`📊 匹配率：${(matched / stockPool.length * 100).toFixed(1)}%\n`);

// 按市值排序
stockPool.sort((a, b) => b.marketCap - a.marketCap);

// 保存结果
const result = {
    mergeDate: new Date().toISOString(),
    stats: {
        stockPoolTotal: stockPool.length,
        technicalTotal: Object.keys(technicalData.factors).length,
        marketTotal: Object.keys(marketData.factors).length,
        matched: matched,
        noTechnical: noTechnical,
        noMarket: noMarket,
        matchRate: (matched / stockPool.length * 100).toFixed(1)
    },
    factorSummary: {
        technical: 16,  // 技术面因子数量
        fundamental: 4, // 基本面因子数量
        market: 5,      // 市场面因子数量（新增）
        total: 25       // 总因子数
    },
    stockPool: stockPool
};

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), 'utf8');
console.log(`📁 结果已保存到：${OUTPUT_FILE}\n`);

// 显示示例
console.log('📊 示例数据（前 3 只）:\n');

stockPool.slice(0, 3).forEach((s, i) => {
    console.log(`${i+1}. ${s.tsCode} - ${s.name}`);
    console.log(`   市值：${s.marketCap.toFixed(2)}亿`);
    console.log(`   行业：${s.industry}`);
    console.log(`   PE: ${s.pe}`);
    console.log(`   技术因子：MA5=${s.technical.ma5?.toFixed(2)}, RSI6=${s.technical.rsi6?.toFixed(2)}`);
    console.log(`   市场因子：换手率=${s.market.turnoverRatio?.toFixed(2)}%, RPS120=${s.market.rps120?.toFixed(2)}`);
    console.log('');
});

console.log('========================================');
console.log('  整合完成！');
console.log('========================================\n');

console.log('✅ 现在股票池包含：');
console.log('   - 技术面因子：16 个');
console.log('   - 基本面因子：4 个');
console.log('   - 市场面因子：5 个 ⭐ 新增！');
console.log('   总计：25 个因子\n');

console.log('📊 因子列表:\n');
console.log('技术面（16 个）:');
console.log('   close, changePercent, ma5, ma10, ma20, ma60,');
console.log('   ma5AboveMa10, ma5AboveMa20, ma10AboveMa20,');
console.log('   roc5, roc10, roc20, rsi6, rsi12,');
console.log('   volumeRatio, bollingerPosition\n');

console.log('基本面（4 个）:');
console.log('   pe, pb, marketCap, industry\n');

console.log('市场面（5 个）:');
console.log('   turnoverRatio, avgTurnover20, amplitude,');
console.log('   relativeStrength, rps120\n');

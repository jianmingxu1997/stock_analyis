// 规则筛选策略：底部启动选股
const fs = require('fs');
const path = require('path');

const STOCK_POOL_FILE = path.join(__dirname, 'stock-pool-from-total-stocks.json');
const MERGED_DIR = path.join(__dirname, 'data', 'merged');
const OUTPUT_FILE = path.join(__dirname, 'rule-based-selection.json');

console.log('========================================');
console.log('  规则筛选策略：底部启动选股');
console.log('========================================\n');

const startTime = Date.now();

// ========== 读取股票池 ==========
console.log('📖 读取股票池...\n');
const stockPoolData = JSON.parse(fs.readFileSync(STOCK_POOL_FILE, 'utf8'));
const stockPool = stockPoolData.stockPool;
console.log(`✅ 股票池：${stockPool.length}只\n`);

// ========== 读取历史数据 ==========
console.log('📖 读取历史数据...\n');

const priceHistory = {};

['sh_main.csv', 'sz_main.csv'].forEach(file => {
    const filePath = path.join(MERGED_DIR, file);
    if (!fs.existsSync(filePath)) return;
    
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    const tsCodeIdx = headers.indexOf('ts_code');
    const tradeDateIdx = headers.indexOf('trade_date');
    const closeIdx = headers.indexOf('close');
    const highIdx = headers.indexOf('high');
    const lowIdx = headers.indexOf('low');
    const preCloseIdx = headers.indexOf('pre_close');
    const volIdx = headers.indexOf('vol');
    const pctChgIdx = headers.indexOf('pct_chg');
    
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        const tsCode = values[tsCodeIdx];
        const tradeDate = values[tradeDateIdx];
        
        if (!priceHistory[tsCode]) {
            priceHistory[tsCode] = [];
        }
        
        priceHistory[tsCode].push({
            trade_date: tradeDate,
            close: parseFloat(values[closeIdx]) || 0,
            high: parseFloat(values[highIdx]) || 0,
            low: parseFloat(values[lowIdx]) || 0,
            pre_close: parseFloat(values[preCloseIdx]) || 1,
            vol: parseFloat(values[volIdx]) || 0,
            pct_chg: parseFloat(values[pctChgIdx]) || 0
        });
    }
});

// 按日期排序
Object.keys(priceHistory).forEach(tsCode => {
    priceHistory[tsCode].sort((a, b) => a.trade_date.localeCompare(b.trade_date));
});

console.log(`✅ 历史数据：${Object.keys(priceHistory).length}只股票\n`);

// ========== 筛选规则 ==========
console.log('📋 筛选规则:\n');
console.log('   1. 当日出现金叉 (MA5 上穿 MA10)');
console.log('   2. 布林带位置<0.3 (下轨附近)');
console.log('   3. 当日收红 (涨幅>0)');
console.log('   4. RSI6<70 (未超买)');
console.log('   5. 量比>1.2 (成交量放大)');
console.log('   6. 涨幅<4% (仍有空间)\n');

// ========== 工具函数 ==========
function mean(arr) {
    return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function std(arr) {
    const m = mean(arr);
    return Math.sqrt(arr.reduce((s, v) => s + Math.pow(v - m, 2), 0) / arr.length) || 1;
}

// ========== 筛选主循环 ==========
console.log('🔍 开始筛选...\n');

const selected = [];
let checked = 0;

stockPool.forEach(stock => {
    const tsCode = stock.tsCode;
    const history = priceHistory[tsCode];
    
    if (!history || history.length < 20) return;
    
    // 获取最新交易日数据
    const latest = history[history.length - 1];
    const prev = history[history.length - 2];
    
    // 规则 3: 当日收红
    if (latest.pct_chg <= 0) return;
    
    // 规则 6: 涨幅<4%
    if (latest.pct_chg >= 4) return;
    
    // 获取过去 20 日数据
    const past20 = history.slice(-20);
    
    // 计算 MA5 和 MA10
    const ma5_today = mean(past20.slice(-5).map(d => d.close));
    const ma10_today = mean(past20.slice(-10).map(d => d.close));
    
    const ma5_yest = mean(past20.slice(-6, -1).map(d => d.close));
    const ma10_yest = mean(past20.slice(-11, -1).map(d => d.close));
    
    // 规则 1: 金叉 (MA5 上穿 MA10)
    const goldenCross = (ma5_today > ma10_today) && (ma5_yest <= ma10_yest);
    if (!goldenCross) return;
    
    // 计算布林带
    const ma20 = mean(past20.map(d => d.close));
    const std20 = std(past20.map(d => d.close));
    const bollUpper = ma20 + 2 * std20;
    const bollLower = ma20 - 2 * std20;
    
    // 规则 2: 布林带位置<0.3
    const bollPosition = (bollUpper - bollLower) > 0 ? 
        (latest.close - bollLower) / (bollUpper - bollLower) : 0.5;
    if (bollPosition >= 0.3) return;
    
    // 计算 RSI6
    let gains = 0, losses = 0;
    for (let i = past20.length - 6; i < past20.length; i++) {
        const change = past20[i].close - past20[i-1].close;
        if (change > 0) gains += change;
        else losses -= change;
    }
    const rsi6 = losses === 0 ? 100 : 100 - (100 / (1 + gains / losses));
    
    // 规则 4: RSI6<70
    if (rsi6 >= 70) return;
    
    // 计算量比
    const avgVol3 = mean(past20.slice(-3).map(d => d.vol));
    const volumeRatio = avgVol3 > 0 ? latest.vol / avgVol3 : 1;
    
    // 规则 5: 量比>1.2
    if (volumeRatio < 1.2) return;
    
    // 所有规则通过，加入选股列表
    selected.push({
        tsCode,
        name: stock.name,
        industry: stock.industry,
        marketCap: stock.marketCap,
        pe: stock.pe,
        pb: stock.pb,
        
        // 规则相关指标
        pct_chg: latest.pct_chg,
        ma5: ma5_today,
        ma10: ma10_today,
        goldenCross,
        bollPosition,
        rsi6,
        volumeRatio,
        
        // 得分（用于排序）
        score: (
            (1 - bollPosition) * 30 +  // 布林带位置越低越好
            (70 - rsi6) / 70 * 25 +     // RSI 越低越好
            (volumeRatio - 1) * 25 +    // 量比越高越好
            (4 - latest.pct_chg) / 4 * 20  // 涨幅越低越好
        )
    });
    
    checked++;
});

console.log(`✅ 检查股票：${stockPool.length}只`);
console.log(`✅ 符合条件：${selected.length}只\n`);

// 按得分排序
selected.sort((a, b) => b.score - a.score);

// ========== 保存结果 ==========
const result = {
    strategyDate: new Date().toISOString(),
    rules: [
        'MA5 上穿 MA10 (金叉)',
        '布林带位置<0.3 (下轨附近)',
        '当日收红 (涨幅>0)',
        'RSI6<70 (未超买)',
        '量比>1.2 (成交量放大)',
        '涨幅<4% (仍有空间)'
    ],
    stats: {
        checked: stockPool.length,
        selected: selected.length,
        passRate: (selected.length / stockPool.length * 100).toFixed(2)
    },
    selections: selected
};

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), 'utf8');
console.log(`📁 结果已保存到：${OUTPUT_FILE}\n`);

// ========== 显示结果 ==========
if (selected.length > 0) {
    console.log('========================================');
    console.log('  🏆 选股结果');
    console.log('========================================\n');
    
    console.log('排名 | 代码       | 名称     | 行业     | 涨幅   | 量比   | RSI6  | 布林位 | 得分');
    console.log('-----|------------|----------|----------|--------|--------|-------|--------|------');
    
    selected.slice(0, 30).forEach((s, i) => {
        console.log(
            `${(i+1).toString().padStart(4)} | ${s.tsCode.padEnd(10)} | ${s.name.padEnd(8)} | ${s.industry.padEnd(8)} | ` +
            `${s.pct_chg.toFixed(2).padStart(6)}% | ${s.volumeRatio.toFixed(2).padStart(6)} | ` +
            `${s.rsi6.toFixed(1).padStart(5)} | ${s.bollPosition.toFixed(2).padStart(6)} | ${s.score.toFixed(2).padStart(5)}`
        );
    });
    
    console.log(`\n✅ 共选出 ${selected.length} 只股票\n`);
    
    // 行业分布
    const byIndustry = {};
    selected.forEach(s => {
        if (!byIndustry[s.industry]) byIndustry[s.industry] = 0;
        byIndustry[s.industry]++;
    });
    
    console.log('📊 行业分布:\n');
    Object.entries(byIndustry)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([ind, count]) => {
            console.log(`   ${ind.padEnd(10)} ${count}只 (${(count/selected.length*100).toFixed(1)}%)`);
        });
    
    console.log('\n========================================\n');
} else {
    console.log('❌ 没有股票符合所有条件\n');
    console.log('💡 建议：\n');
    console.log('   1. 放宽筛选条件（如量比>1.1）');
    console.log('   2. 延长回测周期');
    console.log('   3. 检查数据质量\n');
}

const totalTime = Date.now() - startTime;
console.log(`⏱️  总耗时：${(totalTime/1000).toFixed(2)}秒\n`);

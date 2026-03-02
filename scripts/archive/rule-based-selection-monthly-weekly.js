// 规则筛选策略：底部启动选股（月线周线版）
const fs = require('fs');
const path = require('path');

const STOCK_POOL_FILE = path.join(__dirname, 'stock-pool-from-total-stocks.json');
const MERGED_DIR = path.join(__dirname, 'data', 'merged');
const OUTPUT_FILE = path.join(__dirname, 'rule-based-selection-monthly-weekly.json');

console.log('========================================');
console.log('  规则筛选策略：底部启动选股（月线周线版）');
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
            vol: parseFloat(values[volIdx]) || 0,
            pct_chg: parseFloat(values[pctChgIdx]) || 0
        });
    }
});

Object.keys(priceHistory).forEach(tsCode => {
    priceHistory[tsCode].sort((a, b) => a.trade_date.localeCompare(b.trade_date));
});

console.log(`✅ 历史数据：${Object.keys(priceHistory).length}只股票\n`);

// ========== 工具函数 ==========
function mean(arr) {
    return arr.reduce((s, v) => s + v, 0) / arr.length;
}

// 获取周线数据（每 5 个交易日为一周）
function getWeeklyData(history) {
    const weekly = [];
    for (let i = 0; i < history.length; i += 5) {
        const weekData = history.slice(i, i + 5);
        if (weekData.length >= 3) {
            weekly.push({
                close: weekData[weekData.length - 1].close,
                vol: weekData.reduce((s, d) => s + d.vol, 0)
            });
        }
    }
    return weekly;
}

// ========== 筛选规则 ==========
console.log('📋 筛选规则:\n');
console.log('   【日线级别】');
console.log('   1. 即将金叉 (MA5 接近 MA10，-0.5%<差值<2%) ✅');
console.log('   2. 当日收红 (涨幅>0) ✅');
console.log('   3. RSI6<70 (未超买) ✅');
console.log('   4. 量比>1.0 (不缩量) ✅');
console.log('   5. 涨幅<5% (仍有空间) ✅');
console.log('   6. 14 日跌幅<7% (非短期大跌) ✅');
console.log('   7. 20 日跌幅<10% (非中期大跌) ✅');
console.log('   8. 20 日均线向上 (趋势转好) ✅');
console.log('   【周线级别】');
console.log('   9. 周线 MA 差 -2% 到 5% (周线金叉) ✅ 新增');
console.log('   【月线级别】');
console.log('   10. 3 月涨幅>3% (月线趋势向上) ✅ 修改');
console.log('');

// ========== 筛选主循环 ==========
console.log('🔍 开始筛选...\n');

const selected = [];

stockPool.forEach(stock => {
    const tsCode = stock.tsCode;
    const history = priceHistory[tsCode];
    
    if (!history || history.length < 60) return;  // 至少需要 60 个交易日（3 个月）
    
    const latest = history[history.length - 1];
    const past20 = history.slice(-20);
    
    // ===== 日线规则 =====
    
    // 规则 2: 当日收红
    if (latest.pct_chg <= 0) return;
    
    // 规则 5: 涨幅<5%
    if (latest.pct_chg >= 5) return;
    
    // 规则 1: 即将金叉 (MA5 接近 MA10)
    const ma5_today = mean(past20.slice(-5).map(d => d.close));
    const ma10_today = mean(past20.slice(-10).map(d => d.close));
    const maDiff = (ma5_today - ma10_today) / ma10_today * 100;
    if (maDiff < -0.5 || maDiff > 2) return;
    
    // 规则 3: RSI6<70
    let gains = 0, losses = 0;
    for (let i = past20.length - 6; i < past20.length; i++) {
        const change = past20[i].close - past20[i-1].close;
        if (change > 0) gains += change;
        else losses -= change;
    }
    const rsi6 = losses === 0 ? 100 : 100 - (100 / (1 + gains / losses));
    if (rsi6 >= 70) return;
    
    // 规则 4: 量比>1.0
    const avgVol3 = mean(past20.slice(-3).map(d => d.vol));
    const volumeRatio = avgVol3 > 0 ? latest.vol / avgVol3 : 1;
    if (volumeRatio < 1.0) return;
    
    // 规则 6: 14 日跌幅<7%
    const past14 = history.slice(-14);
    if (past14.length >= 14) {
        const price14daysAgo = past14[0].close;
        const change14d = (latest.close - price14daysAgo) / price14daysAgo * 100;
        if (change14d < -7) return;
    }
    
    // 规则 7: 20 日跌幅<10%
    const past20Full = history.slice(-20);
    if (past20Full.length >= 20) {
        const price20daysAgo = past20Full[0].close;
        const change20d = (latest.close - price20daysAgo) / price20daysAgo * 100;
        if (change20d < -10) return;
    }
    
    // 规则 8: 20 日均线向上
    const ma20_today = mean(past20Full.map(d => d.close));
    const ma20_5daysAgo = mean(history.slice(-25, -5).map(d => d.close));
    if (ma20_today <= ma20_5daysAgo) return;
    
    // ===== 周线规则 =====
    
    // 规则 9: 周线 MA 差 -2% 到 5%
    const weeklyData = getWeeklyData(history);
    if (weeklyData.length >= 10) {
        const weekly_ma5 = mean(weeklyData.slice(-5).map(d => d.close));
        const weekly_ma10 = mean(weeklyData.slice(-10).map(d => d.close));
        const weekly_maDiff = (weekly_ma5 - weekly_ma10) / weekly_ma10 * 100;
        if (weekly_maDiff < -2 || weekly_maDiff > 5) return;
    }
    
    // ===== 月线规则 =====
    
    // 规则 10: 3 月涨幅>3%
    const past60 = history.slice(-60);
    if (past60.length >= 60) {
        const price60daysAgo = past60[0].close;
        const change60d = (latest.close - price60daysAgo) / price60daysAgo * 100;
        if (change60d <= 3) return;  // 3 月涨幅不超过 3%
    }
    
    // 所有规则通过
    selected.push({
        tsCode,
        name: stock.name,
        industry: stock.industry,
        marketCap: stock.marketCap,
        pe: stock.pe,
        pb: stock.pb,
        pct_chg: latest.pct_chg,
        ma5: ma5_today,
        ma10: ma10_today,
        maDiff,
        rsi6,
        volumeRatio,
        
        // 周线数据
        weekly_maDiff: weeklyData.length >= 10 ? 
            ((mean(weeklyData.slice(-5).map(d => d.close)) - mean(weeklyData.slice(-10).map(d => d.close))) / mean(weeklyData.slice(-10).map(d => d.close)) * 100) : null,
        
        // 月线数据
        change60d: past60.length >= 60 ? 
            ((latest.close - past60[0].close) / past60[0].close * 100) : null,
        
        score: (
            (2 - Math.abs(maDiff)) / 4 * 30 +
            (weeklyData.length >= 10 ? (5 - Math.abs((mean(weeklyData.slice(-5).map(d => d.close)) - mean(weeklyData.slice(-10).map(d => d.close))) / mean(weeklyData.slice(-10).map(d => d.close)) * 100)) / 7 * 25 : 0) +
            (70 - rsi6) / 70 * 20 +
            (volumeRatio - 1) * 25
        )
    });
});

console.log(`✅ 检查股票：${stockPool.length}只`);
console.log(`✅ 符合条件：${selected.length}只\n`);

selected.sort((a, b) => b.score - a.score);

const result = {
    strategyDate: new Date().toISOString(),
    version: 'monthly-weekly',
    rules: [
        'MA5 接近 MA10 (-0.5%<差值<2%)',
        '当日收红 (涨幅>0)',
        'RSI6<70 (未超买)',
        '量比>1.0 (不缩量)',
        '涨幅<5% (仍有空间)',
        '14 日跌幅<7% (非短期大跌)',
        '20 日跌幅<10% (非中期大跌)',
        '20 日均线向上 (趋势转好)',
        '周线 MA 差 -2% 到 5% (周线金叉)',
        '3 月跌幅<20% (非长期大跌)'
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

if (selected.length > 0) {
    console.log('========================================');
    console.log('  🏆 选股结果（月线周线版）');
    console.log('========================================\n');
    
    console.log('排名 | 代码       | 名称     | 行业     | 涨幅   | 量比   | RSI6  | 日 MA 差 | 周 MA 差 | 3 月%');
    console.log('-----|------------|----------|----------|--------|--------|-------|--------|--------|------');
    
    selected.slice(0, 50).forEach((s, i) => {
        console.log(
            `${(i+1).toString().padStart(4)} | ${s.tsCode.padEnd(10)} | ${s.name.padEnd(8)} | ${s.industry.padEnd(8)} | ` +
            `${s.pct_chg.toFixed(2).padStart(6)}% | ${s.volumeRatio.toFixed(2).padStart(6)} | ` +
            `${s.rsi6.toFixed(1).padStart(5)} | ${s.maDiff.toFixed(2).padStart(6)} | ` +
            `${(s.weekly_maDiff || 0).toFixed(2).padStart(6)} | ${((s.change60d || 0)).toFixed(2).padStart(5)}`
        );
    });
    
    console.log(`\n✅ 共选出 ${selected.length} 只股票\n`);
    
    const byIndustry = {};
    selected.forEach(s => {
        if (!byIndustry[s.industry]) byIndustry[s.industry] = 0;
        byIndustry[s.industry]++;
    });
    
    console.log('📊 行业分布 (Top 10):\n');
    Object.entries(byIndustry)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .forEach(([ind, count]) => {
            console.log(`   ${ind.padEnd(10)} ${count}只 (${(count/selected.length*100).toFixed(1)}%)`);
        });
    
    const avgRsi = mean(selected.map(s => s.rsi6));
    const avgVol = mean(selected.map(s => s.volumeRatio));
    const avgGain = mean(selected.map(s => s.pct_chg));
    const avg60d = mean(selected.map(s => s.change60d || 0));
    
    console.log('\n📈 平均指标:\n');
    console.log(`   平均 RSI6: ${avgRsi.toFixed(1)}`);
    console.log(`   平均量比：${avgVol.toFixed(2)}`);
    console.log(`   平均涨幅：${avgGain.toFixed(2)}%`);
    console.log(`   平均 3 月涨幅：${avg60d.toFixed(2)}%`);
    
    console.log('\n========================================\n');
} else {
    console.log('❌ 没有股票符合所有条件\n');
}

console.log(`⏱️  总耗时：${((Date.now() - startTime)/1000).toFixed(2)}秒\n`);

// 简化版回测框架（优化性能）
const fs = require('fs');
const path = require('path');

const MERGED_DIR = path.join(__dirname, 'data', 'merged');
const OUTPUT_FILE = path.join(__dirname, 'backtest-result-simple.json');

console.log('========================================');
console.log('  简化版回测框架（优化版）');
console.log('========================================\n');

const startTime = Date.now();

// ========== 配置 ==========
const config = {
    startDate: '20251201',
    endDate: '20260227',
    topN: 20,
    holdDays: 5,
    initialCapital: 1000000
};

console.log('📋 回测配置:\n');
console.log(`   回测区间：${config.startDate} 至 ${config.endDate}`);
console.log(`   每日选股：Top ${config.topN}`);
console.log(`   持仓周期：${config.holdDays}天\n`);

// ========== 工具函数 ==========
function mean(arr) {
    return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function std(arr) {
    const m = mean(arr);
    return Math.sqrt(arr.reduce((s, v) => s + Math.pow(v - m, 2), 0) / arr.length) || 1;
}

// ========== 读取历史数据 ==========
console.log('📖 读取历史数据...\n');

const priceHistory = {};
const allDates = new Set();

['sh_main.csv', 'sz_main.csv'].forEach(file => {
    const filePath = path.join(MERGED_DIR, file);
    if (!fs.existsSync(filePath)) return;
    
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    const tsCodeIdx = headers.indexOf('ts_code');
    const tradeDateIdx = headers.indexOf('trade_date');
    const closeIdx = headers.indexOf('close');
    const pctChgIdx = headers.indexOf('pct_chg');
    const peIdx = headers.indexOf('pe');
    
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        const tsCode = values[tsCodeIdx];
        const tradeDate = values[tradeDateIdx];
        
        if (tradeDate < config.startDate || tradeDate > config.endDate) continue;
        
        allDates.add(tradeDate);
        
        if (!priceHistory[tsCode]) {
            priceHistory[tsCode] = {};
        }
        
        priceHistory[tsCode][tradeDate] = {
            close: parseFloat(values[closeIdx]) || 0,
            pct_chg: parseFloat(values[pctChgIdx]) || 0,
            pe: parseFloat(values[peIdx]) || 0
        };
    }
    
    console.log(`✅ ${file}: ${Object.keys(priceHistory).length}只股票`);
});

const sortedDates = [...allDates].sort();
console.log(`\n✅ 回测交易日：${sortedDates.length}天`);
console.log(`✅ 股票数量：${Object.keys(priceHistory).length}只\n`);

const t1 = Date.now();

// ========== 回测主循环 ==========
console.log('🔄 开始回测...\n');

let portfolioValue = config.initialCapital;
const dailyReturns = [];
const benchmarkReturns = [];
let totalTrades = 0;
let winningTrades = 0;

// 简化：每日调仓，等权重持有 Top N
for (let dateIdx = 20; dateIdx < sortedDates.length; dateIdx++) {
    const currentDate = sortedDates[dateIdx];
    const prevDate = sortedDates[dateIdx - 1];
    
    // 1. 计算每只股票的评分
    const stockScores = [];
    
    Object.keys(priceHistory).forEach(tsCode => {
        const history = priceHistory[tsCode];
        const currentData = history[currentDate];
        
        if (!currentData || currentData.close === 0) return;
        
        // 获取过去 20 日数据
        const pastDates = sortedDates.slice(dateIdx - 20, dateIdx);
        const pastData = pastDates.map(d => history[d]).filter(d => d && d.close > 0);
        
        if (pastData.length < 10) return;
        
        // 计算因子
        const latestClose = currentData.close;
        const ma5 = mean(pastData.slice(-5).map(d => d.close));
        const ma20 = mean(pastData.map(d => d.close));
        
        const roc5 = pastData.length >= 5 ? 
            ((latestClose - pastData[pastData.length - 5].close) / pastData[pastData.length - 5].close * 100) : 0;
        
        // RSI6 简化
        let upDays = 0, downDays = 0;
        for (let i = pastData.length - 6; i < pastData.length; i++) {
            if (pastData[i].close > pastData[i-1].close) upDays++;
            else downDays++;
        }
        const rsi6 = downDays === 0 ? 100 : 100 * upDays / (upDays + downDays);
        
        // PE 百分位
        const allPE = Object.values(priceHistory)
            .map(h => h[currentDate]?.pe || 0)
            .filter(v => v > 0);
        const pePercentile = allPE.filter(v => v <= currentData.pe).length / allPE.length;
        
        // 综合评分
        const score = (
            (1 - pePercentile) * 0.3 +      // 低估值 30%
            (ma5 > ma20 ? 1 : 0) * 0.25 +   // 趋势 25%
            (roc5 > 0 ? 1 : 0) * 0.25 +     // 动量 25%
            (rsi6 < 70 ? 1 : 0) * 0.2       // 不过热 20%
        );
        
        stockScores.push({
            tsCode,
            score,
            close: latestClose,
            pe: currentData.pe
        });
    });
    
    // 2. 选股 Top N
    stockScores.sort((a, b) => b.score - a.score);
    const selected = stockScores.slice(0, config.topN);
    
    // 3. 计算当日收益（简化：假设昨日买入，今日卖出）
    if (dateIdx > 20) {
        // 计算选股股票今天的平均收益
        const selectedReturns = selected.map(s => {
            const todayData = priceHistory[s.tsCode]?.[currentDate];
            const yesterdayData = priceHistory[s.tsCode]?.[prevDate];
            
            if (todayData && yesterdayData && yesterdayData.close > 0) {
                return (todayData.close - yesterdayData.close) / yesterdayData.close;
            }
            return 0;
        });
        
        const avgReturn = mean(selectedReturns);
        dailyReturns.push(avgReturn);
        
        // 基准收益（所有股票平均）
        const allReturns = Object.values(priceHistory)
            .map(h => {
                const today = h[currentDate];
                const yesterday = h[prevDate];
                if (today && yesterday && yesterday.close > 0) {
                    return (today.close - yesterday.close) / yesterday.close;
                }
                return null;
            })
            .filter(r => r !== null);
        
        benchmarkReturns.push(mean(allReturns));
        
        // 更新持仓市值
        portfolioValue *= (1 + avgReturn);
        
        // 统计胜负
        selectedReturns.forEach(r => {
            totalTrades++;
            if (r > 0) winningTrades++;
        });
    }
    
    // 显示进度
    if ((dateIdx + 1) % 10 === 0) {
        console.log(`   进度：${dateIdx + 1}/${sortedDates.length}天 (${((dateIdx + 1) / sortedDates.length * 100).toFixed(1)}%)`);
    }
}

const t2 = Date.now();
console.log('\n✅ 回测完成！\n');

// ========== 计算回测指标 ==========
console.log('📊 计算回测指标...\n');

const totalReturn = (portfolioValue - config.initialCapital) / config.initialCapital * 100;
const tradingDays = sortedDates.length;
const annualReturn = Math.pow(1 + totalReturn / 100, 252 / tradingDays) - 1;
const returnVol = std(dailyReturns) * Math.sqrt(252);
const sharpeRatio = (annualReturn - 0.03) / returnVol;

// 最大回撤
let peak = config.initialCapital;
let maxDrawdown = 0;
let currentValue = config.initialCapital;
dailyReturns.forEach(r => {
    currentValue *= (1 + r);
    if (currentValue > peak) peak = currentValue;
    const dd = (peak - currentValue) / peak * 100;
    if (dd > maxDrawdown) maxDrawdown = dd;
});

const winRate = totalTrades > 0 ? winningTrades / totalTrades * 100 : 0;

// 基准对比
const benchmarkTotalReturn = benchmarkReturns.reduce((acc, r) => acc * (1 + r), 1) - 1;
const alpha = annualReturn - benchmarkTotalReturn * (252 / tradingDays);

// 评级
console.log('📈 回测结果:\n');
console.log(`   总收益率：${totalReturn.toFixed(2)}%`);
console.log(`   年化收益率：${(annualReturn * 100).toFixed(2)}%`);
console.log(`   波动率：${(returnVol * 100).toFixed(2)}%`);
console.log(`   夏普比率：${sharpeRatio.toFixed(2)}`);
console.log(`   最大回撤：${maxDrawdown.toFixed(2)}%`);
console.log(`   胜率：${winRate.toFixed(1)}% (${winningTrades}/${totalTrades})`);
console.log(`   基准收益：${(benchmarkTotalReturn * 100).toFixed(2)}%`);
console.log(`   Alpha：${(alpha * 100).toFixed(2)}%\n`);

// 综合评分
let score = 0;
const comments = [];

if (annualReturn > 0.20) { score += 3; comments.push('年化收益优秀 (>20%)'); }
else if (annualReturn > 0.10) { score += 2; comments.push('年化收益良好 (>10%)'); }
else if (annualReturn > 0) { score += 1; comments.push('年化收益为正'); }
else { comments.push('年化收益为负 ⚠️'); }

if (sharpeRatio > 1.5) { score += 3; comments.push('夏普比率优秀 (>1.5)'); }
else if (sharpeRatio > 1.0) { score += 2; comments.push('夏普比率良好 (>1.0)'); }
else if (sharpeRatio > 0.5) { score += 1; comments.push('夏普比率尚可 (>0.5)'); }
else { comments.push('夏普比率较低 ⚠️'); }

if (maxDrawdown < 10) { score += 3; comments.push('回撤控制优秀 (<10%)'); }
else if (maxDrawdown < 20) { score += 2; comments.push('回撤控制良好 (<20%)'); }
else if (maxDrawdown < 30) { score += 1; comments.push('回撤控制尚可 (<30%)'); }
else { comments.push('回撤过大 ⚠️'); }

if (winRate > 60) { score += 3; comments.push('胜率优秀 (>60%)'); }
else if (winRate > 50) { score += 2; comments.push('胜率良好 (>50%)'); }
else if (winRate > 40) { score += 1; comments.push('胜率尚可 (>40%)'); }
else { comments.push('胜率较低 ⚠️'); }

const rating = score >= 12 ? '⭐⭐⭐⭐⭐ 优秀' :
               score >= 9 ? '⭐⭐⭐⭐ 良好' :
               score >= 6 ? '⭐⭐⭐ 尚可' :
               score >= 3 ? '⭐⭐ 需改进' : '⭐ 需大幅优化';

console.log('🏆 策略评级:\n');
console.log(`   综合评分：${score}/12`);
console.log(`   策略评级：${rating}\n`);
console.log('   详细评价:');
comments.forEach(c => console.log(`   - ${c}`));
console.log('');

// ========== 保存结果 ==========
const result = {
    backtestDate: new Date().toISOString(),
    config,
    timing: {
        total: (Date.now() - startTime) / 1000,
        loadData: (t1 - startTime) / 1000,
        backtest: (t2 - t1) / 1000
    },
    metrics: {
        totalReturn: totalReturn.toFixed(2),
        annualReturn: (annualReturn * 100).toFixed(2),
        volatility: (returnVol * 100).toFixed(2),
        sharpeRatio: sharpeRatio.toFixed(2),
        maxDrawdown: maxDrawdown.toFixed(2),
        winRate: winRate.toFixed(1),
        totalTrades,
        winningTrades,
        benchmarkReturn: (benchmarkTotalReturn * 100).toFixed(2),
        alpha: (alpha * 100).toFixed(2)
    },
    rating: {
        score,
        maxScore: 12,
        rating,
        comments
    },
    portfolioValue,
    dailyReturns: dailyReturns.slice(-20),  // 只保存最后 20 天
    benchmarkReturns: benchmarkReturns.slice(-20)
};

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), 'utf8');
console.log(`📁 结果已保存到：${OUTPUT_FILE}\n`);

console.log('========================================');
console.log('  回测完成！');
console.log('========================================\n');

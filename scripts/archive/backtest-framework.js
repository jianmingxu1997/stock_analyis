// 策略回测框架
const fs = require('fs');
const path = require('path');

const MERGED_DIR = path.join(__dirname, 'data', 'merged');
const OUTPUT_FILE = path.join(__dirname, 'backtest-result.json');

console.log('========================================');
console.log('  策略回测框架');
console.log('========================================\n');

const startTime = Date.now();

// ========== 配置 ==========
const config = {
    startDate: '20251201',  // 回测开始日期
    endDate: '20260227',    // 回测结束日期
    topN: 20,               // 每日选股数量
    holdDays: 5,            // 持仓天数
    initialCapital: 1000000 // 初始资金 100 万
};

console.log('📋 回测配置:\n');
console.log(`   回测区间：${config.startDate} 至 ${config.endDate}`);
console.log(`   每日选股：Top ${config.topN}`);
console.log(`   持仓周期：${config.holdDays}天`);
console.log(`   初始资金：${(config.initialCapital/1000000).toFixed(0)}百万\n`);

// ========== 工具函数 ==========
function mean(arr) {
    return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function std(arr) {
    const m = mean(arr);
    return Math.sqrt(arr.reduce((s, v) => s + Math.pow(v - m, 2), 0) / arr.length);
}

function percentile(values, p) {
    const sorted = [...values].sort((a, b) => a - b);
    const idx = Math.ceil(p / 100 * sorted.length) - 1;
    return parseFloat(sorted[Math.max(0, idx)]) || 0;
}

// ========== 读取历史数据 ==========
console.log('📖 读取历史数据...\n');

const priceHistory = {};  // tsCode -> [每日行情]

['sh_main.csv', 'sz_main.csv'].forEach(file => {
    const filePath = path.join(MERGED_DIR, file);
    if (!fs.existsSync(filePath)) {
        console.log(`⚠️ 文件不存在：${file}`);
        return;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    const tsCodeIdx = headers.indexOf('ts_code');
    const tradeDateIdx = headers.indexOf('trade_date');
    const closeIdx = headers.indexOf('close');
    const highIdx = headers.indexOf('high');
    const lowIdx = headers.indexOf('low');
    const preCloseIdx = headers.indexOf('pre_close');
    const amountIdx = headers.indexOf('amount');
    const volIdx = headers.indexOf('vol');
    const pctChgIdx = headers.indexOf('pct_chg');
    const peIdx = headers.indexOf('pe');
    const pbIdx = headers.indexOf('pb');
    
    const stockData = {};
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        const tsCode = values[tsCodeIdx];
        const tradeDate = values[tradeDateIdx];
        
        // 只保留回测区间内的数据
        if (tradeDate < config.startDate || tradeDate > config.endDate) continue;
        
        if (!stockData[tsCode]) {
            stockData[tsCode] = [];
        }
        
        stockData[tsCode].push({
            trade_date: tradeDate,
            close: parseFloat(values[closeIdx]) || 0,
            high: parseFloat(values[highIdx]) || 0,
            low: parseFloat(values[lowIdx]) || 0,
            pre_close: parseFloat(values[preCloseIdx]) || 1,
            amount: parseFloat(values[amountIdx]) || 0,
            vol: parseFloat(values[volIdx]) || 0,
            pct_chg: parseFloat(values[pctChgIdx]) || 0,
            pe: parseFloat(values[peIdx]) || 0,
            pb: parseFloat(values[pbIdx]) || 0
        });
    }
    
    // 按日期排序
    Object.keys(stockData).forEach(tsCode => {
        stockData[tsCode].sort((a, b) => a.trade_date.localeCompare(b.trade_date));
        priceHistory[tsCode] = stockData[tsCode];
    });
    
    console.log(`✅ ${file}: ${Object.keys(stockData).length}只股票`);
});

const allDates = [...new Set(
    Object.values(priceHistory)
        .flat()
        .map(d => d.trade_date)
)].sort();

console.log(`\n✅ 回测交易日：${allDates.length}天`);
console.log(`✅ 股票数量：${Object.keys(priceHistory).length}只\n`);

const t1 = Date.now();

// ========== 回测主循环 ==========
console.log('🔄 开始回测...\n');

const dailySelections = [];  // 每日选股结果
const portfolioValue = [config.initialCapital];  // 每日持仓市值
const dailyReturns = [];  // 每日收益率
const benchmarkReturns = [];  // 基准收益率（用所有股票平均）

let totalTrades = 0;
let winningTrades = 0;
let losingTrades = 0;

// 持仓记录
let positions = [];  // {tsCode, buyDate, buyPrice, shares}
let cash = config.initialCapital;

for (let dateIdx = 20; dateIdx < allDates.length; dateIdx++) {
    const currentDate = allDates[dateIdx];
    const lookbackStart = dateIdx - 20;
    const lookbackEnd = dateIdx - 1;
    const lookbackDates = allDates.slice(lookbackStart, lookbackEnd + 1);
    
    // 1. 计算每只股票的因子
    const stockScores = [];
    
    Object.keys(priceHistory).forEach(tsCode => {
        const history = priceHistory[tsCode];
        const currentData = history.find(d => d.trade_date === currentDate);
        
        if (!currentData) return;
        
        // 获取过去 20 日数据
        const past20 = history.filter(d => 
            lookbackDates.includes(d.trade_date)
        );
        
        if (past20.length < 10) return;
        
        // 计算因子
        const latestClose = currentData.close;
        const ma5 = past20.slice(-5).reduce((s, d) => s + d.close, 0) / 5;
        const ma10 = past20.slice(-10).reduce((s, d) => s + d.close, 0) / 10;
        const ma20 = past20.reduce((s, d) => s + d.close, 0) / 20;
        
        const roc5 = past20.length >= 5 ? 
            ((latestClose - past20[past20.length - 5].close) / past20[past20.length - 5].close * 100) : 0;
        
        // RSI6
        let gains = 0, losses = 0;
        for (let i = past20.length - 6; i < past20.length; i++) {
            const change = past20[i].close - past20[i-1].close;
            if (change > 0) gains += change;
            else losses -= change;
        }
        const rsi6 = losses === 0 ? 100 : 100 - (100 / (1 + gains / losses));
        
        // 量比
        const latestVol = currentData.vol;
        const avgVol5 = past20.slice(-5).reduce((s, d) => s + d.vol, 0) / 5;
        const volumeRatio = avgVol5 > 0 ? latestVol / avgVol5 : 1;
        
        // 布林带位置
        const std20 = std(past20.map(d => d.close));
        const bollUpper = ma20 + 2 * std20;
        const bollLower = ma20 - 2 * std20;
        const bollPosition = (bollUpper - bollLower) > 0 ? 
            (latestClose - bollLower) / (bollUpper - bollLower) : 0.5;
        
        // Z-Score 标准化（简化版：用历史百分位）
        const allPE = Object.values(priceHistory)
            .map(h => h.find(d => d.trade_date === currentDate)?.pe || 0)
            .filter(v => v > 0);
        const pePercentile = allPE.filter(v => v <= currentData.pe).length / allPE.length * 100;
        
        // 综合评分（等权重）
        const score = (
            (100 - pePercentile) / 100 +  // 低 PE 好
            (ma5 > ma10 ? 1 : 0) / 3 +     // 均线多头
            (roc5 > 0 ? 1 : 0) / 3 +       // 正动量
            (rsi6 < 70 ? 1 : 0) / 3 +      // 不过热
            (volumeRatio > 1 ? 1 : 0) / 2 + // 放量
            (bollPosition < 0.8 ? 1 : 0) / 2  // 不过高
        ) / 6;
        
        stockScores.push({
            tsCode,
            score,
            pe: currentData.pe,
            pb: currentData.pb,
            close: latestClose,
            ma5,
            roc5,
            rsi6,
            volumeRatio,
            bollPosition
        });
    });
    
    // 2. 选股 Top N
    stockScores.sort((a, b) => b.score - a.score);
    const selected = stockScores.slice(0, config.topN);
    
    dailySelections.push({
        date: currentDate,
        selections: selected.map(s => ({
            tsCode: s.tsCode,
            score: s.score,
            pe: s.pe,
            close: s.close
        }))
    });
    
    // 3. 调仓（简化版：每日重新平衡）
    if (positions.length > 0) {
        // 计算昨日持仓市值
        let yesterdayValue = 0;
        positions.forEach(pos => {
            const stockHistory = priceHistory[pos.tsCode];
            const yesterdayData = stockHistory?.find(d => 
                d.trade_date === allDates[dateIdx - 1]
            );
            if (yesterdayData) {
                yesterdayValue += pos.shares * yesterdayData.close;
            }
        });
        
        const todayValue = positions.reduce((sum, pos) => {
            const stockHistory = priceHistory[pos.tsCode];
            const todayData = stockHistory?.find(d => d.trade_date === currentDate);
            return sum + (todayData ? pos.shares * todayData.close : 0);
        }, 0);
        
        const dailyReturn = (todayValue - yesterdayValue) / yesterdayValue;
        dailyReturns.push(dailyReturn);
        
        // 基准收益（用所有股票平均）
        const allReturns = Object.values(priceHistory)
            .map(h => {
                const yesterday = h.find(d => d.trade_date === allDates[dateIdx - 1]);
                const today = h.find(d => d.trade_date === currentDate);
                if (yesterday && today && yesterday.close > 0) {
                    return (today.close - yesterday.close) / yesterday.close;
                }
                return null;
            })
            .filter(r => r !== null);
        
        benchmarkReturns.push(mean(allReturns));
        
        portfolioValue.push(todayValue + cash);
        
        // 统计交易胜负
        positions.forEach(pos => {
            const buyData = priceHistory[pos.tsCode]?.find(d => d.trade_date === pos.buyDate);
            const sellData = priceHistory[pos.tsCode]?.find(d => d.trade_date === currentDate);
            
            if (buyData && sellData && buyData.close > 0) {
                const tradeReturn = (sellData.close - buyData.close) / buyData.close;
                totalTrades++;
                if (tradeReturn > 0) winningTrades++;
                else losingTrades++;
            }
        });
    }
    
    // 重新建仓（等权重）
    positions = [];
    const positionSize = cash / config.topN;
    
    selected.forEach(stock => {
        const shares = positionSize / stock.close;
        positions.push({
            tsCode: stock.tsCode,
            buyDate: currentDate,
            buyPrice: stock.close,
            shares
        });
    });
    
    cash = 0;  // 满仓
    
    // 显示进度
    if ((dateIdx + 1) % 20 === 0) {
        console.log(`   进度：${dateIdx + 1}/${allDates.length}天 (${((dateIdx + 1) / allDates.length * 100).toFixed(1)}%)`);
    }
}

const t2 = Date.now();
console.log('\n✅ 回测完成！\n');

// ========== 计算回测指标 ==========
console.log('📊 计算回测指标...\n');

// 1. 总收益率
const totalReturn = (portfolioValue[portfolioValue.length - 1] - config.initialCapital) / config.initialCapital * 100;

// 2. 年化收益率
const tradingDays = allDates.length;
const annualReturn = Math.pow(1 + totalReturn / 100, 252 / tradingDays) - 1;

// 3. 波动率
const returnVol = std(dailyReturns) * Math.sqrt(252);

// 4. 夏普比率（假设无风险利率 3%）
const sharpeRatio = (annualReturn - 0.03) / returnVol;

// 5. 最大回撤
let peak = config.initialCapital;
let maxDrawdown = 0;
portfolioValue.forEach(value => {
    if (value > peak) peak = value;
    const drawdown = (peak - value) / peak * 100;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
});

// 6. 胜率
const winRate = totalTrades > 0 ? winningTrades / totalTrades * 100 : 0;

// 7. 基准对比
const benchmarkTotalReturn = benchmarkReturns.reduce((acc, r) => acc * (1 + r), 1) * 100 - 100;
const alpha = annualReturn - benchmarkTotalReturn / tradingDays * 252;

// 8. 信息比率
const activeReturns = dailyReturns.map((r, i) => r - benchmarkReturns[i]);
const informationRatio = mean(activeReturns) / (std(activeReturns) * Math.sqrt(252)) * 252;

console.log('📈 回测结果:\n');
console.log(`   总收益率：${totalReturn.toFixed(2)}%`);
console.log(`   年化收益率：${(annualReturn * 100).toFixed(2)}%`);
console.log(`   波动率：${(returnVol * 100).toFixed(2)}%`);
console.log(`   夏普比率：${sharpeRatio.toFixed(2)}`);
console.log(`   最大回撤：${maxDrawdown.toFixed(2)}%`);
console.log(`   胜率：${winRate.toFixed(1)}% (${winningTrades}/${totalTrades})`);
console.log(`   基准收益：${benchmarkTotalReturn.toFixed(2)}%`);
console.log(`   Alpha：${(alpha * 100).toFixed(2)}%`);
console.log(`   信息比率：${informationRatio.toFixed(2)}\n`);

// ========== 评级标准 ==========
console.log('🏆 策略评级:\n');

let score = 0;
const comments = [];

// 年化收益
if (annualReturn > 0.20) { score += 3; comments.push('年化收益优秀 (>20%)'); }
else if (annualReturn > 0.10) { score += 2; comments.push('年化收益良好 (>10%)'); }
else if (annualReturn > 0) { score += 1; comments.push('年化收益为正'); }
else { comments.push('年化收益为负 ⚠️'); }

// 夏普比率
if (sharpeRatio > 1.5) { score += 3; comments.push('夏普比率优秀 (>1.5)'); }
else if (sharpeRatio > 1.0) { score += 2; comments.push('夏普比率良好 (>1.0)'); }
else if (sharpeRatio > 0.5) { score += 1; comments.push('夏普比率尚可 (>0.5)'); }
else { comments.push('夏普比率较低 ⚠️'); }

// 最大回撤
if (maxDrawdown < 10) { score += 3; comments.push('回撤控制优秀 (<10%)'); }
else if (maxDrawdown < 20) { score += 2; comments.push('回撤控制良好 (<20%)'); }
else if (maxDrawdown < 30) { score += 1; comments.push('回撤控制尚可 (<30%)'); }
else { comments.push('回撤过大 ⚠️'); }

// 胜率
if (winRate > 60) { score += 3; comments.push('胜率优秀 (>60%)'); }
else if (winRate > 50) { score += 2; comments.push('胜率良好 (>50%)'); }
else if (winRate > 40) { score += 1; comments.push('胜率尚可 (>40%)'); }
else { comments.push('胜率较低 ⚠️'); }

// Alpha
if (alpha > 0.10) { score += 3; comments.push('Alpha 优秀 (>10%)'); }
else if (alpha > 0.05) { score += 2; comments.push('Alpha 良好 (>5%)'); }
else if (alpha > 0) { score += 1; comments.push('Alpha 为正'); }
else { comments.push('Alpha 为负 ⚠️'); }

const rating = score >= 12 ? '⭐⭐⭐⭐⭐ 优秀' :
               score >= 9 ? '⭐⭐⭐⭐ 良好' :
               score >= 6 ? '⭐⭐⭐ 尚可' :
               score >= 3 ? '⭐⭐ 需改进' : '⭐ 需大幅优化';

console.log(`   综合评分：${score}/15`);
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
        losingTrades,
        benchmarkReturn: benchmarkTotalReturn.toFixed(2),
        alpha: (alpha * 100).toFixed(2),
        informationRatio: informationRatio.toFixed(2)
    },
    rating: {
        score,
        maxScore: 15,
        rating,
        comments
    },
    portfolioValue,
    dailyReturns,
    benchmarkReturns,
    dailySelections: dailySelections.slice(-10)  // 只保存最后 10 天
};

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), 'utf8');
console.log(`📁 结果已保存到：${OUTPUT_FILE}\n`);

console.log('========================================');
console.log('  回测完成！');
console.log('========================================\n');

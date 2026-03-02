// 股票池行业板块统计
const fs = require('fs');
const path = require('path');

const INPUT_FILE = path.join(__dirname, 'stock-pool-from-total-stocks.json');
const OUTPUT_FILE = path.join(__dirname, 'stock-pool-industry-stats.json');

console.log('========================================');
console.log('  股票池行业板块统计');
console.log('========================================\n');

// 读取股票池
const data = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
const stocks = data.stockPool;

console.log(`📊 股票池总数：${stocks.length}只\n`);

// 行业统计
const industryStats = {};
stocks.forEach(stock => {
    const industry = stock.industry || '未知';
    if (!industryStats[industry]) {
        industryStats[industry] = {
            count: 0,
            stocks: [],
            totalMarketCap: 0,
            avgPE: 0,
            avgPB: 0
        };
    }
    industryStats[industry].count++;
    industryStats[industry].stocks.push(stock);
    industryStats[industry].totalMarketCap += stock.marketCap;
    industryStats[industry].avgPE += parseFloat(stock.pe) || 0;
    industryStats[industry].avgPB += parseFloat(stock.pb) || 0;
});

// 计算平均值
Object.values(industryStats).forEach(stat => {
    stat.avgPE = (stat.avgPE / stat.count).toFixed(2);
    stat.avgPB = (stat.avgPB / stat.count).toFixed(2);
    stat.avgMarketCap = (stat.totalMarketCap / stat.count).toFixed(2);
});

// 按股票数量排序
const sortedByCount = Object.entries(industryStats)
    .sort((a, b) => b[1].count - a[1].count);

// 按市值排序
const sortedByMarketCap = Object.entries(industryStats)
    .sort((a, b) => b[1].totalMarketCap - a[1].totalMarketCap);

// 输出统计
console.log('📊 行业分布（按股票数量）:\n');
console.log('排名 | 行业              | 股票数 | 占比   | 总市值 (亿) | 平均 PE | 平均 PB');
console.log('-----|------------------|--------|--------|-------------|---------|--------');

sortedByCount.forEach(([industry, stat], i) => {
    const percent = (stat.count / stocks.length * 100).toFixed(1);
    console.log(
        `${(i+1).toString().padStart(4)} | ${industry.padEnd(16)} | ${stat.count.toString().padStart(6)} | ${percent.padStart(6)}% | ${stat.totalMarketCap.toFixed(2).padStart(11)} | ${stat.avgPE.toString().padStart(7)} | ${stat.avgPB.toString().padStart(6)}`
    );
});

console.log('\n\n📊 行业分布（按总市值）:\n');
console.log('排名 | 行业              | 股票数 | 占比   | 总市值 (亿) | 平均 PE | 平均 PB');
console.log('-----|------------------|--------|--------|-------------|---------|--------');

sortedByMarketCap.forEach(([industry, stat], i) => {
    const percent = (stat.totalMarketCap / stocks.reduce((s, s2) => s + s2.marketCap, 0) * 100).toFixed(1);
    console.log(
        `${(i+1).toString().padStart(4)} | ${industry.padEnd(16)} | ${stat.count.toString().padStart(6)} | ${percent.padStart(6)}% | ${stat.totalMarketCap.toFixed(2).padStart(11)} | ${stat.avgPE.toString().padStart(7)} | ${stat.avgPB.toString().padStart(6)}`
    );
});

// 板块统计（按代码前缀）
const boardStats = {
    '沪市主板': { count: 0, stocks: [] },
    '深市主板': { count: 0, stocks: [] }
};

stocks.forEach(stock => {
    const code = stock.tsCode.split('.')[0];
    if (code.startsWith('600') || code.startsWith('601') || code.startsWith('603') || code.startsWith('605')) {
        boardStats['沪市主板'].count++;
        boardStats['沪市主板'].stocks.push(stock);
    } else if (code.startsWith('000') || code.startsWith('001') || code.startsWith('002') || code.startsWith('003')) {
        boardStats['深市主板'].count++;
        boardStats['深市主板'].stocks.push(stock);
    }
});

console.log('\n\n📊 板块分布:\n');
console.log('板块     | 股票数 | 占比');
console.log('---------|--------|------');
Object.entries(boardStats).forEach(([board, stat]) => {
    const percent = (stat.count / stocks.length * 100).toFixed(1);
    console.log(`${board.padEnd(8)} | ${stat.count.toString().padStart(6)} | ${percent.padStart(6)}%`);
});

// 市值区间统计
const marketCapRanges = {
    '100-200 亿': 0,
    '200-500 亿': 0,
    '500-1000 亿': 0,
    '1000-2000 亿': 0,
    '2000-5000 亿': 0,
    '5000 亿+': 0
};

stocks.forEach(stock => {
    const mc = stock.marketCap;
    if (mc < 200) marketCapRanges['100-200 亿']++;
    else if (mc < 500) marketCapRanges['200-500 亿']++;
    else if (mc < 1000) marketCapRanges['500-1000 亿']++;
    else if (mc < 2000) marketCapRanges['1000-2000 亿']++;
    else if (mc < 5000) marketCapRanges['2000-5000 亿']++;
    else marketCapRanges['5000 亿+']++;
});

console.log('\n\n📊 市值区间分布:\n');
console.log('区间         | 股票数 | 占比');
console.log('-------------|--------|------');
Object.entries(marketCapRanges).forEach(([range, count]) => {
    const percent = (count / stocks.length * 100).toFixed(1);
    console.log(`${range.padEnd(12)} | ${count.toString().padStart(6)} | ${percent.padStart(6)}%`);
});

// 保存结果
const result = {
    statsDate: new Date().toISOString(),
    totalStocks: stocks.length,
    industryDistribution: sortedByCount.map(([industry, stat]) => ({
        industry,
        count: stat.count,
        percent: (stat.count / stocks.length * 100).toFixed(1),
        totalMarketCap: stat.totalMarketCap.toFixed(2),
        avgPE: stat.avgPE,
        avgPB: stat.avgPB,
        topStocks: stat.stocks.slice(0, 5).map(s => ({
            tsCode: s.tsCode,
            name: s.name,
            marketCap: s.marketCap.toFixed(2)
        }))
    })),
    boardDistribution: boardStats,
    marketCapDistribution: marketCapRanges
};

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), 'utf8');
console.log(`\n\n📁 详细结果已保存到：${OUTPUT_FILE}\n`);

console.log('========================================\n');

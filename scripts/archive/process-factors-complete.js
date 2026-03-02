// 完整的因子处理流程：去极端值 → 中性化 → Z-Score 标准化
const fs = require('fs');
const path = require('path');

const STOCK_POOL_FILE = path.join(__dirname, 'stock-pool-complete-factors.json');
const OUTPUT_FILE = path.join(__dirname, 'stock-pool-processed-factors.json');

console.log('========================================');
console.log('  因子处理：去极端值 → 中性化 → Z-Score');
console.log('========================================\n');

// 读取股票池
console.log('📖 读取股票池...');
const data = JSON.parse(fs.readFileSync(STOCK_POOL_FILE, 'utf8'));
const stocks = data.stockPool;
console.log(`✅ 股票池：${stocks.length}只\n`);

// ========== 第一步：去极端值 (Winsorize) ==========
console.log('✂️  第一步：去极端值 (Winsorize 1%/99%)\n');

// 需要去极端的因子
const factorsToWinsorize = [
    'pe', 'pb', 'marketCap',
    'turnoverRatio', 'avgTurnover20', 'amplitude'
];

function percentile(values, p) {
    const sorted = [...values].sort((a, b) => a - b);
    const idx = Math.ceil(p / 100 * sorted.length) - 1;
    return parseFloat(sorted[Math.max(0, idx)]) || 0;
}

factorsToWinsorize.forEach(factor => {
    // 收集所有有效值
    const values = stocks
        .map(s => s[factor])
        .filter(v => v !== null && v !== undefined && !isNaN(v));
    
    if (values.length < 10) {
        console.log(`   ⚠️  ${factor}: 数据不足，跳过`);
        return;
    }
    
    // 计算 1% 和 99% 分位
    const p1 = percentile(values, 1);
    const p99 = percentile(values, 99);
    
    // 压回边界
    let clipped = 0;
    stocks.forEach(s => {
        if (s[factor] !== null && s[factor] !== undefined) {
            const original = s[factor];
            s[factor] = Math.max(p1, Math.min(p99, s[factor]));
            if (original !== s[factor]) clipped++;
        }
    });
    
    console.log(`   ✅ ${factor}: [${p1.toFixed(2)}, ${p99.toFixed(2)}], 调整${clipped}只`);
});

console.log('');

// ========== 第二步：中性化 (行业内排名百分位) ==========
console.log('⚖️  第二步：中性化 (行业内排名百分位)\n');

// 需要中性化的因子
const factorsToNeutralize = [
    'pe', 'pb', 'marketCap',
    'turnoverRatio', 'avgTurnover20', 'rps120'
];

// 按行业分组
const byIndustry = {};
stocks.forEach(s => {
    const ind = s.industry || '未知';
    if (!byIndustry[ind]) byIndustry[ind] = [];
    byIndustry[ind].push(s);
});

console.log(`   📊 共 ${Object.keys(byIndustry).length} 个行业\n`);

factorsToNeutralize.forEach(factor => {
    let processed = 0;
    
    Object.values(byIndustry).forEach(group => {
        if (group.length < 3) return;  // 行业太小不处理
        
        // 按因子值排序
        const validGroup = group.filter(s => 
            s[factor] !== null && s[factor] !== undefined && !isNaN(s[factor])
        );
        
        if (validGroup.length < 3) return;
        
        validGroup.sort((a, b) => a[factor] - b[factor]);
        
        // 转换为百分位（0-100）
        validGroup.forEach((s, i) => {
            s[`${factor}_neutralized`] = (i / (validGroup.length - 1)) * 100;
        });
        
        processed += validGroup.length;
    });
    
    console.log(`   ✅ ${factor}: 处理${processed}只股票`);
});

console.log('');

// ========== 第三步：Z-Score 标准化 ==========
console.log('📏  第三步：Z-Score 标准化\n');

// 需要标准化的因子（使用中性化后的值）
const factorsToStandardize = [
    'pe_neutralized', 'pb_neutralized', 'marketCap_neutralized',
    'turnoverRatio_neutralized', 'avgTurnover20_neutralized', 'rps120_neutralized',
    // 技术面因子用原始值
    'ma5', 'roc5', 'rsi6', 'volumeRatio', 'bollingerPosition',
    'amplitude', 'relativeStrength'
];

function mean(values) {
    return values.reduce((s, v) => s + v, 0) / values.length;
}

function std(values) {
    const m = mean(values);
    return Math.sqrt(values.reduce((s, v) => s + Math.pow(v - m, 2), 0) / values.length);
}

factorsToStandardize.forEach(factor => {
    // 收集所有有效值
    const values = stocks
        .map(s => {
            // 对于中性化因子，使用中性化后的值
            if (factor.includes('_neutralized')) {
                return s[factor];
            }
            // 对于技术面因子，使用原始值
            const techFactor = factor.replace('technical.', '');
            return s.technical?.[techFactor] || s[factor];
        })
        .filter(v => v !== null && v !== undefined && !isNaN(v));
    
    if (values.length < 10) {
        console.log(`   ⚠️  ${factor}: 数据不足，跳过`);
        return;
    }
    
    const m = mean(values);
    const s = std(values);
    
    if (s === 0) {
        console.log(`   ⚠️  ${factor}: 标准差为 0，跳过`);
        return;
    }
    
    // Z-Score 标准化
    let standardized = 0;
    stocks.forEach(stock => {
        let value;
        if (factor.includes('_neutralized')) {
            value = stock[factor];
        } else {
            const techFactor = factor.replace('technical.', '');
            value = stock.technical?.[techFactor] || stock[factor];
        }
        
        if (value !== null && value !== undefined && !isNaN(value)) {
            const original = value;
            stock[`${factor}_zscore`] = (value - m) / s;
            standardized++;
        }
    });
    
    console.log(`   ✅ ${factor}: 均值=${m.toFixed(2)}, 标准差=${s.toFixed(2)}, 标准化${standardized}只`);
});

console.log('');

// ========== 保存结果 ==========
console.log('💾 保存结果...\n');

// 为每只股票添加因子总分（等权重）
const allZscoreFactors = factorsToStandardize.map(f => `${f}_zscore`);

stocks.forEach(stock => {
    const validScores = allZscoreFactors
        .map(f => stock[f])
        .filter(v => v !== null && v !== undefined && !isNaN(v));
    
    if (validScores.length > 0) {
        stock.totalScore = validScores.reduce((s, v) => s + v, 0) / validScores.length;
    } else {
        stock.totalScore = null;
    }
});

// 按总分排序
stocks.sort((a, b) => (b.totalScore || -999) - (a.totalScore || -999));

const result = {
    processDate: new Date().toISOString(),
    steps: [
        '1. Winsorize (1%/99%)',
        '2. Neutralize (行业内排名百分位)',
        '3. Z-Score 标准化'
    ],
    factors: {
        winsorized: factorsToWinsorize,
        neutralized: factorsToNeutralize,
        standardized: factorsToStandardize,
        total: allZscoreFactors.length
    },
    stats: {
        total: stocks.length,
        withScore: stocks.filter(s => s.totalScore !== null).length,
        industries: Object.keys(byIndustry).length
    },
    stockPool: stocks
};

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), 'utf8');
console.log(`📁 结果已保存到：${OUTPUT_FILE}\n`);

// 显示 Top 20
console.log('📊 综合评分 Top 20:\n');
console.log('排名 | 代码       | 名称     | 行业     | 总分   | PE    | PB    | RPS120');
console.log('-----|------------|----------|----------|--------|-------|-------|--------');

stocks.slice(0, 20).forEach((s, i) => {
    console.log(
        `${(i+1).toString().padStart(4)} | ${s.tsCode.padEnd(10)} | ${s.name.padEnd(8)} | ${s.industry.padEnd(8)} | ` +
        `${(s.totalScore || 0).toFixed(3).padStart(6)} | ` +
        `${(s.pe_neutralized_zscore || 0).toFixed(2).padStart(5)} | ` +
        `${(s.pb_neutralized_zscore || 0).toFixed(2).padStart(5)} | ` +
        `${(s.rps120_neutralized_zscore || 0).toFixed(2).padStart(5)}`
    );
});

console.log('\n========================================');
console.log('  处理完成！');
console.log('========================================\n');

console.log('✅ 处理流程:\n');
console.log('   1. 去极端值 (Winsorize 1%/99%)');
console.log('      - PE, PB, 市值，换手率，成交额，振幅\n');
console.log('   2. 中性化 (行业内排名百分位)');
console.log('      - PE, PB, 市值，换手率，成交额，RPS120\n');
console.log('   3. Z-Score 标准化');
console.log('      - 中性化后的因子 + 技术面因子\n');
console.log('   4. 等权重综合评分');
console.log('      - 所有 Z-Score 因子平均\n');

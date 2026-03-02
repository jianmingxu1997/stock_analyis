// 完整选股流程：去极端值 → 中性化 → Z-Score → PCA → 综合评分
const fs = require('fs');
const path = require('path');

const STOCK_POOL_FILE = path.join(__dirname, 'stock-pool-complete-factors.json');
const OUTPUT_FILE = path.join(__dirname, 'stock-pool-final-selection.json');

console.log('========================================');
console.log('  完整选股流程');
console.log('========================================\n');

const startTime = Date.now();

// ========== 读取数据 ==========
console.log('📖 读取股票池数据...\n');
const data = JSON.parse(fs.readFileSync(STOCK_POOL_FILE, 'utf8'));
const stocks = data.stockPool;
console.log(`✅ 股票数量：${stocks.length}只\n`);

const t1 = Date.now();

// ========== 第一步：去极端值 ==========
console.log('✂️  第一步：去极端值 (Winsorize 1%/99%)\n');

function percentile(values, p) {
    const sorted = [...values].sort((a, b) => a - b);
    const idx = Math.ceil(p / 100 * sorted.length) - 1;
    return parseFloat(sorted[Math.max(0, idx)]) || 0;
}

const factorsToWinsorize = ['pe', 'pb', 'marketCap'];

factorsToWinsorize.forEach(factor => {
    const values = stocks.map(s => s[factor]).filter(v => v !== null && v !== undefined && !isNaN(v));
    if (values.length < 10) return;
    
    const p1 = percentile(values, 1);
    const p99 = percentile(values, 99);
    
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
const t2 = Date.now();

// ========== 第二步：中性化 ==========
console.log('⚖️  第二步：中性化 (行业内排名百分位)\n');

const factorsToNeutralize = ['pe', 'pb', 'marketCap'];

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
        if (group.length < 3) return;
        
        const validGroup = group.filter(s => 
            s[factor] !== null && s[factor] !== undefined && !isNaN(s[factor])
        );
        
        if (validGroup.length < 3) return;
        
        validGroup.sort((a, b) => a[factor] - b[factor]);
        
        validGroup.forEach((s, i) => {
            s[`${factor}_neutralized`] = (i / (validGroup.length - 1)) * 100;
        });
        
        processed += validGroup.length;
    });
    
    console.log(`   ✅ ${factor}: 处理${processed}只股票`);
});

console.log('');
const t3 = Date.now();

// ========== 第三步：Z-Score 标准化 ==========
console.log('📏  第三步：Z-Score 标准化\n');

function mean(arr) {
    return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function std(arr) {
    const m = mean(arr);
    return Math.sqrt(arr.reduce((s, v) => s + Math.pow(v - m, 2), 0) / arr.length);
}

const factorsToStandardize = [
    'pe_neutralized', 'pb_neutralized', 'marketCap_neutralized',
    'ma5', 'roc5', 'rsi6', 'volumeRatio', 'bollingerPosition'
];

factorsToStandardize.forEach(factor => {
    const values = stocks.map(stock => {
        if (factor.includes('_neutralized')) {
            return stock[factor];
        }
        const techFactor = factor.replace('technical.', '');
        return stock.technical?.[techFactor] || stock[factor];
    }).filter(v => v !== null && v !== undefined && !isNaN(v));
    
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
            stock[`${factor}_zscore`] = (value - m) / s;
            standardized++;
        }
    });
    
    console.log(`   ✅ ${factor}: 均值=${m.toFixed(2)}, 标准差=${s.toFixed(2)}, 标准化${standardized}只`);
});

console.log('');
const t4 = Date.now();

// ========== 第四步：PCA 降维 ==========
console.log('🔍  第四步：PCA 降维\n');

// 矩阵运算
function transpose(matrix) {
    return matrix[0].map((_, i) => matrix.map(row => row[i]));
}

function matrixMultiply(A, B) {
    const rowsA = A.length, colsA = A[0].length;
    const rowsB = B.length, colsB = B[0].length;
    const result = Array(rowsA).fill(null).map(() => Array(colsB).fill(0));
    
    for (let i = 0; i < rowsA; i++) {
        for (let j = 0; j < colsB; j++) {
            for (let k = 0; k < colsA; k++) {
                result[i][j] += A[i][k] * B[k][j];
            }
        }
    }
    return result;
}

// 特征值分解（QR 迭代）
function eigenDecomposition(covMatrix) {
    const n = covMatrix.length;
    let A = covMatrix.map(row => [...row]);
    
    for (let iter = 0; iter < 100; iter++) {
        const Q = [];
        const R = Array(n).fill(null).map(() => Array(n).fill(0));
        
        for (let j = 0; j < n; j++) {
            let v = A.map(row => row[j]);
            
            for (let i = 0; i < j; i++) {
                const q = Q[i];
                const dot = v.reduce((s, val, k) => s + val * q[k], 0);
                R[i][j] = dot;
                v = v.map((val, k) => val - dot * q[k]);
            }
            
            const norm = Math.sqrt(v.reduce((s, val) => s + val * val, 0));
            R[j][j] = norm;
            Q[j] = norm > 0 ? v.map(val => val / norm) : v;
        }
        
        A = matrixMultiply(R, Q);
    }
    
    const eigenvalues = [];
    const eigenvectors = [];
    
    for (let i = 0; i < n; i++) {
        eigenvalues.push(Math.abs(A[i][i]));
        eigenvectors.push(A.map(row => row[i]));
    }
    
    const indices = eigenvalues.map((v, i) => i).sort((a, b) => eigenvalues[b] - eigenvalues[a]);
    
    return {
        eigenvalues: indices.map(i => eigenvalues[i]),
        eigenvectors: indices.map(i => eigenvectors[i])
    };
}

// PCA 因子
const pcaFactors = [
    'pe_neutralized_zscore',
    'pb_neutralized_zscore',
    'marketCap_neutralized_zscore',
    'ma5_zscore',
    'roc5_zscore',
    'rsi6_zscore',
    'volumeRatio_zscore',
    'bollingerPosition_zscore'
];

// 构建数据矩阵
const dataMatrix = [];
const validStocks = [];

stocks.forEach(stock => {
    const values = pcaFactors.map(f => stock[f]);
    
    if (values.every(v => v !== null && v !== undefined && !isNaN(v))) {
        dataMatrix.push(values);
        validStocks.push(stock);
    }
});

console.log(`   ✅ 有效股票：${validStocks.length}只`);
console.log(`   ✅ 因子数量：${pcaFactors.length}个\n`);

// 标准化
const standardized = dataMatrix.map(row => {
    return row.map((v, i) => {
        const col = dataMatrix.map(r => r[i]);
        return (v - mean(col)) / (std(col) || 1);
    });
});

// 协方差矩阵
const n = dataMatrix.length;
const m = pcaFactors.length;
const covMatrix = Array(m).fill(null).map(() => Array(m).fill(0));

for (let i = 0; i < m; i++) {
    for (let j = 0; j < m; j++) {
        let sum = 0;
        for (let k = 0; k < n; k++) {
            sum += standardized[k][i] * standardized[k][j];
        }
        covMatrix[i][j] = sum / (n - 1);
    }
}

console.log(`   ✅ 协方差矩阵：${m}×${m}\n`);

// 特征值分解
const { eigenvalues, eigenvectors } = eigenDecomposition(covMatrix);

console.log('   ✅ 特征值:\n');
eigenvalues.forEach((ev, i) => {
    const variance = ev / eigenvalues.reduce((s, v) => s + v, 0) * 100;
    const cumulative = eigenvalues.slice(0, i + 1).reduce((s, v) => s + v, 0) / eigenvalues.reduce((s, v) => s + v, 0) * 100;
    console.log(`   PC${i + 1}: ${ev.toFixed(3)} (解释方差：${variance.toFixed(1)}%, 累计：${cumulative.toFixed(1)}%)`);
});

// 选择主成分
const totalVariance = eigenvalues.reduce((s, v) => s + v, 0);
let cumulativeVariance = 0;
let numComponents = 0;

for (let i = 0; i < eigenvalues.length; i++) {
    cumulativeVariance += eigenvalues[i];
    if (cumulativeVariance / totalVariance >= 0.85) {
        numComponents = i + 1;
        break;
    }
}

if (numComponents === 0) numComponents = eigenvalues.length;

console.log(`\n   ✅ 选择前 ${numComponents} 个主成分`);
console.log(`   ✅ 累计解释方差：${(cumulativeVariance / totalVariance * 100).toFixed(1)}%\n`);

// 投影
const selectedEigenvectors = eigenvectors.slice(0, numComponents);

const pcaScores = dataMatrix.map(row => {
    return selectedEigenvectors.map(ev => {
        return row.reduce((sum, val, i) => sum + val * ev[i], 0);
    });
});

// 保存 PCA 结果
validStocks.forEach((stock, i) => {
    stock.pcaScores = pcaScores[i];
    stock.pcaTotalScore = mean(pcaScores[i]);
});

const t5 = Date.now();

// ========== 第五步：综合评分和排序 ==========
console.log('📊  第五步：综合评分和排序\n');

// 按 PCA 总分排序
validStocks.sort((a, b) => (b.pcaTotalScore || -999) - (a.pcaTotalScore || -999));

const t6 = Date.now();

// ========== 保存结果 ==========
console.log('💾 保存结果...\n');

const result = {
    processDate: new Date().toISOString(),
    workflow: [
        '1. 去极端值 (Winsorize 1%/99%)',
        '2. 中性化 (行业内排名百分位)',
        '3. Z-Score 标准化',
        '4. PCA 降维',
        '5. 综合评分'
    ],
    timing: {
        read: (t1 - startTime) / 1000,
        winsorize: (t2 - t1) / 1000,
        neutralize: (t3 - t2) / 1000,
        standardize: (t4 - t3) / 1000,
        pca: (t5 - t4) / 1000,
        sort: (t6 - t5) / 1000,
        total: (Date.now() - startTime) / 1000
    },
    pca: {
        originalFactors: pcaFactors.length,
        components: numComponents,
        eigenvalues: eigenvalues.slice(0, numComponents),
        varianceExplained: cumulativeVariance / totalVariance * 100
    },
    stats: {
        totalStocks: stocks.length,
        validStocks: validStocks.length,
        industries: Object.keys(byIndustry).length
    },
    top20: validStocks.slice(0, 20).map(s => ({
        tsCode: s.tsCode,
        name: s.name,
        industry: s.industry,
        totalScore: s.pcaTotalScore,
        pcaScores: s.pcaScores,
        pe: s.pe,
        pb: s.pb,
        marketCap: s.marketCap
    })),
    stockPool: validStocks
};

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), 'utf8');
console.log(`📁 结果已保存到：${OUTPUT_FILE}\n`);

// ========== 显示 Top 20 ==========
console.log('========================================');
console.log('  🏆 Top 20 选股结果');
console.log('========================================\n');

console.log('排名 | 代码       | 名称     | 行业     | 总分   | PE    | PB    | 市值 (亿)');
console.log('-----|------------|----------|----------|--------|-------|-------|----------');

validStocks.slice(0, 20).forEach((s, i) => {
    console.log(
        `${(i+1).toString().padStart(4)} | ${s.tsCode.padEnd(10)} | ${s.name.padEnd(8)} | ${s.industry.padEnd(8)} | ` +
        `${(s.pcaTotalScore || 0).toFixed(3).padStart(6)} | ` +
        `${(s.pe || 0).toFixed(2).padStart(5)} | ` +
        `${(s.pb || 0).toFixed(2).padStart(5)} | ` +
        `${(s.marketCap || 0).toFixed(2).padStart(8)}`
    );
});

const totalTime = Date.now() - startTime;
console.log(`\n========================================`);
console.log('  ✅ 选股流程完成！');
console.log('========================================\n');

console.log('⏱️  耗时统计:\n');
console.log(`   读取数据：${result.timing.read.toFixed(3)}秒`);
console.log(`   去极端值：${result.timing.winsorize.toFixed(3)}秒`);
console.log(`   中性化：${result.timing.neutralize.toFixed(3)}秒`);
console.log(`   Z-Score: ${result.timing.standardize.toFixed(3)}秒`);
console.log(`   PCA 降维：${result.timing.pca.toFixed(3)}秒`);
console.log(`   排序保存：${result.timing.sort.toFixed(3)}秒`);
console.log(`   ─────────────────`);
console.log(`   总计：${result.timing.total.toFixed(3)}秒\n`);

console.log('📊 结果汇总:\n');
console.log(`   原始股票：${stocks.length}只`);
console.log(`   有效股票：${validStocks.length}只`);
console.log(`   行业数量：${Object.keys(byIndustry).length}个`);
console.log(`   原始因子：${pcaFactors.length}个`);
console.log(`   PCA 主成分：${numComponents}个`);
console.log(`   解释方差：${result.pca.varianceExplained.toFixed(1)}%\n`);

console.log('✅ 每日盘后运行此脚本，自动生成 Top 20 选股！\n');

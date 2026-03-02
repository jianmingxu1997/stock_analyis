// PCA 降维处理
const fs = require('fs');
const path = require('path');

const STOCK_POOL_FILE = path.join(__dirname, 'stock-pool-processed-factors.json');
const OUTPUT_FILE = path.join(__dirname, 'stock-pool-pca-factors.json');

console.log('========================================');
console.log('  PCA 降维处理');
console.log('========================================\n');

// ========== 工具函数 ==========

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

function mean(arr) {
    return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function std(arr) {
    const m = mean(arr);
    return Math.sqrt(arr.reduce((s, v) => s + Math.pow(v - m, 2), 0) / arr.length);
}

// 特征值分解（幂迭代法 - 简化版）
function eigenDecomposition(covMatrix) {
    const n = covMatrix.length;
    const eigenvalues = [];
    const eigenvectors = [];
    
    // 复制矩阵
    let A = covMatrix.map(row => [...row]);
    
    // QR 分解迭代（简化版）
    for (let iter = 0; iter < 100; iter++) {
        // QR 分解
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
        
        // A = R * Q
        const newA = matrixMultiply(R, Q);
        A = newA;
    }
    
    // 提取特征值（对角线）
    for (let i = 0; i < n; i++) {
        eigenvalues.push(Math.abs(A[i][i]));
        eigenvectors.push(A.map(row => row[i]));
    }
    
    // 按特征值排序
    const indices = eigenvalues.map((v, i) => i).sort((a, b) => eigenvalues[b] - eigenvalues[a]);
    
    return {
        eigenvalues: indices.map(i => eigenvalues[i]),
        eigenvectors: indices.map(i => eigenvectors[i])
    };
}

// ========== 主流程 ==========

const startTime = Date.now();

// 1. 读取数据
console.log('📖 读取股票池数据...\n');
const data = JSON.parse(fs.readFileSync(STOCK_POOL_FILE, 'utf8'));
const stocks = data.stockPool;
console.log(`✅ 股票数量：${stocks.length}只\n`);

// 2. 提取因子数据
console.log('🔢 提取因子数据...\n');

const factorNames = [
    'pe_neutralized_zscore',
    'pb_neutralized_zscore',
    'marketCap_neutralized_zscore',
    'ma5_zscore',
    'roc5_zscore',
    'rsi6_zscore',
    'volumeRatio_zscore',
    'bollingerPosition_zscore'
];

// 构建数据矩阵 (stocks × factors)
const dataMatrix = [];
const validStocks = [];

stocks.forEach(stock => {
    const values = factorNames.map(f => stock[f]);
    
    // 检查是否有缺失值
    if (values.every(v => v !== null && v !== undefined && !isNaN(v))) {
        dataMatrix.push(values);
        validStocks.push(stock);
    }
});

console.log(`✅ 有效股票：${validStocks.length}只`);
console.log(`✅ 因子数量：${factorNames.length}个\n`);

const t1 = Date.now();
console.log(`⏱️  读取耗时：${(t1 - startTime) / 1000}秒\n`);

// 3. 计算协方差矩阵
console.log('📊 计算协方差矩阵...\n');

const n = dataMatrix.length;
const m = factorNames.length;

// 标准化（确保均值为 0）
const standardized = dataMatrix.map(row => {
    return row.map((v, i) => {
        const col = dataMatrix.map(r => r[i]);
        return (v - mean(col)) / (std(col) || 1);
    });
});

// 协方差矩阵 (m × m)
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

console.log(`✅ 协方差矩阵：${m}×${m}\n`);

const t2 = Date.now();
console.log(`⏱️  协方差耗时：${(t2 - t1) / 1000}秒\n`);

// 4. 特征值分解
console.log('🔍 特征值分解...\n');

const { eigenvalues, eigenvectors } = eigenDecomposition(covMatrix);

console.log('✅ 特征值:\n');
eigenvalues.forEach((ev, i) => {
    const variance = ev / eigenvalues.reduce((s, v) => s + v, 0) * 100;
    const cumulative = eigenvalues.slice(0, i + 1).reduce((s, v) => s + v, 0) / eigenvalues.reduce((s, v) => s + v, 0) * 100;
    console.log(`   PC${i + 1}: ${ev.toFixed(3)} (解释方差：${variance.toFixed(1)}%, 累计：${cumulative.toFixed(1)}%)`);
});

const t3 = Date.now();
console.log(`\n⏱️  特征分解耗时：${(t3 - t2) / 1000}秒\n`);

// 5. 选择主成分数量
console.log('📏 选择主成分数量...\n');

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

console.log(`✅ 选择前 ${numComponents} 个主成分`);
console.log(`✅ 累计解释方差：${(cumulativeVariance / totalVariance * 100).toFixed(1)}%\n`);

// 6. 投影到主成分空间
console.log('🔄 投影到主成分空间...\n');

const selectedEigenvectors = eigenvectors.slice(0, numComponents);

const pcaScores = dataMatrix.map(row => {
    return selectedEigenvectors.map(ev => {
        return row.reduce((sum, val, i) => sum + val * ev[i], 0);
    });
});

const t4 = Date.now();
console.log(`⏱️  投影耗时：${(t4 - t3) / 1000}秒\n`);

// 7. 保存到股票数据
console.log('💾 保存结果...\n');

validStocks.forEach((stock, i) => {
    stock.pcaScores = pcaScores[i];
    stock.pcaTotalScore = mean(pcaScores[i]);  // 简单平均作为总分
});

// 按 PCA 总分排序
validStocks.sort((a, b) => (b.pcaTotalScore || -999) - (a.pcaTotalScore || -999));

const result = {
    processDate: new Date().toISOString(),
    pca: {
        originalFactors: factorNames.length,
        components: numComponents,
        eigenvalues: eigenvalues.slice(0, numComponents),
        eigenvectors: selectedEigenvectors,
        varianceExplained: eigenvalues.slice(0, numComponents).reduce((s, v) => s + v, 0) / totalVariance * 100
    },
    timing: {
        read: (t1 - startTime) / 1000,
        covariance: (t2 - t1) / 1000,
        eigen: (t3 - t2) / 1000,
        project: (t4 - t3) / 1000,
        total: (Date.now() - startTime) / 1000
    },
    stats: {
        totalStocks: stocks.length,
        validStocks: validStocks.length
    },
    stockPool: validStocks
};

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2), 'utf8');
console.log(`📁 结果已保存到：${OUTPUT_FILE}\n`);

// 8. 显示 Top 20
console.log('📊 PCA 综合评分 Top 20:\n');
console.log('排名 | 代码       | 名称     | 行业     | PCA 总分 | PC1    | PC2    | PC3');
console.log('-----|------------|----------|----------|--------|--------|--------|--------');

validStocks.slice(0, 20).forEach((s, i) => {
    console.log(
        `${(i+1).toString().padStart(4)} | ${s.tsCode.padEnd(10)} | ${s.name.padEnd(8)} | ${s.industry.padEnd(8)} | ` +
        `${(s.pcaTotalScore || 0).toFixed(3).padStart(6)} | ` +
        `${(s.pcaScores?.[0] || 0).toFixed(2).padStart(6)} | ` +
        `${(s.pcaScores?.[1] || 0).toFixed(2).padStart(6)} | ` +
        `${(s.pcaScores?.[2] || 0).toFixed(2).padStart(6)}`
    );
});

const totalTime = Date.now() - startTime;
console.log(`\n========================================`);
console.log('  PCA 处理完成！');
console.log('========================================\n');

console.log('⏱️  总耗时统计:\n');
console.log(`   读取数据：${result.timing.read.toFixed(2)}秒`);
console.log(`   协方差矩阵：${result.timing.covariance.toFixed(2)}秒`);
console.log(`   特征值分解：${result.timing.eigen.toFixed(2)}秒`);
console.log(`   投影计算：${result.timing.project.toFixed(2)}秒`);
console.log(`   ─────────────────`);
console.log(`   总计：${result.timing.total.toFixed(2)}秒\n`);

console.log('📊 PCA 结果:\n');
console.log(`   原始因子：${factorNames.length}个`);
console.log(`   主成分：${numComponents}个`);
console.log(`   解释方差：${result.pca.varianceExplained.toFixed(1)}%`);
console.log(`   有效股票：${validStocks.length}只\n`);

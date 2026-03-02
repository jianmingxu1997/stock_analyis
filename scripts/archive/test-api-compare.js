/**
 * ========================================
 * API 对比测试脚本
 * ========================================
 * 
 * 测试东方财富 vs 新浪 API 的稳定性
 * 记录成功率、响应时间、数据质量
 * 
 * 作者：小斐姐
 * 日期：2026-03-02
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// ========================================
// 📋 配置
// ========================================

const TEST_STOCKS = [
    '601398.SH', '601288.SH', '601939.SH',  // 银行
    '600519.SH', '600030.SH', '601857.SH',  // 茅台、中信、石油
    '000001.SZ', '000002.SZ', '000858.SZ',  // 深圳
    '300750.SZ', '300059.SZ'                 // 创业板
];

const LOG_FILE = path.join(__dirname, 'api-test-log.json');

// ========================================
// 🔧 API 测试函数
// ========================================

/**
 * 测试东方财富 API
 */
async function testEastmoney(tsCode) {
    const startTime = Date.now();
    
    try {
        const code = tsCode.split('.')[0];
        const market = tsCode.split('.')[1];
        const secid = market === 'SH' ? `1.${code}` : `0.${code}`;
        
        const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&ut=fa5fd1943c7b386f172d6893dbfba10b&fields=f43,f44,f45,f46,f47,f48,f162,f170`;
        
        const response = await axios.get(url, {
            headers: {
                'Referer': 'https://quote.eastmoney.com/',
                'User-Agent': 'Mozilla/5.0'
            },
            timeout: 15000
        });
        
        const elapsed = Date.now() - startTime;
        
        if (!response.data.data) {
            return { success: false, elapsed, error: '无数据', source: 'eastmoney' };
        }
        
        const d = response.data.data;
        return {
            success: true,
            elapsed,
            source: 'eastmoney',
            data: {
                price: (d.f46 || 0) / 100,
                pct_chg: (d.f162 || 0) / 100,
                vol: (d.f47 || 0) / 100,
                amount: (d.f48 || 0) / 10000
            }
        };
        
    } catch (error) {
        return {
            success: false,
            elapsed: Date.now() - startTime,
            error: error.message,
            source: 'eastmoney'
        };
    }
}

/**
 * 测试新浪 API
 */
async function testSina(tsCode) {
    const startTime = Date.now();
    
    try {
        const code = tsCode.split('.')[0];
        const market = tsCode.split('.')[1].toLowerCase();
        const sinaCode = market + code;  // sh601398
        
        const url = `https://hq.sinajs.cn/list=${sinaCode}`;
        
        const response = await axios.get(url, {
            headers: {
                'Referer': 'https://finance.sina.com.cn/',
                'User-Agent': 'Mozilla/5.0'
            },
            timeout: 15000
        });
        
        const elapsed = Date.now() - startTime;
        const content = response.data;
        
        // 新浪返回格式：var hq_str_sh601398="工商银行，9.73,9.73,9.72,9.84,9.70,9.72,9.71,80281023,781977681,..."
        if (!content || !content.includes('"')) {
            return { success: false, elapsed, error: '无数据', source: 'sina' };
        }
        
        const match = content.match(/="([^"]+)"/);
        if (!match) {
            return { success: false, elapsed, error: '解析失败', source: 'sina' };
        }
        
        const fields = match[1].split(',');
        
        return {
            success: true,
            elapsed,
            source: 'sina',
            data: {
                name: fields[0],
                price: parseFloat(fields[3]) || 0,  // 当前价
                open: parseFloat(fields[1]) || 0,   // 开盘
                high: parseFloat(fields[4]) || 0,   // 最高
                low: parseFloat(fields[5]) || 0,    // 最低
                close: parseFloat(fields[2]) || 0,  // 昨收
                vol: parseFloat(fields[7]) || 0,    // 成交量 (手)
                amount: parseFloat(fields[8]) || 0  // 成交额 (元)
            }
        };
        
    } catch (error) {
        return {
            success: false,
            elapsed: Date.now() - startTime,
            error: error.message,
            source: 'sina'
        };
    }
}

// ========================================
// 📊 统计分析
// ========================================

function analyzeResults(results) {
    const stats = {
        eastmoney: {
            total: 0,
            success: 0,
            failed: 0,
            avgElapsed: 0,
            elapsedList: []
        },
        sina: {
            total: 0,
            success: 0,
            failed: 0,
            avgElapsed: 0,
            elapsedList: []
        },
        both: {
            total: 0,
            bothSuccess: 0,
            eitherSuccess: 0,
            bothFailed: 0
        }
    };
    
    results.forEach(r => {
        // 东方财富统计
        stats.eastmoney.total++;
        if (r.eastmoney.success) {
            stats.eastmoney.success++;
            stats.eastmoney.elapsedList.push(r.eastmoney.elapsed);
        } else {
            stats.eastmoney.failed++;
        }
        
        // 新浪统计
        stats.sina.total++;
        if (r.sina.success) {
            stats.sina.success++;
            stats.sina.elapsedList.push(r.sina.elapsed);
        } else {
            stats.sina.failed++;
        }
        
        // 交叉统计
        stats.both.total++;
        if (r.eastmoney.success && r.sina.success) {
            stats.both.bothSuccess++;
        } else if (r.eastmoney.success || r.sina.success) {
            stats.both.eitherSuccess++;
        } else {
            stats.both.bothFailed++;
        }
    });
    
    // 计算平均耗时
    stats.eastmoney.avgElapsed = stats.eastmoney.elapsedList.length > 0
        ? Math.round(stats.eastmoney.elapsedList.reduce((a, b) => a + b, 0) / stats.eastmoney.elapsedList.length)
        : 0;
    
    stats.sina.avgElapsed = stats.sina.elapsedList.length > 0
        ? Math.round(stats.sina.elapsedList.reduce((a, b) => a + b, 0) / stats.sina.elapsedList.length)
        : 0;
    
    delete stats.eastmoney.elapsedList;
    delete stats.sina.elapsedList;
    
    return stats;
}

// ========================================
// 🚀 主函数
// ========================================

async function main() {
    console.log('========================================');
    console.log('  API 对比测试（东方财富 vs 新浪）');
    console.log('========================================\n');
    
    const startTime = Date.now();
    const results = [];
    
    console.log(`📊 测试股票：${TEST_STOCKS.length}只\n`);
    console.log('🔄 开始测试...\n');
    
    for (let i = 0; i < TEST_STOCKS.length; i++) {
        const tsCode = TEST_STOCKS[i];
        const percent = ((i + 1) / TEST_STOCKS.length * 100).toFixed(1);
        
        // 并发测试两个 API
        const [eastmoney, sina] = await Promise.all([
            testEastmoney(tsCode),
            testSina(tsCode)
        ]);
        
        results.push({ tsCode, eastmoney, sina });
        
        // 显示进度
        const status = {
            '✅✅': '都成功',
            '✅❌': '东成功',
            '❌✅': '新成功',
            '❌❌': '都失败'
        };
        
        const key = `${eastmoney.success ? '✅' : '❌'}${sina.success ? '✅' : '❌'}`;
        console.log(`[${percent}%] ${tsCode.padEnd(12)} | 东财：${eastmoney.success ? '✅' + (eastmoney.elapsed + 'ms').padStart(6) : '❌' + (eastmoney.error).padStart(10)} | 新浪：${sina.success ? '✅' + (sina.elapsed + 'ms').padStart(6) : '❌' + (sina.error).padStart(10)} | ${status[key]}`);
        
        // 暂停，避免限流
        await new Promise(resolve => setTimeout(resolve, 1500));
    }
    
    // 统计分析
    const stats = analyzeResults(results);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log('\n========================================');
    console.log('  测试结果统计');
    console.log('========================================\n');
    
    console.log('📊 东方财富 API:');
    console.log(`   成功率：${(stats.eastmoney.success / stats.eastmoney.total * 100).toFixed(1)}% (${stats.eastmoney.success}/${stats.eastmoney.total})`);
    console.log(`   平均耗时：${stats.eastmoney.avgElapsed}ms\n`);
    
    console.log('📊 新浪 API:');
    console.log(`   成功率：${(stats.sina.success / stats.sina.total * 100).toFixed(1)}% (${stats.sina.success}/${stats.sina.total})`);
    console.log(`   平均耗时：${stats.sina.avgElapsed}ms\n`);
    
    console.log('📊 交叉验证:');
    console.log(`   都成功：${stats.both.bothSuccess}只 (${(stats.both.bothSuccess / stats.both.total * 100).toFixed(1)}%)`);
    console.log(`   至少一个成功：${stats.both.bothSuccess + stats.both.eitherSuccess}只 (${((stats.both.bothSuccess + stats.both.eitherSuccess) / stats.both.total * 100).toFixed(1)}%)`);
    console.log(`   都失败：${stats.both.bothFailed}只 (${(stats.both.bothFailed / stats.both.total * 100).toFixed(1)}%)\n`);
    
    // 推荐方案
    console.log('========================================');
    console.log('  💡 推荐方案');
    console.log('========================================\n');
    
    const eastmoneyRate = stats.eastmoney.success / stats.eastmoney.total;
    const sinaRate = stats.sina.success / stats.sina.total;
    
    if (eastmoneyRate > sinaRate) {
        console.log('✅ 主用：东方财富 API');
        console.log('✅ 备用：新浪 API');
        console.log(`   理由：东财成功率 ${(eastmoneyRate * 100).toFixed(1)}% > 新浪 ${(sinaRate * 100).toFixed(1)}%\n`);
    } else if (sinaRate > eastmoneyRate) {
        console.log('✅ 主用：新浪 API');
        console.log('✅ 备用：东方财富 API');
        console.log(`   理由：新浪成功率 ${(sinaRate * 100).toFixed(1)}% > 东财 ${(eastmoneyRate * 100).toFixed(1)}%\n`);
    } else {
        console.log('✅ 主用：东方财富 API（数据更丰富）');
        console.log('✅ 备用：新浪 API');
        console.log('   理由：成功率相同，东财字段更全\n');
    }
    
    console.log('📝 建议策略:');
    console.log('   1. 优先使用主 API');
    console.log('   2. 失败时自动切换到备用 API');
    console.log('   3. 都失败时记录日志，下次重试');
    console.log('   4. 添加 2-3 秒延迟，避免限流\n');
    
    // 保存结果
    const report = {
        testDate: new Date().toISOString(),
        testStocks: TEST_STOCKS.length,
        totalElapsed: elapsed,
        stats,
        results,
        recommendation: eastmoneyRate >= sinaRate ? 'eastmoney-first' : 'sina-first'
    };
    
    fs.writeFileSync(LOG_FILE, JSON.stringify(report, null, 2), 'utf8');
    console.log(`📁 详细报告已保存到：${LOG_FILE}\n`);
    
    console.log(`⏱️  总耗时：${elapsed}秒\n`);
}

main().catch(console.error);

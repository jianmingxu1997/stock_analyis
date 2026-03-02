// Sina 接口压力测试
// 测试并发限制、频率限制、稳定性

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 测试配置
const CONFIG = {
    // 测试股票代码（选择活跃股票）
    testCodes: [
        'sh600513', 'sz002270', 'sh601398', 'sz000001', 'sh600036',
        'sz300750', 'sh601888', 'sz000858', 'sh600519', 'sz000333',
        'sh601318', 'sz002415', 'sh600276', 'sz300014', 'sh601012',
        'sz002594', 'sh600030', 'sz000725', 'sh601668', 'sz000002'
    ],
    
    // 测试场景
    scenarios: [
        { name: '单次请求', delay: 0, count: 1 },
        { name: '快速请求 (100ms)', delay: 100, count: 50 },
        { name: '中速请求 (500ms)', delay: 500, count: 100 },
        { name: '慢速请求 (1000ms)', delay: 1000, count: 200 },
        { name: '批量请求 (100ms)', delay: 100, count: 500 },
    ]
};

/**
 * 测试单个请求
 */
async function testSingleRequest(code) {
    const start = Date.now();
    
    try {
        const url = `http://hq.sinajs.cn/list=${code}`;
        const response = await axios.get(url, {
            headers: {
                'Referer': 'https://finance.sina.com.cn/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 5000
        });
        
        const elapsed = Date.now() - start;
        const data = response.data;
        
        // 验证数据格式
        if (data.includes('hq_str_') && data.includes(',')) {
            return {
                success: true,
                elapsed,
                code,
                error: null
            };
        } else {
            return {
                success: false,
                elapsed,
                code,
                error: '数据格式错误'
            };
        }
        
    } catch (error) {
        return {
            success: false,
            elapsed: Date.now() - start,
            code,
            error: error.message
        };
    }
}

/**
 * 测试场景
 */
async function runScenario(scenario) {
    console.log(`\n📊 开始测试：${scenario.name}`);
    console.log(`   请求次数：${scenario.count}`);
    console.log(`   间隔：${scenario.delay}ms`);
    console.log('');
    
    const results = [];
    const startTime = Date.now();
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < scenario.count; i++) {
        // 轮询使用测试股票
        const code = CONFIG.testCodes[i % CONFIG.testCodes.length];
        
        const result = await testSingleRequest(code);
        results.push(result);
        
        if (result.success) {
            successCount++;
        } else {
            failCount++;
        }
        
        // 显示进度
        if ((i + 1) % 10 === 0) {
            process.stdout.write(`\r   进度：${i + 1}/${scenario.count} 成功：${successCount} 失败：${failCount}`);
        }
        
        // 延迟
        if (scenario.delay > 0) {
            await new Promise(resolve => setTimeout(resolve, scenario.delay));
        }
    }
    
    const totalTime = Date.now() - startTime;
    const avgTime = results.filter(r => r.success).reduce((sum, r) => sum + r.elapsed, 0) / successCount;
    
    console.log(`\r   进度：${scenario.count}/${scenario.count} 成功：${successCount} 失败：${failCount}`);
    console.log(`\n📈 测试结果:`);
    console.log(`   总耗时：${totalTime}ms (${(totalTime/1000).toFixed(1)}秒)`);
    console.log(`   成功率：${(successCount/scenario.count*100).toFixed(1)}%`);
    console.log(`   平均响应：${avgTime.toFixed(0)}ms`);
    console.log(`   请求/秒：${(scenario.count / (totalTime/1000)).toFixed(1)}`);
    
    // 错误分析
    const errors = results.filter(r => !r.success);
    if (errors.length > 0) {
        console.log(`\n❌ 错误分析:`);
        const errorTypes = {};
        errors.forEach(e => {
            const type = e.error.includes('timeout') ? '超时' : 
                        e.error.includes('403') ? '403 禁止' : 
                        e.error.includes('429') ? '429 限流' : '其他';
            errorTypes[type] = (errorTypes[type] || 0) + 1;
        });
        Object.entries(errorTypes).forEach(([type, count]) => {
            console.log(`   ${type}: ${count}次`);
        });
    }
    
    return {
        scenario: scenario.name,
        total: scenario.count,
        success: successCount,
        fail: failCount,
        successRate: (successCount/scenario.count*100).toFixed(1),
        avgTime: avgTime.toFixed(0),
        reqPerSec: (scenario.count / (totalTime/1000)).toFixed(1)
    };
}

/**
 * 并发测试
 */
async function testConcurrency() {
    console.log(`\n📊 开始测试：并发请求`);
    console.log(`   并发数：10`);
    console.log('');
    
    const startTime = Date.now();
    const promises = [];
    
    for (let i = 0; i < 100; i++) {
        const code = CONFIG.testCodes[i % CONFIG.testCodes.length];
        promises.push(testSingleRequest(code));
    }
    
    const results = await Promise.all(promises);
    const totalTime = Date.now() - startTime;
    
    const successCount = results.filter(r => r.success).length;
    const avgTime = results.filter(r => r.success).reduce((sum, r) => sum + r.elapsed, 0) / successCount;
    
    console.log(`\n📈 测试结果:`);
    console.log(`   总耗时：${totalTime}ms`);
    console.log(`   成功率：${(successCount/100*100).toFixed(1)}%`);
    console.log(`   平均响应：${avgTime.toFixed(0)}ms`);
    
    return {
        scenario: '并发请求 (10)',
        total: 100,
        success: successCount,
        fail: 100 - successCount,
        successRate: (successCount/100*100).toFixed(1),
        avgTime: avgTime.toFixed(0)
    };
}

/**
 * 主函数
 */
async function main() {
    console.log('========================================');
    console.log('  Sina 接口压力测试');
    console.log('  测试时间:', new Date().toLocaleString('zh-CN'));
    console.log('========================================');
    
    const allResults = [];
    
    // 运行各个场景
    for (const scenario of CONFIG.scenarios) {
        const result = await runScenario(scenario);
        allResults.push(result);
        console.log('\n----------------------------------------\n');
    }
    
    // 并发测试
    const concurrencyResult = await testConcurrency();
    allResults.push(concurrencyResult);
    
    // 总结
    console.log('\n========================================');
    console.log('  测试总结');
    console.log('========================================\n');
    
    console.log('📊 各场景表现:\n');
    console.log('场景名称               | 成功率 | 平均响应 | 请求/秒');
    console.log('----------------------|--------|----------|--------');
    allResults.forEach(r => {
        console.log(`${r.scenario.padEnd(21)} | ${r.successRate.padStart(6)}% | ${r.avgTime.padStart(8)}ms | ${r.reqPerSec.padStart(6)}`);
    });
    
    // 推荐配置
    console.log('\n\n💡 推荐配置:\n');
    
    const bestScenario = allResults.reduce((best, curr) => 
        parseFloat(curr.successRate) > parseFloat(best.successRate) ? curr : best
    );
    
    console.log(`✅ 最佳间隔：${bestScenario.scenario.includes('100ms') ? '100ms' : 
                                  bestScenario.scenario.includes('500ms') ? '500ms' : '1000ms'}`);
    console.log(`✅ 预期速度：${bestScenario.reqPerSec} 请求/秒`);
    console.log(`✅ 更新 5384 只股票预计：${(5384 / parseFloat(bestScenario.reqPerSec) / 60).toFixed(1)} 分钟`);
    console.log(`✅ 监控 200 只股票 (5 分钟一次)：${(200 / parseFloat(bestScenario.reqPerSec)).toFixed(1)} 秒`);
    
    // 保存结果
    const reportPath = path.join(__dirname, 'sina-test-report.json');
    fs.writeFileSync(reportPath, JSON.stringify({
        testTime: new Date().toISOString(),
        results: allResults,
        recommendation: bestScenario
    }, null, 2));
    
    console.log(`\n📁 详细报告已保存到：${reportPath}`);
    console.log('\n========================================\n');
}

main().catch(console.error);

// 趋势交易选股策略
// 筛选 5 日均线上穿 10 日均线的股票

const { getSinaRealtime, getTushareDaily, detectGoldenCross, getBatchRealtime } = require('./index');

// 候选股票池（蓝筹股 + 热门股）
const STOCK_POOL = [
    // 银行
    { code: 'sh601939', tsCode: '601939.SH', name: '建设银行' },
    { code: 'sh601398', tsCode: '601398.SH', name: '工商银行' },
    { code: 'sh601288', tsCode: '601288.SH', name: '农业银行' },
    { code: 'sh601988', tsCode: '601988.SH', name: '中国银行' },
    
    // 保险
    { code: 'sh601318', tsCode: '601318.SH', name: '中国平安' },
    
    // 能源
    { code: 'sh601088', tsCode: '601088.SH', name: '中国神华' },
    { code: 'sh601898', tsCode: '601898.SH', name: '中煤能源' },
    
    // 基建
    { code: 'sh601668', tsCode: '601668.SH', name: '中国建筑' },
    { code: 'sh601390', tsCode: '601390.SH', name: '中国中铁' },
    { code: 'sh601186', tsCode: '601186.SH', name: '中国铁建' },
    
    // 通信
    { code: 'sh600941', tsCode: '600941.SH', name: '中国移动' },
    { code: 'sh601728', tsCode: '601728.SH', name: '中国电信' },
    { code: 'sh600050', tsCode: '600050.SH', name: '中国联通' },
    
    // 航运
    { code: 'sh601919', tsCode: '601919.SH', name: '中远海控' },
    { code: 'sh601006', tsCode: '601006.SH', name: '大秦铁路' },
    
    // 消费
    { code: 'sh600887', tsCode: '600887.SH', name: '伊利股份' },
    { code: 'sh600519', tsCode: '600519.SH', name: '贵州茅台' },
    { code: 'sz000858', tsCode: '000858.SZ', name: '五粮液' },
    { code: 'sz000568', tsCode: '000568.SZ', name: '泸州老窖' },
    
    // 机械
    { code: 'sh600031', tsCode: '600031.SH', name: '三一重工' },
    { code: 'sz000066', tsCode: '000066.SZ', name: '中国长城' },
    
    // 医药
    { code: 'sh600513', tsCode: '600513.SH', name: '联环药业' },
    { code: 'sz000999', tsCode: '000999.SZ', name: '华润三九' },
    
    // 汽车
    { code: 'sh601633', tsCode: '601633.SH', name: '长城汽车' },
    
    // 煤炭
    { code: 'sz000937', tsCode: '000937.SZ', name: '冀中能源' }
];

/**
 * 选股策略主函数
 */
async function runStrategy() {
    console.log('========================================');
    console.log('  趋势交易选股策略');
    console.log('  策略：5 日均线上穿 10 日均线');
    console.log('========================================\n');
    
    const endDate = new Date().toISOString().replace(/-/g, '').slice(0, 8);
    const startDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().replace(/-/g, '').slice(0, 8);
    
    const results = [];
    
    for (const stock of STOCK_POOL) {
        process.stdout.write(`分析 ${stock.name} (${stock.tsCode})... `);
        
        try {
            // 获取历史数据
            const daily = await getTushareDaily(stock.tsCode, startDate, endDate);
            
            if (!daily || daily.length < 10) {
                console.log('❌ 数据不足');
                continue;
            }
            
            // 检测金叉
            const signals = detectGoldenCross(daily.reverse());
            const latestSignal = signals[signals.length - 1];
            
            // 获取实时数据
            const realtime = await getSinaRealtime(stock.code);
            
            if (!realtime) {
                console.log('❌ 实时数据获取失败');
                continue;
            }
            
            // 计算当前均线
            const closes = daily.map(d => d.close);
            const ma5 = closes.slice(-5).reduce((a, b) => a + b, 0) / 5;
            const ma10 = closes.slice(-10).reduce((a, b) => a + b, 0) / 10;
            
            const result = {
                ...stock,
                current: realtime.current,
                changePercent: realtime.changePercent,
                ma5: ma5.toFixed(2),
                ma10: ma10.toFixed(2),
                maSignal: ma5 > ma10 ? '多头' : '空头',
                latestSignal: latestSignal ? `${latestSignal.date} ${latestSignal.signal}` : '无',
                volume: realtime.volume,
                timestamp: realtime.timestamp
            };
            
            // 判断是否符合选股条件
            if (ma5 > ma10 && parseFloat(realtime.changePercent) > 0) {
                results.push(result);
                console.log('✅ 符合条件');
            } else {
                console.log('⚪ 不符合');
            }
            
        } catch (error) {
            console.log(`❌ 错误：${error.message}`);
        }
        
        // 避免请求过快
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    // 按涨幅排序
    results.sort((a, b) => parseFloat(b.changePercent) - parseFloat(a.changePercent));
    
    // 输出结果
    console.log('\n========================================');
    console.log('  选股结果');
    console.log('========================================\n');
    
    if (results.length === 0) {
        console.log('❌ 没有找到符合条件的股票');
        return;
    }
    
    console.log(`✅ 找到 ${results.length} 只符合条件的股票\n`);
    console.log('排名 | 股票名称 | 代码 | 现价 | 涨幅 | MA5 | MA10 | 均线信号 | 最新信号');
    console.log('-----|---------|------|------|------|-----|------|---------|----------');
    
    results.forEach((r, i) => {
        console.log(
            `${(i + 1).toString().padStart(4)} | ${r.name.padEnd(8)} | ${r.tsCode} | ` +
            `${r.current.toFixed(2).padStart(6)} | ${r.changePercent.padStart(6)} | ` +
            `${r.ma5.padStart(5)} | ${r.ma10.padStart(5)} | ${r.maSignal.padEnd(7)} | ${r.latestSignal}`
        );
    });
    
    console.log('\n========================================');
    console.log('  操作建议');
    console.log('========================================\n');
    
    if (results.length > 0) {
        console.log('🏆 重点关注前 3 名:');
        results.slice(0, 3).forEach((r, i) => {
            console.log(`  ${i + 1}. ${r.name} (${r.tsCode}) - 现价 ${r.current} 元，涨幅 ${r.changePercent}`);
        });
        
        console.log('\n⚠️ 风险提示:');
        console.log('  1. 设置止损位：跌破 10 日均线止损');
        console.log('  2. 控制仓位：单只股票不超过 20%');
        console.log('  3. 关注大盘：上证指数在 60 日线上才操作');
    }
}

// 运行策略
runStrategy().catch(console.error);

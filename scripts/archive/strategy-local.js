// 趋势交易选股策略 - 使用本地数据
// 筛选 2026 年 2 月 27 日当天 5 日均线上穿 10 日均线的股票

const { scanAllStocks, readStockData, getAllAvailableCodes } = require('./local-reader');
const { getSinaRealtime } = require('./index');

// 目标日期
const TARGET_DATE = '20260227';

/**
 * 选股策略主函数
 */
async function runStrategy() {
    console.log('========================================');
    console.log('  趋势交易选股策略（本地数据版）');
    console.log(`  筛选日期：${TARGET_DATE}`);
    console.log('  策略：5 日均线上穿 10 日均线');
    console.log('========================================\n');
    
    // 扫描所有股票
    const { goldenCrossStocks, deathCrossStocks } = scanAllStocks(TARGET_DATE);
    
    console.log('\n========================================');
    console.log('  选股结果汇总');
    console.log('========================================');
    console.log(`金叉股票数：${goldenCrossStocks.length}`);
    console.log(`死叉股票数：${deathCrossStocks.length}`);
    console.log('========================================\n');
    
    // 获取实时数据并排序
    if (goldenCrossStocks.length > 0) {
        console.log('📈 正在获取实时行情...\n');
        
        for (const stock of goldenCrossStocks) {
            const code = stock.tsCode.includes('SH') ? 
                `sh${stock.tsCode.split('.')[0]}` : 
                `sz${stock.tsCode.split('.')[0]}`;
            
            const realtime = await getSinaRealtime(code);
            
            if (realtime) {
                stock.current = realtime.current;
                stock.changePercent = realtime.changePercent;
                stock.volume = realtime.volume;
            }
            
            // 避免请求过快
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        // 按涨幅排序
        goldenCrossStocks.sort((a, b) => {
            const aChange = parseFloat(a.changePercent) || -999;
            const bChange = parseFloat(b.changePercent) || -999;
            return bChange - aChange;
        });
        
        // 输出结果
        console.log('📊 2 月 27 日金叉股票列表（按涨幅排序）\n');
        console.log('排名 | 代码       | 收盘价 | MA5   | MA10  | 前日 MA5 | 前日 MA10 | 现价   | 涨幅');
        console.log('-----|------------|--------|-------|-------|---------|----------|--------|------');
        
        goldenCrossStocks.forEach((r, i) => {
            const currentStr = r.current ? r.current.toFixed(2) : 'N/A';
            const changeStr = r.changePercent ? r.changePercent : 'N/A';
            console.log(
                `${(i + 1).toString().padStart(4)} | ${r.tsCode.padEnd(10)} | ` +
                `${r.close.toFixed(2).padStart(6)} | ${r.ma5.padStart(5)} | ${r.ma10.padStart(5)} | ` +
                `${r.prevMa5.padStart(7)} | ${r.prevMa10.padStart(8)} | ${currentStr.padStart(6)} | ${changeStr.padStart(6)}`
            );
        });
        
        console.log('\n🏆 重点关注（涨幅前 10 名）:');
        goldenCrossStocks.slice(0, 10).forEach((r, i) => {
            const changeStr = r.changePercent ? r.changePercent : 'N/A';
            console.log(`  ${i + 1}. ${r.tsCode} - 收盘价 ${r.close} 元，涨幅 ${changeStr}`);
        });
        
    } else {
        console.log('❌ 2 月 27 日没有股票发生金叉');
    }
    
    console.log('\n========================================');
    
    // 死叉股票
    if (deathCrossStocks.length > 0) {
        console.log('\n📉 2 月 27 日死叉股票列表\n');
        console.log('排名 | 代码       | 收盘价 | MA5   | MA10  | 前日 MA5 | 前日 MA10');
        console.log('-----|------------|--------|-------|-------|---------|----------');
        
        deathCrossStocks.forEach((r, i) => {
            console.log(
                `${(i + 1).toString().padStart(4)} | ${r.tsCode.padEnd(10)} | ` +
                `${r.close.toFixed(2).padStart(6)} | ${r.ma5.padStart(5)} | ${r.ma10.padStart(5)} | ` +
                `${r.prevMa5.padStart(7)} | ${r.prevMa10.padStart(8)}`
            );
        });
    }
    
    console.log('\n========================================');
    console.log('  操作建议');
    console.log('========================================\n');
    
    if (goldenCrossStocks.length > 0) {
        console.log('✅ 金叉股票操作建议:');
        console.log('  1. 观察次日走势，确认突破有效');
        console.log('  2. 设置止损位：跌破 10 日均线止损');
        console.log('  3. 控制仓位：单只股票不超过 20%');
        console.log('  4. 关注成交量：放量上涨更可靠');
        console.log('\n⚠️ 风险提示:');
        console.log('  - 金叉后可能有回调，不要追高');
        console.log('  - 结合大盘走势判断');
        console.log('  - 注意个股基本面');
    }
}

// 运行策略
runStrategy().catch(console.error);

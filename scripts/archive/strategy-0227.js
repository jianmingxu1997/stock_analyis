// 趋势交易选股策略 - 指定日期金叉筛选
// 筛选 2026 年 2 月 27 日当天 5 日均线上穿 10 日均线的股票

const { getSinaRealtime, getTushareDaily, detectGoldenCross, calculateMA } = require('./index');

// 候选股票池（A 股主要蓝筹 + 热门股）
const STOCK_POOL = [
    // 银行 (10 只)
    { code: 'sh601939', tsCode: '601939.SH', name: '建设银行' },
    { code: 'sh601398', tsCode: '601398.SH', name: '工商银行' },
    { code: 'sh601288', tsCode: '601288.SH', name: '农业银行' },
    { code: 'sh601988', tsCode: '601988.SH', name: '中国银行' },
    { code: 'sh601658', tsCode: '601658.SH', name: '邮储银行' },
    { code: 'sh601328', tsCode: '601328.SH', name: '交通银行' },
    { code: 'sh600036', tsCode: '600036.SH', name: '招商银行' },
    { code: 'sh601166', tsCode: '601166.SH', name: '兴业银行' },
    { code: 'sh600000', tsCode: '600000.SH', name: '浦发银行' },
    { code: 'sh600016', tsCode: '600016.SH', name: '民生银行' },
    
    // 保险 + 证券 (5 只)
    { code: 'sh601318', tsCode: '601318.SH', name: '中国平安' },
    { code: 'sh601628', tsCode: '601628.SH', name: '中国人寿' },
    { code: 'sh601688', tsCode: '601688.SH', name: '华泰证券' },
    { code: 'sh600030', tsCode: '600030.SH', name: '中信证券' },
    { code: 'sz000776', tsCode: '000776.SZ', name: '广发证券' },
    
    // 能源 + 煤炭 (8 只)
    { code: 'sh601088', tsCode: '601088.SH', name: '中国神华' },
    { code: 'sh601898', tsCode: '601898.SH', name: '中煤能源' },
    { code: 'sh600941', tsCode: '600941.SH', name: '中国移动' },
    { code: 'sz000937', tsCode: '000937.SZ', name: '冀中能源' },
    { code: 'sz000983', tsCode: '000983.SZ', name: '山西焦煤' },
    { code: 'sh601699', tsCode: '601699.SH', name: '潞安环能' },
    { code: 'sh600348', tsCode: '600348.SH', name: '阳泉煤业' },
    { code: 'sh601101', tsCode: '601101.SH', name: '昊华能源' },
    
    // 基建 + 铁路 (8 只)
    { code: 'sh601668', tsCode: '601668.SH', name: '中国建筑' },
    { code: 'sh601390', tsCode: '601390.SH', name: '中国中铁' },
    { code: 'sh601186', tsCode: '601186.SH', name: '中国铁建' },
    { code: 'sh601800', tsCode: '601800.SH', name: '中国交建' },
    { code: 'sh601618', tsCode: '601618.SH', name: '中国中冶' },
    { code: 'sh601006', tsCode: '601006.SH', name: '大秦铁路' },
    { code: 'sh601333', tsCode: '601333.SH', name: '广深铁路' },
    { code: 'sh600528', tsCode: '600528.SH', name: '中铁工业' },
    
    // 通信 (5 只)
    { code: 'sh600941', tsCode: '600941.SH', name: '中国移动' },
    { code: 'sh601728', tsCode: '601728.SH', name: '中国电信' },
    { code: 'sh600050', tsCode: '600050.SH', name: '中国联通' },
    { code: 'sz000063', tsCode: '000063.SZ', name: '中兴通讯' },
    { code: 'sz002396', tsCode: '002396.SZ', name: '星网锐捷' },
    
    // 航运 + 港口 (6 只)
    { code: 'sh601919', tsCode: '601919.SH', name: '中远海控' },
    { code: 'sh600026', tsCode: '600026.SH', name: '中远海能' },
    { code: 'sh601872', tsCode: '601872.SH', name: '招商轮船' },
    { code: 'sh600018', tsCode: '600018.SH', name: '上港集团' },
    { code: 'sh601018', tsCode: '601018.SH', name: '宁波港' },
    { code: 'sz000088', tsCode: '000088.SZ', name: '盐田港' },
    
    // 消费 + 白酒 (8 只)
    { code: 'sh600887', tsCode: '600887.SH', name: '伊利股份' },
    { code: 'sh600519', tsCode: '600519.SH', name: '贵州茅台' },
    { code: 'sz000858', tsCode: '000858.SZ', name: '五粮液' },
    { code: 'sz000568', tsCode: '000568.SZ', name: '泸州老窖' },
    { code: 'sz002304', tsCode: '002304.SZ', name: '洋河股份' },
    { code: 'sh600809', tsCode: '600809.SH', name: '山西汾酒' },
    { code: 'sh600702', tsCode: '600702.SH', name: '舍得酒业' },
    { code: 'sh603369', tsCode: '603369.SH', name: '今世缘' },
    
    // 机械 + 制造 (8 只)
    { code: 'sh600031', tsCode: '600031.SH', name: '三一重工' },
    { code: 'sz000066', tsCode: '000066.SZ', name: '中国长城' },
    { code: 'sz000157', tsCode: '000157.SZ', name: '中联重科' },
    { code: 'sh601766', tsCode: '601766.SH', name: '中国中车' },
    { code: 'sh600482', tsCode: '600482.SH', name: '中国动力' },
    { code: 'sz002025', tsCode: '002025.SZ', name: '航天电器' },
    { code: 'sh600893', tsCode: '600893.SH', name: '航发动力' },
    { code: 'sz000768', tsCode: '000768.SZ', name: '中航西飞' },
    
    // 医药 (8 只)
    { code: 'sh600513', tsCode: '600513.SH', name: '联环药业' },
    { code: 'sz000999', tsCode: '000999.SZ', name: '华润三九' },
    { code: 'sh600276', tsCode: '600276.SH', name: '恒瑞医药' },
    { code: 'sz300760', tsCode: '300760.SZ', name: '迈瑞医疗' },
    { code: 'sh600436', tsCode: '600436.SH', name: '片仔癀' },
    { code: 'sz000538', tsCode: '000538.SZ', name: '云南白药' },
    { code: 'sh600085', tsCode: '600085.SH', name: '同仁堂' },
    { code: 'sz002603', tsCode: '002603.SZ', name: '以岭药业' },
    
    // 汽车 (6 只)
    { code: 'sh601633', tsCode: '601633.SH', name: '长城汽车' },
    { code: 'sh600104', tsCode: '600104.SH', name: '上汽集团' },
    { code: 'sz000625', tsCode: '000625.SZ', name: '长安汽车' },
    { code: 'sz002594', tsCode: '002594.SZ', name: '比亚迪' },
    { code: 'sh601127', tsCode: '601127.SH', name: '赛力斯' },
    { code: 'sz000338', tsCode: '000338.SZ', name: '潍柴动力' },
    
    // 房地产 (5 只)
    { code: 'sh000002', tsCode: '000002.SZ', name: '万科 A' },
    { code: 'sh600048', tsCode: '600048.SH', name: '保利发展' },
    { code: 'sz000069', tsCode: '000069.SZ', name: '华侨城 A' },
    { code: 'sh600325', tsCode: '600325.SH', name: '华发股份' },
    { code: 'sh600383', tsCode: '600383.SH', name: '金地集团' },
    
    // 科技 + 电子 (10 只)
    { code: 'sz000725', tsCode: '000725.SZ', name: '京东方 A' },
    { code: 'sz002415', tsCode: '002415.SZ', name: '海康威视' },
    { code: 'sz300014', tsCode: '300014.SZ', name: '亿纬锂能' },
    { code: 'sz300750', tsCode: '300750.SZ', name: '宁德时代' },
    { code: 'sz002230', tsCode: '002230.SZ', name: '科大讯飞' },
    { code: 'sh600745', tsCode: '600745.SH', name: '闻泰科技' },
    { code: 'sz000100', tsCode: '000100.SZ', name: 'TCL 科技' },
    { code: 'sh601012', tsCode: '601012.SH', name: '隆基股份' },
    { code: 'sz002460', tsCode: '002460.SZ', name: '赣锋锂业' },
    { code: 'sz002756', tsCode: '002756.SZ', name: '永兴材料' }
];

// 目标日期
const TARGET_DATE = '20260227';

/**
 * 检测指定日期是否发生金叉
 * @param {Array} data - 历史数据
 * @param {string} targetDate - 目标日期 (YYYYMMDD)
 */
function checkGoldenCrossOnDate(data, targetDate) {
    // 找到目标日期的数据
    const targetIndex = data.findIndex(d => d.trade_date === targetDate);
    
    if (targetIndex === -1 || targetIndex < 9) {
        return { hasSignal: false, reason: '数据不足' };
    }
    
    // 计算目标日期的 MA5 和 MA10
    const closes = data.map(d => d.close);
    
    // 目标日期的均线
    const ma5_target = calculateMA(closes.slice(0, targetIndex + 1), 5);
    const ma10_target = calculateMA(closes.slice(0, targetIndex + 1), 10);
    
    // 前一个交易日的均线
    const ma5_prev = calculateMA(closes.slice(0, targetIndex), 5);
    const ma10_prev = calculateMA(closes.slice(0, targetIndex), 10);
    
    // 判断是否金叉：MA5 上穿 MA10
    const isGoldenCross = ma5_target > ma10_target && ma5_prev <= ma10_prev;
    
    // 判断是否死叉
    const isDeathCross = ma5_target < ma10_target && ma5_prev >= ma10_prev;
    
    return {
        hasSignal: isGoldenCross || isDeathCross,
        isGoldenCross,
        isDeathCross,
        ma5: ma5_target.toFixed(2),
        ma10: ma10_target.toFixed(2),
        prevMa5: ma5_prev.toFixed(2),
        prevMa10: ma10_prev.toFixed(2),
        close: data[targetIndex].close,
        date: targetDate
    };
}

/**
 * 选股策略主函数
 */
async function runStrategy() {
    console.log('========================================');
    console.log('  趋势交易选股策略');
    console.log(`  筛选日期：${TARGET_DATE} (5 日上穿 10 日)`);
    console.log('========================================\n');
    
    const endDate = TARGET_DATE;
    const startDate = new Date(2026, 0, 1).toISOString().replace(/-/g, '').slice(0, 8); // 20260101
    
    const goldenCrossStocks = [];
    const deathCrossStocks = [];
    let analyzedCount = 0;
    
    for (const stock of STOCK_POOL) {
        process.stdout.write(`分析 ${stock.name.padEnd(8)} (${stock.tsCode})... `);
        
        try {
            // 获取历史数据
            const daily = await getTushareDaily(stock.tsCode, startDate, endDate);
            
            if (!daily || daily.length < 10) {
                console.log('❌ 数据不足');
                continue;
            }
            
            analyzedCount++;
            
            // 检测目标日期是否发生金叉/死叉
            const signal = checkGoldenCrossOnDate(daily, TARGET_DATE);
            
            if (!signal.hasSignal) {
                console.log('⚪ 无信号');
                continue;
            }
            
            // 获取实时数据（用于显示当前价格）
            const realtime = await getSinaRealtime(stock.code);
            
            const result = {
                ...stock,
                close: signal.close,
                ma5: signal.ma5,
                ma10: signal.ma10,
                prevMa5: signal.prevMa5,
                prevMa10: signal.prevMa10,
                current: realtime ? realtime.current : null,
                changePercent: realtime ? realtime.changePercent : null,
                timestamp: realtime ? realtime.timestamp : null
            };
            
            if (signal.isGoldenCross) {
                goldenCrossStocks.push(result);
                console.log('✅ 金叉');
            } else {
                deathCrossStocks.push(result);
                console.log('❌ 死叉');
            }
            
        } catch (error) {
            console.log(`❌ 错误：${error.message}`);
        }
        
        // 避免请求过快 - 增加到 1.5 秒避免触发限流
        await new Promise(resolve => setTimeout(resolve, 1500));
    }
    
    // 输出结果
    console.log('\n========================================');
    console.log('  选股结果汇总');
    console.log('========================================');
    console.log(`分析股票数：${analyzedCount}`);
    console.log(`金叉股票数：${goldenCrossStocks.length}`);
    console.log(`死叉股票数：${deathCrossStocks.length}`);
    console.log('========================================\n');
    
    // 金叉股票列表（按收盘价排序）
    if (goldenCrossStocks.length > 0) {
        goldenCrossStocks.sort((a, b) => b.close - a.close);
        
        console.log('📈 2 月 27 日金叉股票列表（按收盘价排序）\n');
        console.log('排名 | 股票名称 | 代码       | 收盘价 | MA5   | MA10  | 前日 MA5 | 前日 MA10 | 现价   | 涨幅');
        console.log('-----|---------|------------|--------|-------|-------|---------|----------|--------|------');
        
        goldenCrossStocks.forEach((r, i) => {
            const currentStr = r.current ? r.current.toFixed(2) : 'N/A';
            const changeStr = r.changePercent ? r.changePercent : 'N/A';
            console.log(
                `${(i + 1).toString().padStart(4)} | ${r.name.padEnd(8)} | ${r.tsCode.padEnd(10)} | ` +
                `${r.close.toFixed(2).padStart(6)} | ${r.ma5.padStart(5)} | ${r.ma10.padStart(5)} | ` +
                `${r.prevMa5.padStart(7)} | ${r.prevMa10.padStart(8)} | ${currentStr.padStart(6)} | ${changeStr.padStart(6)}`
            );
        });
        
        console.log('\n🏆 重点关注（收盘价前 10 名）:');
        goldenCrossStocks.slice(0, 10).forEach((r, i) => {
            console.log(`  ${i + 1}. ${r.name} (${r.tsCode}) - 收盘价 ${r.close} 元，MA5: ${r.ma5}, MA10: ${r.ma10}`);
        });
    } else {
        console.log('❌ 2 月 27 日没有股票发生金叉');
    }
    
    console.log('\n========================================');
    
    // 死叉股票列表
    if (deathCrossStocks.length > 0) {
        console.log('\n📉 2 月 27 日死叉股票列表\n');
        console.log('排名 | 股票名称 | 代码       | 收盘价 | MA5   | MA10  | 前日 MA5 | 前日 MA10');
        console.log('-----|---------|------------|--------|-------|-------|---------|----------');
        
        deathCrossStocks.forEach((r, i) => {
            console.log(
                `${(i + 1).toString().padStart(4)} | ${r.name.padEnd(8)} | ${r.tsCode.padEnd(10)} | ` +
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

// A 股股票数据获取工具
// 支持 Sina Finance 和 Tushare API

const axios = require('axios');

// Tushare 配置
const TUSHARE_TOKEN = 'ee8524fdaa2ee318cbb578e42b4eaaecdad6af533b6dc7d4200c4e6a';
const TUSHARE_API = 'http://api.tushare.pro';

/**
 * Sina Finance 获取实时行情
 * @param {string} code - 股票代码 (如：sh600513, sz002270)
 */
async function getSinaRealtime(code) {
    try {
        const url = `http://hq.sinajs.cn/list=${code}`;
        const response = await axios.get(url, {
            headers: {
                'Referer': 'https://finance.sina.com.cn/',
                'User-Agent': 'Mozilla/5.0'
            },
            timeout: 5000
        });
        
        const data = response.data;
        const elements = data.split(',');
        
        if (elements.length < 32) {
            throw new Error('数据格式错误');
        }
        
        const name = elements[0].split('=')[1].replace(/"/g, '');
        const open = parseFloat(elements[1]);
        const preClose = parseFloat(elements[2]);
        const current = parseFloat(elements[3]);
        const high = parseFloat(elements[4]);
        const low = parseFloat(elements[5]);
        const volume = parseFloat(elements[8]);
        const amount = parseFloat(elements[9]);
        
        const change = current - preClose;
        const changePercent = ((change / preClose) * 100).toFixed(2);
        
        return {
            code: code.toUpperCase(),
            name: name,
            current: current,
            open: open,
            high: high,
            low: low,
            preClose: preClose,
            change: change.toFixed(2),
            changePercent: changePercent + '%',
            volume: volume,
            amount: amount,
            timestamp: new Date().toLocaleString('zh-CN')
        };
    } catch (error) {
        console.error(`获取 ${code} 失败:`, error.message);
        return null;
    }
}

/**
 * Tushare 获取日线数据
 * @param {string} tsCode - 股票代码 (如：002270.SZ, 600513.SH)
 * @param {string} startDate - 开始日期 (如：20260201)
 * @param {string} endDate - 结束日期 (如：20260228)
 */
async function getTushareDaily(tsCode, startDate, endDate) {
    try {
        const response = await axios.post(TUSHARE_API, {
            api_name: 'daily',
            token: TUSHARE_TOKEN,
            params: {
                ts_code: tsCode,
                start_date: startDate,
                end_date: endDate
            }
        });
        
        if (response.data.code !== 0) {
            throw new Error(response.data.msg);
        }
        
        const fields = response.data.data.fields;
        const items = response.data.data.items;
        
        return items.map(item => {
            const data = {};
            fields.forEach((field, index) => {
                data[field] = item[index];
            });
            return data;
        });
    } catch (error) {
        console.error(`获取 Tushare 数据失败:`, error.message);
        return null;
    }
}

/**
 * 计算均线
 * @param {Array} prices - 价格数组
 * @param {number} period - 周期
 */
function calculateMA(prices, period) {
    if (prices.length < period) return null;
    const sum = prices.slice(-period).reduce((a, b) => a + b, 0);
    return sum / period;
}

/**
 * 检测金叉
 * @param {Array} data - 历史数据
 */
function detectGoldenCross(data) {
    const result = [];
    
    for (let i = 9; i < data.length; i++) {
        const ma5 = calculateMA(data.slice(0, i + 1).map(d => d.close), 5);
        const ma10 = calculateMA(data.slice(0, i + 1).map(d => d.close), 10);
        const prevMa5 = calculateMA(data.slice(0, i).map(d => d.close), 5);
        const prevMa10 = calculateMA(data.slice(0, i).map(d => d.close), 10);
        
        // 金叉：MA5 上穿 MA10
        if (ma5 > ma10 && prevMa5 <= prevMa10) {
            result.push({
                date: data[i].trade_date,
                close: data[i].close,
                ma5: ma5.toFixed(2),
                ma10: ma10.toFixed(2),
                signal: '金叉'
            });
        }
        
        // 死叉：MA5 下穿 MA10
        if (ma5 < ma10 && prevMa5 >= prevMa10) {
            result.push({
                date: data[i].trade_date,
                close: data[i].close,
                ma5: ma5.toFixed(2),
                ma10: ma10.toFixed(2),
                signal: '死叉'
            });
        }
    }
    
    return result;
}

/**
 * 批量获取股票实时数据
 * @param {Array} codes - 股票代码数组
 */
async function getBatchRealtime(codes) {
    const results = [];
    
    for (const code of codes) {
        console.log(`获取 ${code}...`);
        const data = await getSinaRealtime(code);
        if (data) {
            results.push(data);
        }
        // 避免请求过快
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // 按涨幅排序
    results.sort((a, b) => parseFloat(b.changePercent) - parseFloat(a.changePercent));
    
    return results;
}

// 命令行交互
async function main() {
    console.log('========================================');
    console.log('  A 股股票数据获取工具');
    console.log('  支持：Sina Finance + Tushare');
    console.log('========================================\n');
    
    // 测试获取华明装备实时数据
    console.log('📊 测试：获取华明装备 (002270) 实时数据...\n');
    const realtime = await getSinaRealtime('sz002270');
    if (realtime) {
        console.log('股票:', realtime.name);
        console.log('代码:', realtime.code);
        console.log('现价:', realtime.current);
        console.log('涨幅:', realtime.changePercent);
        console.log('成交量:', realtime.volume);
        console.log('时间:', realtime.timestamp);
    }
    
    console.log('\n========================================\n');
    
    // 测试获取历史数据
    console.log('📈 测试：获取华明装备历史数据...\n');
    const endDate = new Date().toISOString().replace(/-/g, '').slice(0, 8);
    const startDate = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().replace(/-/g, '').slice(0, 8);
    
    const daily = await getTushareDaily('002270.SZ', startDate, endDate);
    if (daily && daily.length > 0) {
        console.log(`获取到 ${daily.length} 条数据`);
        console.log('最新数据:', daily[0]);
        
        // 检测金叉
        const signals = detectGoldenCross(daily.reverse());
        if (signals.length > 0) {
            console.log('\n📊 均线信号:');
            signals.slice(-5).forEach(s => {
                console.log(`  ${s.date}: ${s.signal} (MA5: ${s.ma5}, MA10: ${s.ma10})`);
            });
        }
    }
    
    console.log('\n========================================\n');
    console.log('✅ 数据获取成功！');
}

// 导出函数供其他模块使用
module.exports = {
    getSinaRealtime,
    getTushareDaily,
    calculateMA,
    detectGoldenCross,
    getBatchRealtime
};

// 运行主函数
if (require.main === module) {
    main().catch(console.error);
}

/**
 * 调试脚本 - 添加详细日志
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

const STOCK_POOL_FILE = path.join(__dirname, 'stock-pool-from-total-stocks.json');
const MERGED_DIR = path.join(__dirname, 'data', 'merged');

async function testDebug() {
    console.log('========================================');
    console.log('  调试模式 - 详细日志');
    console.log('========================================\n');
    
    // 读取股票池
    const stockPoolData = JSON.parse(fs.readFileSync(STOCK_POOL_FILE, 'utf8'));
    const stocks = stockPoolData.stockPool.filter(s => s.tsCode === '600000.SH');
    
    console.log('测试股票:', stocks[0].tsCode);
    console.log('');
    
    // 获取数据
    const tsCode = stocks[0].tsCode;
    const code = tsCode.split('.')[0];
    const market = tsCode.split('.')[1].toLowerCase();
    const sinaCode = market + code;
    
    const url = `https://hq.sinajs.cn/list=${sinaCode}`;
    const response = await axios.get(url, {
        headers: {
            'Referer': 'https://finance.sina.com.cn/',
            'User-Agent': 'Mozilla/5.0'
        },
        timeout: 10000
    });
    
    const match = response.data.match(/="([^"]+)"/);
    const fields = match[1].split(',');
    
    const apiDate = fields[30] ? fields[30].replace(/-/g, '') : 'unknown';
    
    const data = {
        ts_code: tsCode,
        trade_date: apiDate,
        open: parseFloat(fields[1]) || 0,
        high: parseFloat(fields[4]) || 0,
        low: parseFloat(fields[5]) || 0,
        close: parseFloat(fields[3]) || 0,
        pre_close: parseFloat(fields[2]) || 0,
        change: (parseFloat(fields[3]) - parseFloat(fields[2])) || 0,
        pct_chg: ((parseFloat(fields[3]) - parseFloat(fields[2])) / parseFloat(fields[2]) * 100) || 0,
        vol: parseFloat(fields[8]) || 0,
        amount: parseFloat(fields[9]) / 10000
    };
    
    console.log('API 返回的数据:');
    console.log(JSON.stringify(data, null, 2));
    console.log('');
    
    // 检查 CSV
    const csvFile = path.join(MERGED_DIR, 'sh_main.csv');
    const content = fs.readFileSync(csvFile, 'utf8');
    const lines = content.trim().split('\n');
    
    console.log('CSV 文件信息:');
    console.log('  总行数:', lines.length);
    console.log('');
    
    // 检查现有日期
    const existingDates = new Set();
    for (let i = 1; i < lines.length; i++) {
        const fields = lines[i].split(',');
        if (fields.length > 1) {
            existingDates.add(fields[1]);
        }
    }
    
    console.log('日期检查:');
    console.log('  API 日期:', apiDate);
    console.log('  CSV 最新:', Array.from(existingDates)[0]);
    console.log('  是否存在:', existingDates.has(apiDate));
    console.log('');
    
    // 模拟过滤逻辑
    const newData = [data].filter(d => !existingDates.has(d.trade_date));
    
    console.log('过滤结果:');
    console.log('  newData 长度:', newData.length);
    console.log('  应该写入:', newData.length > 0 ? '✅ 是' : '❌ 否');
    console.log('');
    
    if (newData.length > 0) {
        console.log('✅ 数据会正常写入！');
    } else {
        console.log('❌ 数据被过滤掉了！');
        console.log('   原因：CSV 里已经有这个日期了');
        console.log('   但理论上不应该啊...');
    }
}

testDebug().catch(console.error);

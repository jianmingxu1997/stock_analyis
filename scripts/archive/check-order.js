/**
 * 检查数据写入顺序
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

async function test() {
    console.log('========================================');
    console.log('  检查数据写入顺序');
    console.log('========================================\n');
    
    // 获取 API 数据
    const url = 'https://hq.sinajs.cn/list=sh601288';
    const response = await axios.get(url, {
        headers: {
            'Referer': 'https://finance.sina.com.cn/',
            'User-Agent': 'Mozilla/5.0'
        },
        timeout: 10000
    });
    
    const match = response.data.match(/="([^"]+)"/);
    const fields = match[1].split(',');
    
    console.log('API 返回字段:');
    console.log('  [8] vol (成交量，手):', fields[8]);
    console.log('  [9] amount (成交额，元):', fields[9]);
    console.log('');
    
    // 模拟脚本处理
    const data = {
        ts_code: '601288.SH',
        trade_date: '20260302',
        open: parseFloat(fields[1]) || 0,
        high: parseFloat(fields[4]) || 0,
        low: parseFloat(fields[5]) || 0,
        close: parseFloat(fields[3]) || 0,
        pre_close: parseFloat(fields[2]) || 0,
        change: (parseFloat(fields[3]) - parseFloat(fields[2])) || 0,
        pct_chg: ((parseFloat(fields[3]) - parseFloat(fields[2])) / parseFloat(fields[2]) * 100) || 0,
        vol: parseInt(fields[8]) || 0,  // 应该用 parseInt
        amount: parseFloat(fields[9]) / 10000
    };
    
    console.log('转换后的数据:');
    console.log(JSON.stringify(data, null, 2));
    console.log('');
    
    // 模拟写入 CSV 的格式
    const csvLine = `${data.ts_code},${data.trade_date},${data.open},${data.high},${data.low},${data.close},${data.pre_close},${data.change},${data.pct_chg},${data.vol},${data.amount}`;
    
    console.log('写入 CSV 的格式:');
    console.log(csvLine);
    console.log('');
    
    // 检查列顺序
    const csvFields = csvLine.split(',');
    console.log('CSV 字段解析:');
    console.log('  [0] ts_code:', csvFields[0]);
    console.log('  [1] trade_date:', csvFields[1]);
    console.log('  [2] open:', csvFields[2]);
    console.log('  [3] high:', csvFields[3]);
    console.log('  [4] low:', csvFields[4]);
    console.log('  [5] close:', csvFields[5]);
    console.log('  [6] pre_close:', csvFields[6]);
    console.log('  [7] change:', csvFields[7]);
    console.log('  [8] pct_chg:', csvFields[8]);
    console.log('  [9] vol:', csvFields[9]);
    console.log('  [10] amount:', csvFields[10]);
    console.log('');
    
    // 检查表头
    const csvFile = path.join(__dirname, 'data', 'merged', 'sh_main.csv');
    const content = fs.readFileSync(csvFile, 'utf8');
    const header = content.split('\n')[0];
    
    console.log('CSV 表头:');
    console.log(header);
    console.log('');
    
    const headerFields = header.split(',');
    console.log('表头字段:');
    headerFields.forEach((f, i) => {
        console.log(`  [${i}] ${f}`);
    });
}

test().catch(console.error);

/**
 * 详细测试新浪 API 字段
 */

const axios = require('axios');

async function testFields() {
    console.log('========================================');
    console.log('  详细测试新浪 API 字段');
    console.log('========================================\n');
    
    const stock = 'sh600000';
    const url = `https://hq.sinajs.cn/list=${stock}`;
    
    const response = await axios.get(url, {
        headers: {
            'Referer': 'https://finance.sina.com.cn/',
            'User-Agent': 'Mozilla/5.0'
        },
        timeout: 10000
    });
    
    const match = response.data.match(/="([^"]+)"/);
    if (match) {
        const fields = match[1].split(',');
        
        console.log('完整字段列表:');
        console.log('');
        
        fields.forEach((f, i) => {
            console.log(`[${i}] ${f}`);
        });
        
        console.log('');
        console.log('========================================');
        console.log('  关键字段');
        console.log('========================================');
        console.log('');
        console.log('[0]  股票名:', fields[0]);
        console.log('[1]  开盘:', fields[1]);
        console.log('[2]  昨收:', fields[2]);
        console.log('[3]  当前价:', fields[3]);
        console.log('[4]  最高:', fields[4]);
        console.log('[5]  最低:', fields[5]);
        console.log('[6]  竞买价（未用）:', fields[6]);
        console.log('[7]  竞卖价（未用）:', fields[7]);
        console.log('[8]  成交量 (手):', fields[8]);
        console.log('[9]  成交额 (元):', fields[9]);
        console.log('');
        console.log('[30] 日期:', fields[30]);
        console.log('[31] 时间:', fields[31]);
        console.log('');
        console.log('总字段数:', fields.length);
    }
}

testFields().catch(console.error);

/**
 * 测试新浪 API 交互
 */

const axios = require('axios');

async function testSinaAPI() {
    console.log('========================================');
    console.log('  测试新浪 API 交互');
    console.log('========================================\n');
    
    const testStocks = ['sh600000', 'sz000001', 'sh601398'];
    
    for (const stock of testStocks) {
        console.log(`测试：${stock}`);
        
        try {
            const url = `https://hq.sinajs.cn/list=${stock}`;
            const response = await axios.get(url, {
                headers: {
                    'Referer': 'https://finance.sina.com.cn/',
                    'User-Agent': 'Mozilla/5.0'
                },
                timeout: 10000
            });
            
            console.log('原始返回:', response.data);
            
            const match = response.data.match(/="([^"]+)"/);
            if (match) {
                const fields = match[1].split(',');
                console.log('解析结果:');
                console.log('  股票名:', fields[0]);
                console.log('  开盘:', fields[1]);
                console.log('  昨收:', fields[2]);
                console.log('  当前价:', fields[3]);
                console.log('  最高:', fields[4]);
                console.log('  最低:', fields[5]);
                console.log('  成交量:', fields[7]);
                console.log('  成交额:', fields[8]);
                console.log('');
            }
        } catch (error) {
            console.log('错误:', error.message);
            console.log('');
        }
        
        await new Promise(r => setTimeout(r, 1000));
    }
}

testSinaAPI().catch(console.error);

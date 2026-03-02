// 测试数据更新脚本
const fs = require('fs');
const path = require('path');
const axios = require('axios');

async function fetchWithRetry(tsCode, retry = 3) {
    for (let i = 0; i < retry; i++) {
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
            
            if (response.data.data) {
                const d = response.data.data;
                return {
                    ts_code: tsCode,
                    name: d.f14,
                    price: (d.f46 || 0) / 100,
                    pct_chg: (d.f162 || 0) / 100,
                    vol: (d.f47 || 0) / 100,
                    amount: (d.f48 || 0) / 10000
                };
            }
            
            return null;
            
        } catch (error) {
            if (i < retry - 1) {
                await new Promise(r => setTimeout(r, 2000 * (i + 1)));
            }
        }
    }
    return null;
}

async function main() {
    console.log('========================================');
    console.log('  测试数据更新');
    console.log('========================================\n');
    
    // 读取股票池
    const stockPoolData = JSON.parse(fs.readFileSync('stock-pool-from-total-stocks.json', 'utf8'));
    const stocks = stockPoolData.stockPool.slice(0, 10);  // 只测试前 10 只
    
    console.log(`📊 测试股票：${stocks.length}只\n`);
    
    // 逐个测试
    for (const stock of stocks) {
        console.log(`🔄 获取 ${stock.tsCode} (${stock.name})...`);
        const data = await fetchWithRetry(stock.tsCode);
        
        if (data) {
            console.log(`   ✅ 价格：${data.price}, 涨幅：${data.pct_chg}%, 成交量：${data.vol}\n`);
        } else {
            console.log(`   ❌ 获取失败\n`);
        }
        
        // 暂停，避免限流
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('========================================\n');
}

main().catch(console.error);

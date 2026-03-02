// 从东方财富网爬取 A 股完整股票列表
const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function fetchStockList() {
    console.log('========================================');
    console.log('  A 股股票列表获取工具');
    console.log('========================================\n');
    
    const outputPath = path.join(__dirname, 'data', 'stock_data_daily', 'stock_list.txt');
    
    // 东方财富 API - 获取沪深 A 股列表
    const urls = [
        {
            name: '沪市 A 股',
            url: 'http://nufm.dfcfw.com/EM_Fund2099/QF_StockCodes/Standard.aspx?js=var%20list&cb=cb&ps=5000&pn=1&np=1&ut=bd1d9ddb04089700cf9c27f6f7426281&fltt=2&invt=2&d=1709280000000&fs=m:1+t:2,m:1+t:23&fields=f12,f14'
        },
        {
            name: '深市 A 股',
            url: 'http://nufm.dfcfw.com/EM_Fund2099/QF_StockCodes/Standard.aspx?js=var%20list&cb=cb&ps=5000&pn=1&np=1&ut=bd1d9ddb04089700cf9c27f6f7426281&fltt=2&invt=2&d=1709280000000&fs=m:0+t:6,m:0+t:80,m:0+t:13&fields=f12,f14'
        }
    ];
    
    const allCodes = new Set();
    
    for (const { name, url } of urls) {
        console.log(`📥 获取${name}...`);
        
        try {
            const response = await axios.get(url, {
                headers: {
                    'Referer': 'http://quote.eastmoney.com/',
                    'User-Agent': 'Mozilla/5.0'
                },
                timeout: 30000
            });
            
            // 解析返回数据
            const data = response.data;
            const match = data.match(/var\s+list\s*=\s*(\[.*?\]);/s);
            
            if (!match) {
                console.log(`  ⚠️ 未找到数据`);
                continue;
            }
            
            const stocks = JSON.parse(match[1]);
            
            stocks.forEach(stock => {
                const code = stock.f12;  // 股票代码
                const name = stock.f14;  // 股票名称
                
                if (code && name) {
                    // 添加市场后缀
                    const tsCode = code.startsWith('6') ? `${code}.SH` : `${code}.SZ`;
                    allCodes.add(tsCode);
                }
            });
            
            console.log(`  ✅ 获取到 ${stocks.length} 只股票`);
            
        } catch (error) {
            console.log(`  ❌ 失败：${error.message}`);
        }
        
        // 延迟避免限流
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`\n📊 unique 股票代码总数：${allCodes.size}\n`);
    
    // 保存
    const codes = Array.from(allCodes).sort();
    fs.writeFileSync(outputPath, codes.join('\n'), 'utf8');
    
    console.log(`✅ 股票列表已保存到：${outputPath}`);
    console.log(`📁 共 ${codes.length} 只股票\n`);
    
    console.log('📋 前 30 只股票:');
    codes.slice(0, 30).forEach(code => {
        console.log(`  ${code}`);
    });
    
    console.log('\n========================================');
    console.log('  获取完成!');
    console.log('========================================\n');
    
    return codes;
}

fetchStockList();

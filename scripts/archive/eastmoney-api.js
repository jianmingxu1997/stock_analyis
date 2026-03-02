// 东方财富 API 模块
const axios = require('axios');

// 东财 API 基础配置
const EASTMONEY_BASE = 'https://push2.eastmoney.com/api';

// 通用请求头
const HEADERS = {
    'Referer': 'https://quote.eastmoney.com/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
};

/**
 * 获取单个股票资金流向
 * @param {string} tsCode - 股票代码 (如：601611.SH)
 * @returns {Object} 资金流向数据
 */
async function getStockFlow(tsCode) {
    try {
        const code = tsCode.split('.')[0];
        const market = tsCode.split('.')[1];
        const secid = market === 'SH' ? `1.${code}` : `0.${code}`;
        
        const url = `${EASTMONEY_BASE}/qt/stock/fflow/daykline/get?` +
            `lmt=0&klt=1&` +
            `fields1=f1,f2,f3,f7&` +
            `fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f62,f63,f64,f65&` +
            `secid=${secid}`;
        
        const response = await axios.get(url, { headers: HEADERS, timeout: 10000 });
        
        if (!response.data.data || !response.data.data.klines) {
            return null;
        }
        
        const klines = response.data.data.klines;
        const latest = klines[0].split(',');
        
        return {
            date: latest[0],
            mainNetInflow: parseFloat(latest[1]) || 0,      // 主力净流入 (万元)
            smallNetInflow: parseFloat(latest[2]) || 0,     // 小单净流入 (万元)
            mediumNetInflow: parseFloat(latest[3]) || 0,    // 中单净流入 (万元)
            bigNetInflow: parseFloat(latest[4]) || 0,       // 大单净流入 (万元)
            superBigNetInflow: parseFloat(latest[5]) || 0   // 超大单净流入 (万元)
        };
    } catch (error) {
        console.error(`❌ 获取${tsCode}资金流向失败：${error.message}`);
        return null;
    }
}

/**
 * 批量获取股票资金流向
 * @param {Array} tsCodes - 股票代码数组
 * @param {number} delay - 请求间隔 (毫秒)
 * @returns {Object} 资金流向数据字典
 */
async function getBatchFlow(tsCodes, delay = 200) {
    const result = {};
    let success = 0;
    let failed = 0;
    
    console.log(`📊 获取 ${tsCodes.length} 只股票资金流向...\n`);
    
    for (let i = 0; i < tsCodes.length; i++) {
        const tsCode = tsCodes[i];
        const flow = await getStockFlow(tsCode);
        
        if (flow) {
            result[tsCode] = flow;
            success++;
        } else {
            failed++;
        }
        
        // 显示进度
        if ((i + 1) % 50 === 0) {
            console.log(`   进度：${i + 1}/${tsCodes.length} 成功：${success} 失败：${failed}`);
        }
        
        // 延迟避免限流
        if (delay > 0 && i < tsCodes.length - 1) {
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
    
    console.log(`\n✅ 完成：成功${success}只，失败${failed}只\n`);
    return result;
}

/**
 * 获取板块资金流向
 * @param {string} sector - 板块类型 (industry/area/concept)
 * @returns {Array} 板块资金流向列表
 */
async function getSectorFlow(sector = 'industry') {
    try {
        const sectorMap = {
            'industry': 'm90+t2',
            'area': 'm090+t1',
            'concept': 'm90+t3'
        };
        
        const url = `${EASTMONEY_BASE}/qt/sector/fflow/daykline/get?` +
            `lmt=0&klt=1&` +
            `fields1=f1,f2,f3,f7&` +
            `fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61,f62,f63,f64,f65&` +
            `secid=${sectorMap[sector]}`;
        
        const response = await axios.get(url, { headers: HEADERS, timeout: 10000 });
        
        if (!response.data.data || !response.data.data.diff) {
            return [];
        }
        
        return response.data.data.diff.map(item => ({
            name: item.f12,
            mainNetInflow: item.f14,
            changePercent: item.f3,
            mainNetInflowRate: item.f20
        }));
    } catch (error) {
        console.error(`❌ 获取板块资金流向失败：${error.message}`);
        return [];
    }
}

/**
 * 获取北向资金流向
 * @returns {Object} 北向资金数据
 */
async function getNorthFlow() {
    try {
        // 沪股通
        const shUrl = `${EASTMONEY_BASE}/qt/stock/get?secid=1.510300&fields=f12,f14,f43,f44,f45,f46,f116,f117`;
        // 深股通
        const szUrl = `${EASTMONEY_BASE}/qt/stock/get?secid=0.399001&fields=f12,f14,f43,f44,f45,f46,f116,f117`;
        
        const [shRes, szRes] = await Promise.all([
            axios.get(shUrl, { headers: HEADERS, timeout: 10000 }),
            axios.get(szUrl, { headers: HEADERS, timeout: 10000 })
        ]);
        
        return {
            shNorthInflow: shRes.data.data?.f116 || 0,
            szNorthInflow: szRes.data.data?.f116 || 0,
            totalNorthInflow: (shRes.data.data?.f116 || 0) + (szRes.data.data?.f116 || 0)
        };
    } catch (error) {
        console.error(`❌ 获取北向资金失败：${error.message}`);
        return null;
    }
}

/**
 * 获取龙虎榜数据
 * @param {string} date - 日期 (YYYYMMDD)
 * @returns {Array} 龙虎榜数据
 */
async function getLonghuList(date = null) {
    try {
        if (!date) {
            date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        }
        
        const url = `${EASTMONEY_BASE}/dataCenter/WebDataCenter.ashx?` +
            `name=StockLonghu&symbol=&start=0&length=500&` +
            `sort=NetAmount&order=desc&filter=(TradeDate='${date}')`;
        
        const response = await axios.get(url, { headers: HEADERS, timeout: 10000 });
        
        if (!response.data || !response.data.result) {
            return [];
        }
        
        return response.data.result.map(item => ({
            tsCode: `${item.Scode}.SH`,
            name: item.Sname,
            closePrice: item.ClosePrice,
            changePercent: item.Chgradio,
            netAmount: item.NetAmount,
            buyAmount: item.BuyAmount,
            sellAmount: item.SellAmount
        }));
    } catch (error) {
        console.error(`❌ 获取龙虎榜失败：${error.message}`);
        return [];
    }
}

/**
 * 获取融资余额
 * @param {string} tsCode - 股票代码
 * @returns {Object} 融资数据
 */
async function getMarginData(tsCode) {
    try {
        const code = tsCode.split('.')[0];
        const market = tsCode.split('.')[1];
        const secid = market === 'SH' ? `1.${code}` : `0.${code}`;
        
        const url = `${EASTMONEY_BASE}/qt/stock/margin/get?` +
            `secid=${secid}&` +
            `fields=f12,f14,f58,f59,f60,f61,f62,f63`;
        
        const response = await axios.get(url, { headers: HEADERS, timeout: 10000 });
        
        if (!response.data.data) {
            return null;
        }
        
        const data = response.data.data;
        return {
            marginBalance: data.f58 || 0,        // 融资余额 (万元)
            marginChange: data.f59 || 0,         // 融资净买入 (万元)
            shortBalance: data.f60 || 0,         // 融券余额 (万元)
            shortChange: data.f61 || 0           // 融券净卖出 (万元)
        };
    } catch (error) {
        console.error(`❌ 获取${tsCode}融资数据失败：${error.message}`);
        return null;
    }
}

module.exports = {
    getStockFlow,
    getBatchFlow,
    getSectorFlow,
    getNorthFlow,
    getLonghuList,
    getMarginData
};

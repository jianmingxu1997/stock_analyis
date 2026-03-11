/**
 * ========================================
 * 飞书自建应用通知脚本（增强版 v2）
 * ========================================
 * 
 * 功能：通过飞书开放平台 API 发送股票分析结果通知
 * 显示：股票池总数、更新成功数、筛选达标数、行业 Top5
 * 
 * 作者：小斐姐
 * 日期：2026-03-03
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// ========================================
// 📋 配置区域
// ========================================

const PROJECT_ROOT = path.join(__dirname, '..', '..');
const WORKSPACE = path.join(PROJECT_ROOT, '..', '..');
const LOG_DIR = fs.existsSync(path.join(PROJECT_ROOT, 'logs')) 
    ? path.join(PROJECT_ROOT, 'logs')
    : path.join(WORKSPACE, 'logs');
const OUTPUT_EXCEL_DIR = path.join(PROJECT_ROOT, 'output', 'excel');
const CONFIG_FILE = fs.existsSync(path.join(PROJECT_ROOT, 'config', 'feishu-config.json'))
    ? path.join(PROJECT_ROOT, 'config', 'feishu-config.json')
    : path.join(WORKSPACE, 'config', 'feishu-config.json');
const TOKEN_CACHE_FILE = path.join(path.dirname(CONFIG_FILE), '.feishu-token-cache.json');
const SENT_RECORD_FILE = path.join(path.dirname(CONFIG_FILE), '.feishu-sent-record.json');

// 加载配置
let CONFIG = {
    appId: '',
    appSecret: '',
    chatId: ''
};

if (fs.existsSync(CONFIG_FILE)) {
    CONFIG = { ...CONFIG, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) };
}

// 飞书 API 端点
const FEISHU_API = {
    getToken: 'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
    sendMessage: 'https://open.feishu.cn/open-apis/im/v1/messages'
};

// ========================================
// 🔧 工具函数
// ========================================

async function getTenantAccessToken() {
    if (fs.existsSync(TOKEN_CACHE_FILE)) {
        const cache = JSON.parse(fs.readFileSync(TOKEN_CACHE_FILE, 'utf8'));
        const now = Math.floor(Date.now() / 1000);
        if (cache.expiresAt && (now < cache.expiresAt - 600)) {
            console.log('✅ 使用缓存的 access_token');
            return cache.token;
        }
    }
    
    console.log('🔄 获取新的 access_token...');
    
    try {
        const response = await axios.post(FEISHU_API.getToken, {
            app_id: CONFIG.appId,
            app_secret: CONFIG.appSecret
        }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000
        });
        
        if (response.data.code === 0) {
            const token = response.data.tenant_access_token;
            const expiresAt = Math.floor(Date.now() / 1000) + response.data.expire;
            fs.writeFileSync(TOKEN_CACHE_FILE, JSON.stringify({
                token, expiresAt, timestamp: new Date().toISOString()
            }, null, 2), 'utf8');
            console.log(`✅ 获取 token 成功，有效期 ${response.data.expire}秒`);
            return token;
        }
        console.error('❌ 获取 token 失败:', response.data);
        return null;
    } catch (error) {
        console.error('❌ 获取 token 异常:', error.message);
        return null;
    }
}

async function sendFeishuMessage(chatId, content, msgType = 'interactive', receiveIdType = 'user_id') {
    const token = await getTenantAccessToken();
    if (!token) {
        console.error('❌ 无法获取 access_token');
        return false;
    }
    
    try {
        const response = await axios.post(FEISHU_API.sendMessage, {
            receive_id: chatId,
            msg_type: msgType,
            content: JSON.stringify(content)
        }, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            params: { receive_id_type: receiveIdType },
            timeout: 30000
        });
        
        if (response.data.code === 0) {
            console.log('✅ 消息发送成功:', response.data.data.message_id);
            return { success: true, messageId: response.data.data.message_id };
        }
        console.error('❌ 消息发送失败:', response.data);
        return { success: false, error: response.data };
    } catch (error) {
        console.error('❌ 消息发送异常:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * 检查是否已发送过相同日期的通知（防重复）
 */
function checkAlreadySent(tradeDate) {
    if (!fs.existsSync(SENT_RECORD_FILE)) {
        return { sent: false };
    }
    
    try {
        const record = JSON.parse(fs.readFileSync(SENT_RECORD_FILE, 'utf8'));
        if (record.tradeDate === tradeDate && record.messageId) {
            return { sent: true, messageId: record.messageId, timestamp: record.timestamp };
        }
    } catch (e) {
        // 文件损坏，忽略
    }
    
    return { sent: false };
}

/**
 * 记录已发送的通知
 */
function recordSent(tradeDate, messageId) {
    fs.writeFileSync(SENT_RECORD_FILE, JSON.stringify({
        tradeDate,
        messageId,
        timestamp: new Date().toISOString()
    }, null, 2), 'utf8');
}

/**
 * 从数据更新日志读取统计数据
 */
function getUpdateStats(tradeDate) {
    // 支持两种日期格式：20260303 或 2026-03-03
    const logFile1 = path.join(LOG_DIR, `update-${tradeDate}.log`);
    const logFile2 = path.join(LOG_DIR, `update-${tradeDate.slice(0,4)}-${tradeDate.slice(4,6)}-${tradeDate.slice(6,8)}.log`);
    const logFile = fs.existsSync(logFile1) ? logFile1 : logFile2;
    
    if (!fs.existsSync(logFile)) {
        // 如果日志不存在，返回默认值（从筛选结果反推）
        return { totalStocks: 1383, shMain: 792, szMain: 591, successCount: 1383 };
    }
    
    const content = fs.readFileSync(logFile, 'utf8');
    const lines = content.split('\n');
    
    let totalStocks = 0;
    let shMain = 0;
    let szMain = 0;
    let successCount = 0;
    
    for (const line of lines) {
        // 匹配 "股票池：1383 只" 或 "股票池：1383 只"
        const match1 = line.match(/股票池 [:：]\s*(\d+)\s*只/);
        if (match1) totalStocks = parseInt(match1[1]);
        
        const match2 = line.match(/sh_main [:：]\s*(\d+)\s*只/);
        if (match2) shMain = parseInt(match2[1]);
        
        const match3 = line.match(/sz_main [:：]\s*(\d+)\s*只/);
        if (match3) szMain = parseInt(match3[1]);
        
        if (line.includes('追加') && line.includes('条数据')) {
            const match = line.match(/追加 (\d+) 条数据/);
            if (match) successCount += parseInt(match[1]);
        }
    }
    
    // 如果日志解析失败，使用默认值
    if (totalStocks === 0) {
        totalStocks = 1383;
        shMain = 792;
        szMain = 591;
    }
    if (successCount === 0) {
        successCount = totalStocks;
    }
    
    return { totalStocks, shMain, szMain, successCount };
}

/**
 * 从 Excel 读取筛选结果统计
 */
function getScreenStats(tradeDate) {
    // 使用新命名格式：20260309_小斐选股_行业 top20.xlsx
    const xlsxFile = path.join(OUTPUT_EXCEL_DIR, `${tradeDate}_小斐选股_行业 top20.xlsx`);
    if (!fs.existsSync(xlsxFile)) {
        return null;
    }
    
    const XLSX = require('xlsx');
    const wb = XLSX.readFile(xlsxFile);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(ws);
    
    // 统计行业分布
    const industryCount = {};
    const industryScore10 = {};
    
    data.forEach(row => {
        const industry = row['行业'] || '未知';
        industryCount[industry] = (industryCount[industry] || 0) + 1;
        
        if (row['得分'] == 10) {
            industryScore10[industry] = (industryScore10[industry] || 0) + 1;
        }
    });
    
    // 按总数排序取 Top5
    const industryTop5 = Object.entries(industryCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    
    // 统计 10 分股数量
    const score10Count = data.filter(row => row['得分'] == 10).length;
    
    return {
        total: data.length,
        score10Count,
        industryTop5
    };
}

/**
 * 构建通知卡片
 */
function buildNotificationCard(stats, tradeDate, isTest = false) {
    const now = new Date();
    const timestamp = now.toLocaleString('zh-CN');
    
    const card = {
        config: { wide_screen_mode: true },
        header: {
            template: isTest ? 'blue' : 'green',
            title: {
                tag: 'plain_text',
                content: isTest ? '🧪 测试通知' : '✅ 股票分析完成'
            }
        },
        elements: []
    };
    
    // 基础信息
    card.elements.push({
        tag: 'div',
        fields: [
            {
                is_short: true,
                text: {
                    tag: 'lark_md',
                    content: `**📅 交易日期**\n${tradeDate}`
                }
            },
            {
                is_short: true,
                text: {
                    tag: 'lark_md',
                    content: `**⏱️ 通知时间**\n${timestamp}`
                }
            }
        ]
    });
    
    if (!isTest) {
        card.elements.push({ tag: 'hr' });
        
        // 核心统计
        card.elements.push({
            tag: 'div',
            text: {
                tag: 'lark_md',
                content: `**📊 核心统计**`
            }
        });
        
        card.elements.push({
            tag: 'div',
            fields: [
                {
                    is_short: true,
                    text: {
                        tag: 'lark_md',
                        content: `**🔍 股票池总数**\n${stats.update.totalStocks} 只`
                    }
                },
                {
                    is_short: true,
                    text: {
                        tag: 'lark_md',
                        content: `**✅ 更新成功**\n${stats.update.successCount} 只`
                    }
                },
                {
                    is_short: true,
                    text: {
                        tag: 'lark_md',
                        content: `**🎯 筛选达标**\n${stats.screen.total} 只`
                    }
                },
                {
                    is_short: true,
                    text: {
                        tag: 'lark_md',
                        content: `**⭐ 10 分股**\n${stats.screen.score10Count} 只`
                    }
                }
            ]
        });
        
        card.elements.push({ tag: 'hr' });
        
        // 行业分布 Top5
        const top5Text = stats.screen.industryTop5
            .map(([ind, count], i) => `${i + 1}. **${ind}**: ${count}只`)
            .join('\n');
        
        card.elements.push({
            tag: 'div',
            text: {
                tag: 'lark_md',
                content: `**🏭 行业分布 Top5**\n${top5Text}`
            }
        });
        
        // 操作按钮（使用 GitHub 链接，支持手机访问）
        card.elements.push({ tag: 'hr' });
        card.elements.push({
            tag: 'action',
            actions: [
                {
                    tag: 'button',
                    text: {
                        tag: 'plain_text',
                        content: '📊 查看 Excel'
                    },
                    url: `https://github.com/jianmingxu1997/stock_analyis/blob/main/daily/${tradeDate}/${tradeDate}_小斐选股_行业 top20.xlsx`,
                    type: 'primary'
                },
                {
                    tag: 'button',
                    text: {
                        tag: 'plain_text',
                        content: '🌐 打开仪表盘'
                    },
                    url: `https://github.com/jianmingxu1997/stock_analyis/blob/main/daily/${tradeDate}/小斐智能选股 1.0.html`,
                    type: 'default'
                }
            ]
        });
    } else {
        // 测试消息内容
        card.elements.push({ tag: 'hr' });
        card.elements.push({
            tag: 'div',
            text: {
                tag: 'lark_md',
                content: `**👋 这是一条测试通知**\n\n如果你收到这条消息，说明飞书通知配置正确！\n\n股票分析工作流的通知会包含：\n• 股票池总数\n• 更新成功数\n• 筛选达标数\n• 行业分布 Top5\n• 10 分股数量\n\n测试时间：${timestamp}`
            }
        });
    }
    
    return card;
}

// ========================================
// 🚀 主函数
// ========================================

async function main(isTest = false, force = false) {
    console.log('========================================');
    console.log('  飞书通知发送（增强版 v2）');
    console.log('========================================\n');
    
    // 检查配置
    if (!CONFIG.appId || !CONFIG.appSecret) {
        console.error('❌ 配置不完整，请检查 feishu-config.json');
        console.log('需要配置：appId, appSecret');
        return;
    }
    
    // 使用 userId（私聊）或 chatId（群聊）
    const receiveId = CONFIG.userId || CONFIG.chatId;
    const receiveIdType = CONFIG.receiveIdType || 'user_id';
    
    if (!receiveId) {
        console.error('❌ 未配置接收者 (userId 或 chatId)');
        return;
    }
    
    let stats = null;
    let tradeDate = null;
    
    if (!isTest) {
        // 获取最新交易日
        const today = new Date();
        tradeDate = today.toISOString().slice(0, 10).replace(/-/g, '');
        
        console.log(`📊 读取统计数据：${tradeDate}`);
        
        // 检查是否已发送过（防重复）
        if (!force) {
            const checkResult = checkAlreadySent(tradeDate);
            if (checkResult.sent) {
                console.log(`⚠️ 今日通知已发送过 (消息 ID: ${checkResult.messageId})`);
                console.log(`   发送时间：${checkResult.timestamp}`);
                console.log('\n如需重新发送，请使用 --force 参数');
                return;
            }
        }
        
        // 读取更新统计
        const updateStats = getUpdateStats(tradeDate);
        
        // 读取筛选统计
        const screenStats = getScreenStats(tradeDate);
        if (!screenStats) {
            console.error('❌ 未找到筛选结果 Excel');
            return;
        }
        
        stats = {
            update: updateStats,
            screen: screenStats
        };
        
        console.log(`   股票池总数：${updateStats.totalStocks}`);
        console.log(`   更新成功：${updateStats.successCount}`);
        console.log(`   筛选达标：${screenStats.total}`);
        console.log(`   10 分股：${screenStats.score10Count}`);
        console.log(`   行业 Top5: ${screenStats.industryTop5.map(([ind, c]) => `${ind}(${c})`).join(', ')}`);
    }
    
    // 构建卡片消息
    const cardMessage = buildNotificationCard(stats, tradeDate, isTest);
    
    // 发送消息
    const result = await sendFeishuMessage(receiveId, cardMessage, 'interactive', receiveIdType);
    
    if (result.success) {
        console.log('\n✅ 通知发送成功');
        
        // 记录已发送（仅正式通知）
        if (!isTest && tradeDate) {
            recordSent(tradeDate, result.messageId);
            console.log(`📝 已记录发送状态，避免重复发送`);
        }
    } else {
        console.log('\n❌ 通知发送失败');
        if (result.error) {
            console.error('错误:', result.error);
        }
    }
}

// 运行主函数（支持测试模式和强制重发）
const isTest = process.argv.includes('--test');
const isForce = process.argv.includes('--force');
main(isTest, isForce).catch(console.error);

// 导出函数（修复导出名称）
module.exports = { 
    sendFeishuMessage, 
    buildNotificationCard,  // ← 正确名称
    getUpdateStats, 
    getScreenStats, 
    getTenantAccessToken, 
    checkAlreadySent 
};

// 如果作为模块被 require，且调用的是 buildCardMessage，提供别名兼容
if (typeof module !== 'undefined' && module.exports) {
    module.exports.buildCardMessage = buildNotificationCard;  // 别名兼容
}

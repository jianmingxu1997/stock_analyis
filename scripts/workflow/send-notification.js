/**
 * ========================================
 * 飞书自建应用通知脚本（WebSocket/API 模式）
 * ========================================
 * 
 * 功能：通过飞书开放平台 API 发送消息
 * 模式：自建应用 + tenant_access_token
 * 
 * 配置方法：
 * 1. 在飞书开放平台创建自建应用
 * 2. 获取 App ID 和 App Secret
 * 3. 添加机器人权限
 * 4. 配置 feishu-config.json
 * 
 * 使用方法：
 * node send-feishu-notification.js
 * 
 * 作者：小斐姐
 * 日期：2026-03-02
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// ========================================
// 📋 配置区域
// ========================================

const WORKSPACE = path.join(__dirname, '..', '..');
const LOG_DIR = path.join(WORKSPACE, 'logs');
const CONFIG_FILE = path.join(WORKSPACE, 'config', 'feishu-config.json');
const TOKEN_CACHE_FILE = path.join(WORKSPACE, 'config', '.feishu-token-cache.json');

// 加载配置
let CONFIG = {
    appId: '',
    appSecret: '',
    chatId: ''  // 接收消息的群聊 ID 或用户 ID
};

if (fs.existsSync(CONFIG_FILE)) {
    CONFIG = { ...CONFIG, ...JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')) };
}

// 飞书 API 端点
const FEISHU_API = {
    getToken: 'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
    sendMessage: 'https://open.feishu.cn/open-apis/im/v1/messages',
    getChatId: 'https://open.feishu.cn/open-apis/chat/v4/chats'
};

// ========================================
// 🔧 工具函数
// ========================================

/**
 * 获取 tenant_access_token（带缓存）
 */
async function getTenantAccessToken() {
    // 检查缓存
    if (fs.existsSync(TOKEN_CACHE_FILE)) {
        const cache = JSON.parse(fs.readFileSync(TOKEN_CACHE_FILE, 'utf8'));
        const now = Math.floor(Date.now() / 1000);
        
        // token 有效期 2 小时，提前 10 分钟刷新
        if (cache.expiresAt && (now < cache.expiresAt - 600)) {
            console.log('✅ 使用缓存的 access_token');
            return cache.token;
        }
    }
    
    // 获取新 token
    console.log('🔄 获取新的 access_token...');
    
    try {
        const response = await axios.post(FEISHU_API.getToken, {
            app_id: CONFIG.appId,
            app_secret: CONFIG.appSecret
        }, {
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 30000
        });
        
        if (response.data.code === 0) {
            const token = response.data.tenant_access_token;
            const expiresAt = Math.floor(Date.now() / 1000) + response.data.expire;
            
            // 缓存 token
            fs.writeFileSync(TOKEN_CACHE_FILE, JSON.stringify({
                token,
                expiresAt,
                timestamp: new Date().toISOString()
            }, null, 2), 'utf8');
            
            console.log(`✅ 获取 token 成功，有效期 ${response.data.expire}秒`);
            return token;
        } else {
            console.error('❌ 获取 token 失败:', response.data);
            return null;
        }
        
    } catch (error) {
        console.error('❌ 获取 token 异常:', error.message);
        return null;
    }
}

/**
 * 发送消息到飞书
 */
async function sendFeishuMessage(chatId, content, msgType = 'interactive') {
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
            params: {
                receive_id_type: 'chat_id'  // 或 'open_id', 'user_id', 'union_id'
            },
            timeout: 30000
        });
        
        if (response.data.code === 0) {
            console.log('✅ 消息发送成功:', response.data.data.message_id);
            return true;
        } else {
            console.error('❌ 消息发送失败:', response.data);
            return false;
        }
        
    } catch (error) {
        console.error('❌ 消息发送异常:', error.message);
        if (error.response) {
            console.error('响应:', error.response.data);
        }
        return false;
    }
}

/**
 * 读取最新的运行报告
 */
function getLatestReport() {
    const files = fs.readdirSync(LOG_DIR)
        .filter(f => f.startsWith('report-') && f.endsWith('.json'))
        .sort()
        .reverse();
    
    if (files.length === 0) {
        return null;
    }
    
    const reportFile = path.join(LOG_DIR, files[0]);
    return JSON.parse(fs.readFileSync(reportFile, 'utf8'));
}

/**
 * 构建交互式卡片消息
 */
function buildCardMessage(report) {
    const success = report.stats.failed === 0;
    const successRate = ((report.stats.total / (report.stats.total + report.stats.failed)) * 100).toFixed(1);
    
    const card = {
        config: {
            wide_screen_mode: true
        },
        header: {
            template: success ? 'green' : 'red',
            title: {
                tag: 'plain_text',
                content: success ? '✅ 数据更新成功' : '⚠️ 数据更新部分失败'
            }
        },
        elements: [
            {
                tag: 'div',
                fields: [
                    {
                        is_short: true,
                        text: {
                            tag: 'lark_md',
                            content: `**📅 交易日期**\n${report.tradeDate}`
                        }
                    },
                    {
                        is_short: true,
                        text: {
                            tag: 'lark_md',
                            content: `**⏱️ 运行时间**\n${new Date(report.timestamp).toLocaleString('zh-CN')}`
                        }
                    },
                    {
                        is_short: true,
                        text: {
                            tag: 'lark_md',
                            content: `**⏳ 总耗时**\n${report.elapsed}秒`
                        }
                    }
                ]
            },
            {
                tag: 'hr'
            },
            {
                tag: 'div',
                text: {
                    tag: 'lark_md',
                    content: `**📊 统计信息**`
                }
            },
            {
                tag: 'div',
                fields: [
                    {
                        is_short: true,
                        text: {
                            tag: 'lark_md',
                            content: `**总股票数**\n${report.stats.total + report.stats.failed}`
                        }
                    },
                    {
                        is_short: true,
                        text: {
                            tag: 'lark_md',
                            content: `**成功（新浪）**\n${report.stats.success_sina}`
                        }
                    },
                    {
                        is_short: true,
                        text: {
                            tag: 'lark_md',
                            content: `**成功（东财）**\n${report.stats.success_eastmoney}`
                        }
                    },
                    {
                        is_short: true,
                        text: {
                            tag: 'lark_md',
                            content: `**失败**\n${report.stats.failed}`
                        }
                    },
                    {
                        is_short: false,
                        text: {
                            tag: 'lark_md',
                            content: `**成功率**\n${successRate}%`
                        }
                    }
                ]
            }
        ]
    };
    
    // 如果有失败，添加失败列表
    if (report.failedStocks && report.failedStocks.length > 0) {
        const failedList = report.failedStocks.slice(0, 10).map(s => `• ${s.tsCode}: ${s.error}`).join('\n');
        const moreText = report.failedStocks.length > 10 ? `\n... 还有 ${report.failedStocks.length - 10} 只，详见日志` : '';
        
        card.elements.push({
            tag: 'hr'
        });
        card.elements.push({
            tag: 'div',
            text: {
                tag: 'lark_md',
                content: `**❌ 失败股票（前 10 只）**`
            }
        });
        card.elements.push({
            tag: 'div',
            text: {
                tag: 'lark_md',
                content: failedList + moreText
            }
        });
    }
    
    // 添加操作按钮
    card.elements.push({
        tag: 'hr'
    });
    card.elements.push({
        tag: 'action',
        actions: [
            {
                tag: 'button',
                text: {
                    tag: 'plain_text',
                    content: '📁 查看日志目录'
                },
                url: `file://${LOG_DIR}`,
                type: 'default'
            },
            {
                tag: 'button',
                text: {
                    tag: 'plain_text',
                    content: '📊 查看统计报告'
                },
                url: `file://${path.join(LOG_DIR, `report-${report.tradeDate}.json`)}`,
                type: 'primary'
            }
        ]
    });
    
    return card;
}

// ========================================
// 🚀 主函数
// ========================================

async function main() {
    console.log('========================================');
    console.log('  飞书通知发送（自建应用模式）');
    console.log('========================================\n');
    
    // 检查配置
    if (!CONFIG.appId || !CONFIG.appSecret || !CONFIG.chatId) {
        console.error('❌ 配置不完整，请检查 feishu-config.json');
        console.log('需要配置：appId, appSecret, chatId');
        return;
    }
    
    // 获取最新报告
    const report = getLatestReport();
    
    if (!report) {
        console.log('❌ 未找到运行报告');
        return;
    }
    
    console.log(`📊 读取报告：${report.tradeDate}`);
    console.log(`   总股票：${report.stats.total + report.stats.failed}`);
    console.log(`   成功：${report.stats.success_sina + report.stats.success_eastmoney}`);
    console.log(`   失败：${report.stats.failed}\n`);
    
    // 构建卡片消息
    const cardMessage = buildCardMessage(report);
    
    // 发送消息
    const success = await sendFeishuMessage(CONFIG.chatId, cardMessage, 'interactive');
    
    if (success) {
        console.log('\n✅ 通知发送成功');
    } else {
        console.log('\n❌ 通知发送失败');
    }
}

// 运行主函数
main().catch(console.error);

// 导出函数供其他脚本调用
module.exports = { sendFeishuMessage, buildCardMessage, getLatestReport, getTenantAccessToken };

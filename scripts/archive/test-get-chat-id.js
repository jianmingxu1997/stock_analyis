/**
 * 测试获取飞书群聊 ID
 */

const axios = require('axios');
const CONFIG = require('./feishu-config.json');

async function getTenantAccessToken() {
    const response = await axios.post(
        'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
        {
            app_id: CONFIG.appId,
            app_secret: CONFIG.appSecret
        },
        {
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000
        }
    );
    
    if (response.data.code === 0) {
        return response.data.tenant_access_token;
    }
    return null;
}

async function getChatList() {
    const token = await getTenantAccessToken();
    
    if (!token) {
        console.error('❌ 无法获取 token');
        return;
    }
    
    console.log('✅ Token 获取成功\n');
    
    const response = await axios.get(
        'https://open.feishu.cn/open-apis/im/v1/chats?page_size=50',
        {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            timeout: 30000
        }
    );
    
    if (response.data.code === 0) {
        console.log('📋 群聊列表:\n');
        console.log('Chat ID | 群名称 | 成员数');
        console.log('--------|--------|--------');
        
        response.data.data.items.forEach(chat => {
            console.log(`${chat.chat_id} | ${chat.name} | ${chat.member_count}`);
        });
        
        console.log('\n💡 使用方法:');
        console.log('1. 找到你要发送通知的群');
        console.log('2. 复制 chat_id');
        console.log('3. 更新 feishu-config.json 中的 chatId 字段');
        
    } else {
        console.error('❌ 获取群列表失败:', response.data);
    }
}

getChatList().catch(console.error);

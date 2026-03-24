const OpenAI = require('openai')

const client = new OpenAI({
  apiKey:  process.env.DEEPSEEK_API_KEY,
  baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'
})

const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat'

// 宠物疾病咨询系统提示词
const DISEASE_SYSTEM_PROMPT = `你是一位专业的宠物医生助手，拥有丰富的兽医学知识。请根据用户描述的宠物症状，提供专业的分析和建议。

注意事项：
1. 请根据症状给出可能的疾病判断，并建议处理方式
2. 对于严重症状，务必建议用户及时就医
3. 语言简洁易懂，避免过度专业术语
4. 始终关注宠物的安全和健康
5. 如果信息不足，主动询问宠物种类、年龄、症状持续时间等关键信息`

// 宠物营养咨询系统提示词
const NUTRITION_SYSTEM_PROMPT = `你是一位专业的宠物营养师，精通各类宠物的营养需求。请根据用户提供的信息，为宠物提供科学的饮食建议。

注意事项：
1. 根据宠物种类、年龄、体重、健康状况给出针对性建议
2. 推荐具体食材、喂食频率和份量
3. 指出宠物不能食用的危险食物
4. 建议时考虑营养均衡和饮食多样性
5. 如需了解更多信息，主动向用户提问`

/**
 * 创建流式聊天请求
 * @param {Array} messages - 对话历史
 * @param {string} type    - 'disease' | 'nutrition'
 * @returns {AsyncIterable} DeepSeek stream
 */
async function createStream(messages, type = 'disease') {
  const systemPrompt = type === 'nutrition' ? NUTRITION_SYSTEM_PROMPT : DISEASE_SYSTEM_PROMPT
  const fullMessages = [
    { role: 'system', content: systemPrompt },
    ...messages
  ]
  return client.chat.completions.create({
    model:  MODEL,
    messages: fullMessages,
    stream: true,
    temperature: 0.7,
    max_tokens: 2048
  })
}

module.exports = { createStream, DISEASE_SYSTEM_PROMPT, NUTRITION_SYSTEM_PROMPT }

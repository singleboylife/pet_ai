require('dotenv').config()
const http    = require('http')
const express = require('express')
const cors    = require('cors')
const logger  = require('./utils/logger')

const app = express()

// ── 中间件 ────────────────────────────────────────────────
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))
app.use(express.static('public'))

// ── 请求日志（必须在路由之前） ────────────────────────────
app.use(logger.requestMiddleware())


// ── 路由注册 ───────────────────────────────────────────────
app.use('/api/auth',     require('./routes/auth'))
app.use('/api/user',     require('./routes/user'))
app.use('/api/ai',       require('./routes/ai'))
app.use('/api/social',   require('./routes/social'))
app.use('/api/baike',    require('./routes/baike'))
app.use('/api/mall',     require('./routes/mall'))
app.use('/api/merchant', require('./routes/merchant'))
app.use('/api/wallet',   require('./routes/wallet'))
app.use('/api/points',   require('./routes/points'))
app.use('/api/member',   require('./routes/member'))
app.use('/api/admin',    require('./routes/admin'))
app.use('/api/payment',  require('./routes/payment'))

// ── 全局错误处理 ───────────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error(`[GlobalError] ${req.method} ${req.originalUrl}`, err)
  res.status(500).json({ code: 500, message: err.message || '服务器内部错误' })
})

// ── 404 ────────────────────────────────────────────────────
app.use((req, res) => {
  logger.warn(`[404] ${req.method} ${req.originalUrl}`)
  res.status(404).json({ code: 404, message: '接口不存在' })
})

// ── HTTP 服务器 ────────────────────────────────────────────
const httpServer = http.createServer(app)

// ── WebSocket 流式 AI（APP 平台使用，解决 Android 缓冲问题） ─
const { WebSocketServer } = require('ws')
const jwt       = require('jsonwebtoken')
const db        = require('./database/db') // mysql2 pool
const { createStream } = require('./utils/deepseek')

const wss = new WebSocketServer({ server: httpServer, path: '/ws' })

wss.on('connection', (ws) => {
  ws.on('message', async (raw) => {
    let userId
    try {
      const { token, type = 'disease', messages, session_id } = JSON.parse(raw.toString())

      try {
        const payload = jwt.verify(token, process.env.JWT_SECRET)
        userId = payload.id
      } catch {
        ws.send(JSON.stringify({ error: '未授权' }))
        ws.close()
        return
      }

      const [[user]] = await db.query('SELECT * FROM users WHERE id = ?', [userId])
      if (!user) { ws.send(JSON.stringify({ error: '用户不存在' })); ws.close(); return }

      if (!messages || !Array.isArray(messages) || !messages.length) {
        ws.send(JSON.stringify({ error: '消息内容不能为空' })); ws.close(); return
      }

      let fullContent = ''
      try {
        const stream = await createStream(messages, type)
        for await (const chunk of stream) {
          if (ws.readyState !== 1) break
          const content = chunk.choices[0]?.delta?.content || ''
          if (content) {
            fullContent += content
            ws.send(JSON.stringify({ content }))
          }
        }
        if (ws.readyState === 1) ws.send('[DONE]')
      } catch (err) {
        logger.error('[WS DeepSeek]', err.message)
        if (ws.readyState === 1) ws.send(JSON.stringify({ error: 'AI服务异常，请稍后再试' }))
        ws.close()
        return
      }

      const allMessages = [...messages, { role: 'assistant', content: fullContent }]
      const title = messages[0]?.content?.slice(0, 30) || '新咨询'
      if (session_id) {
        const [[existing]] = await db.query('SELECT id FROM consultations WHERE id = ? AND user_id = ?', [session_id, userId])
        if (existing) {
          await db.query('UPDATE consultations SET messages = ? WHERE id = ?', [JSON.stringify(allMessages), session_id])
        }
      } else {
        await db.query('INSERT INTO consultations (user_id, type, title, messages) VALUES (?, ?, ?, ?)', [userId, type, title, JSON.stringify(allMessages)])
      }
      const newPoints = user.points + 2
      await db.query('UPDATE users SET points = ? WHERE id = ?', [newPoints, userId])
      await db.query("INSERT INTO points_transactions (user_id, points, type, description, balance_after) VALUES (?, 2, 'earn', 'AI咨询赠积分', ?)", [userId, newPoints])

    } catch (err) {
      logger.error('[WS Error]', err.message)
      if (ws.readyState === 1) ws.send(JSON.stringify({ error: '请求格式错误' }))
      ws.close()
    }
  })
})

// ── 启动 ────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000
const HOST = process.env.HOST || '0.0.0.0'
httpServer.listen(PORT, HOST, () => {
  logger.info(`宠医宝后端服务已启动`)
  logger.info(`本地访问: http://127.0.0.1:${PORT}`)
  logger.info(`局域网访问: http://192.168.43.181:${PORT}`)
  logger.info(`运行模式: ${process.env.NODE_ENV || 'development'}  日志级别: ${process.env.LOG_LEVEL || 'debug'}`)
})

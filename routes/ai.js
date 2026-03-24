const express = require('express')
const router  = express.Router()
const pool    = require('../database/db')
const auth    = require('../middleware/auth')
const { createStream } = require('../utils/deepseek')
const { localDateTime } = require('../utils/time')

// 流式 AI 咨询
router.post('/stream', auth, async (req, res) => {
  const { messages, type = 'disease', session_id } = req.body
  if (!messages || !Array.isArray(messages) || !messages.length) {
    return res.json({ code: 400, message: '消息内容不能为空' })
  }

  const [[user]] = await pool.query('SELECT points FROM users WHERE id = ?', [req.user.id])

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')

  let fullContent = ''
  try {
    const stream = await createStream(messages, type)
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || ''
      if (content) {
        fullContent += content
        res.write(`data: ${JSON.stringify({ content })}\n\n`)
      }
    }
    res.write('data: [DONE]\n\n')
    res.end()

    const allMessages = [...messages, { role: 'assistant', content: fullContent }]
    const title = messages[0]?.content?.slice(0, 30) || '新咨询'
    if (session_id) {
      const [[existing]] = await pool.query('SELECT id FROM consultations WHERE id = ? AND user_id = ?', [session_id, req.user.id])
      if (existing) {
        await pool.query('UPDATE consultations SET messages = ? WHERE id = ?', [JSON.stringify(allMessages), session_id])
      }
    } else {
      await pool.query('INSERT INTO consultations (user_id, type, title, messages) VALUES (?, ?, ?, ?)',
        [req.user.id, type, title, JSON.stringify(allMessages)])
    }
    const newPoints = user.points + 2
    await pool.query('UPDATE users SET points = ? WHERE id = ?', [newPoints, req.user.id])
    await pool.query(
      "INSERT INTO points_transactions (user_id, points, type, description, balance_after) VALUES (?, 2, 'earn', 'AI咨询赠积分', ?)",
      [req.user.id, newPoints]
    )
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: 'AI服务异常，请稍后再试' })}\n\n`)
    res.end()
  }
})

// 咨询历史列表
router.get('/history', auth, async (req, res) => {
  const { type, page = 1, limit = 20 } = req.query
  const offset = (page - 1) * limit
  let query = 'SELECT id, type, title, messages, created_at FROM consultations WHERE user_id = ?'
  const params = [req.user.id]
  if (type) { query += ' AND type = ?'; params.push(type) }
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
  params.push(parseInt(limit), parseInt(offset))
  try {
    const [list] = await pool.query(query, params)
    list.forEach(item => {
      item.messages = item.messages || []
      item.created_at = localDateTime(new Date(item.created_at))
    })
    const [[{ cnt }]] = await pool.query('SELECT COUNT(*) as cnt FROM consultations WHERE user_id = ?', [req.user.id])
    res.json({ code: 200, data: { list, total: cnt } })
  } catch (err) { res.json({ code: 500, message: err.message }) }
})

// 单条咨询详情
router.get('/history/:id', auth, async (req, res) => {
  try {
    const [[row]] = await pool.query('SELECT * FROM consultations WHERE id = ? AND user_id = ?', [req.params.id, req.user.id])
    if (!row) return res.json({ code: 404, message: '记录不存在' })
    row.messages = row.messages || []
    res.json({ code: 200, data: row })
  } catch (err) { res.json({ code: 500, message: err.message }) }
})

// 删除咨询记录
router.delete('/history/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM consultations WHERE id = ? AND user_id = ?', [req.params.id, req.user.id])
    res.json({ code: 200, message: '已删除' })
  } catch (err) { res.json({ code: 500, message: err.message }) }
})

// 新建咨询会话
router.post('/new-session', auth, async (req, res) => {
  const { type = 'disease' } = req.body
  try {
    const [result] = await pool.query(
      "INSERT INTO consultations (user_id, type, title, messages) VALUES (?, ?, '新咨询', '[]')",
      [req.user.id, type]
    )
    res.json({ code: 200, data: { session_id: result.insertId } })
  } catch (err) { res.json({ code: 500, message: err.message }) }
})

module.exports = router

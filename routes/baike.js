const express = require('express')
const router  = express.Router()
const pool    = require('../database/db')
const auth    = require('../middleware/auth')

const COS_BASE = process.env.COS_BASE_URL || 'https://linbt95-1407297692.cos.ap-guangzhou.myqcloud.com'

function formatEntry(entry) {
  if (!entry) return null
  return {
    ...entry,
    tags: entry.tags || [],
    preview_url: entry.preview_image ? `${COS_BASE}/${entry.preview_image}` : '',
    page_url:    entry.page_path    ? `${COS_BASE}/${entry.page_path}`    : ''
  }
}

// 百科列表
router.get('/list', auth, async (req, res) => {
  const { page = 1, limit = 10, category, random } = req.query
  const offset = (page - 1) * limit
  let query = 'SELECT * FROM baike_entries WHERE 1=1'
  const params = []
  if (category) { query += ' AND category = ?'; params.push(category) }
  query += random === '1' ? ' ORDER BY RAND()' : ' ORDER BY created_at DESC'
  query += ' LIMIT ? OFFSET ?'
  params.push(parseInt(limit), parseInt(offset))
  try {
    const [list] = await pool.query(query, params)
    const [[{ cnt }]] = await pool.query('SELECT COUNT(*) as cnt FROM baike_entries')
    res.json({ code: 200, data: { list: list.map(formatEntry), total: cnt } })
  } catch (err) { res.json({ code: 500, message: err.message }) }
})

// 百科搜索
router.get('/search', auth, async (req, res) => {
  const { q, page = 1, limit = 15 } = req.query
  if (!q || !q.trim()) return res.json({ code: 400, message: '请输入搜索关键词' })
  const offset = (page - 1) * limit
  try {
    const [list] = await pool.query(
      'SELECT * FROM baike_entries WHERE title LIKE ? OR description LIKE ? OR category LIKE ? ORDER BY view_count DESC LIMIT ? OFFSET ?',
      [`%${q}%`, `%${q}%`, `%${q}%`, parseInt(limit), parseInt(offset)]
    )
    const [[{ cnt }]] = await pool.query(
      'SELECT COUNT(*) as cnt FROM baike_entries WHERE title LIKE ? OR description LIKE ? OR category LIKE ?',
      [`%${q}%`, `%${q}%`, `%${q}%`]
    )
    res.json({ code: 200, data: { list: list.map(formatEntry), total: cnt, keyword: q } })
  } catch (err) { res.json({ code: 500, message: err.message }) }
})

// 分类列表
router.get('/categories', auth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT category, COUNT(*) as count FROM baike_entries GROUP BY category ORDER BY count DESC')
    res.json({ code: 200, data: rows })
  } catch (err) { res.json({ code: 500, message: err.message }) }
})

// 随机推荐
router.get('/random/picks', auth, async (req, res) => {
  const limit = parseInt(req.query.limit || 6)
  try {
    const [list] = await pool.query('SELECT * FROM baike_entries ORDER BY RAND() LIMIT ?', [limit])
    res.json({ code: 200, data: list.map(formatEntry) })
  } catch (err) { res.json({ code: 500, message: err.message }) }
})

// 词条详情
router.get('/:id', auth, async (req, res) => {
  try {
    const [[entry]] = await pool.query('SELECT * FROM baike_entries WHERE id = ?', [req.params.id])
    if (!entry) return res.json({ code: 404, message: '词条不存在' })
    await pool.query('UPDATE baike_entries SET view_count = view_count + 1 WHERE id = ?', [req.params.id])
    res.json({ code: 200, data: formatEntry(entry) })
  } catch (err) { res.json({ code: 500, message: err.message }) }
})

module.exports = router

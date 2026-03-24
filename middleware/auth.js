const jwt    = require('jsonwebtoken')
const logger = require('../utils/logger')

module.exports = (req, res, next) => {
  const authHeader = req.headers['authorization']
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn(`[Auth] 无 Token  ${req.method} ${req.originalUrl}`)
    return res.status(401).json({ code: 401, message: '未登录，请先登录' })
  }

  const token = authHeader.slice(7)
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = decoded
    logger.debug(`[Auth] OK  uid=${decoded.id} ${req.method} ${req.originalUrl}`)
    next()
  } catch (err) {
    logger.warn(`[Auth] Token 验证失败: ${err.message}  ${req.method} ${req.originalUrl}`)
    return res.status(401).json({ code: 401, message: 'Token 已过期或无效，请重新登录' })
  }
}

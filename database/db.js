// const mysql  = require('mysql2/promise')
// const logger = require('../utils/logger')

// const pool = mysql.createPool({
//   host:            process.env.DB_HOST     || '127.0.0.1',
//   port:            parseInt(process.env.DB_PORT || '3306'),
//   user:            process.env.DB_USER     || 'root',
//   password:        process.env.DB_PASSWORD || 'root',
//   database:        process.env.DB_NAME     || 'pet_mysql',
//   waitForConnections: true,
//   connectionLimit:    10,
//   queueLimit:         0,
//   timezone:           '+08:00',
//   charset:            'utf8mb4'
// })

// // 测试连接
// pool.getConnection().then(conn => {
//   logger.info('[DB] MySQL 连接池已就绪')
//   conn.release()
// }).catch(err => {
//   logger.error('[DB] MySQL 连接失败', err.message)
//   process.exit(1)
// })

// module.exports = pool

const mysql  = require('mysql2/promise')
const logger = require('../utils/logger')

const pool = mysql.createPool({
  host:            process.env.DB_HOST     || '127.0.0.1',
  port:            parseInt(process.env.DB_PORT || '3306'),
  user:            process.env.DB_USER     || 'root',
  password:        process.env.DB_PASSWORD || 'root',
  database:        process.env.DB_NAME     || 'pet_mysql',
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  connectTimeout:     10000,
  timezone:           '+08:00',
  charset:            'utf8mb4',
  enableKeepAlive:    true,
  keepAliveInitialDelay: 30000
})

// 启动时测试连接（带重试，不会 crash 服务器）
;(async () => {
  const MAX_RETRIES = 10
  const RETRY_DELAY = 3000  // 3 秒
  for (let i = 1; i <= MAX_RETRIES; i++) {
    try {
      const conn = await pool.getConnection()
      logger.info('[DB] MySQL 连接池已就绪')
      conn.release()
      return
    } catch (err) {
      logger.error(`[DB] MySQL 连接失败 (第 ${i}/${MAX_RETRIES} 次): ${err.message}`)
      if (i < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, RETRY_DELAY))
      } else {
        logger.error('[DB] 已达最大重试次数，服务将继续运行但数据库暂不可用')
      }
    }
  }
})()

module.exports = pool
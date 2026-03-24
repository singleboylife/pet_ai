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
  timezone:           '+08:00',
  charset:            'utf8mb4'
})

// 测试连接
pool.getConnection().then(conn => {
  logger.info('[DB] MySQL 连接池已就绪')
  conn.release()
}).catch(err => {
  logger.error('[DB] MySQL 连接失败', err.message)
  process.exit(1)
})

module.exports = pool

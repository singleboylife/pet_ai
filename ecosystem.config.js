// PM2 配置文件
// 注意：敏感信息请使用 .env 文件配置，不要提交到 Git
module.exports = {
  apps: [{
    name: 'aipet-backend',
    script: './server.js',
    cwd: '/home/ubuntu/backend',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: '3000',
      HOST: '0.0.0.0',
      LOG_LEVEL: 'info'
      // 其他环境变量请在服务器上配置 .env 文件
      // 或使用 pm2 start ecosystem.config.js --env production
    }
  }]
}

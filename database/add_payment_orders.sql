-- 添加支付订单表
USE pet_mysql;

CREATE TABLE IF NOT EXISTS payment_orders (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_no        VARCHAR(50) UNIQUE NOT NULL,      -- 内部订单号
  user_id         INT UNSIGNED NOT NULL,
  amount          DECIMAL(10,2) NOT NULL,           -- 支付金额
  payment_method  VARCHAR(20) NOT NULL,             -- alipay / wechat
  trade_no        VARCHAR(100) DEFAULT '',          -- 第三方交易号
  status          VARCHAR(20) DEFAULT 'pending',    -- pending/paid/failed/closed
  notify_data     JSON,                             -- 回调原始数据
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  paid_at         DATETIME DEFAULT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_order_no (order_no),
  INDEX idx_user_id (user_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 添加订单物流信息字段
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS shipping_company VARCHAR(100) DEFAULT '' COMMENT '物流公司',
ADD COLUMN IF NOT EXISTS tracking_number VARCHAR(100) DEFAULT '' COMMENT '物流单号',
ADD COLUMN IF NOT EXISTS shipped_at DATETIME DEFAULT NULL COMMENT '发货时间',
ADD COLUMN IF NOT EXISTS received_at DATETIME DEFAULT NULL COMMENT '收货时间';

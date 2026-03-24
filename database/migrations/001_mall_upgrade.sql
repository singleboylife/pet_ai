-- 商家表
CREATE TABLE IF NOT EXISTS merchants (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  shop_name VARCHAR(100) NOT NULL,
  shop_logo VARCHAR(500),
  shop_banner VARCHAR(500),
  shop_type ENUM('self', 'third_party') DEFAULT 'third_party',
  status ENUM('pending', 'approved', 'rejected', 'suspended') DEFAULT 'pending',
  business_license VARCHAR(500),
  contact_name VARCHAR(50),
  contact_phone VARCHAR(20),
  description TEXT,
  rating DECIMAL(3,2) DEFAULT 5.00,
  sales_count INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

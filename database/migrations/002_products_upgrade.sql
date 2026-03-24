-- 商品表扩展
ALTER TABLE products ADD COLUMN merchant_id INT UNSIGNED DEFAULT 0 AFTER id;
ALTER TABLE products ADD COLUMN shop_type ENUM('self', 'third_party') DEFAULT 'self' AFTER merchant_id;
ALTER TABLE products ADD COLUMN images JSON AFTER image;
ALTER TABLE products ADD COLUMN videos JSON AFTER images;
ALTER TABLE products ADD COLUMN detail_images JSON AFTER videos;
ALTER TABLE products ADD INDEX idx_merchant_id (merchant_id);
ALTER TABLE products ADD INDEX idx_shop_type (shop_type);

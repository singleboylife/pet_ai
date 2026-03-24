-- 订单表扩展
ALTER TABLE orders ADD COLUMN merchant_orders JSON AFTER items;

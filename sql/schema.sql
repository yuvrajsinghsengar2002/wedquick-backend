-- ══════════════════════════════════════════════════════════════
--  WedQuick — Full Database Schema
--  Run this once in cPanel → phpMyAdmin → SQL tab
--  Or via: node sql/migrate.js
-- ══════════════════════════════════════════════════════════════

SET FOREIGN_KEY_CHECKS = 0;

-- ── 1. USERS (customers) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
  uuid          CHAR(36)        NOT NULL UNIQUE,
  phone         VARCHAR(15)     NOT NULL UNIQUE,
  name          VARCHAR(100),
  email         VARCHAR(150)    UNIQUE,
  profile_pic   VARCHAR(500),
  event_date    DATE,
  is_active     TINYINT(1)      DEFAULT 1,
  created_at    TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 2. USER ADDRESSES ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_addresses (
  id            INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
  user_id       INT UNSIGNED    NOT NULL,
  label         VARCHAR(50)     DEFAULT 'Home',
  full_address  TEXT            NOT NULL,
  pincode       VARCHAR(10)     NOT NULL,
  city          VARCHAR(100),
  state         VARCHAR(100),
  lat           DECIMAL(10,8),
  lng           DECIMAL(11,8),
  is_default    TINYINT(1)      DEFAULT 0,
  created_at    TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 3. VENDORS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendors (
  id              INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  uuid            CHAR(36)      NOT NULL UNIQUE,
  store_name      VARCHAR(200)  NOT NULL,
  owner_name      VARCHAR(100)  NOT NULL,
  phone           VARCHAR(15)   NOT NULL UNIQUE,
  email           VARCHAR(150)  UNIQUE,
  password_hash   VARCHAR(255)  NOT NULL,
  description     TEXT,
  logo_url        VARCHAR(500),
  pincode         VARCHAR(10),
  city            VARCHAR(100),
  lat             DECIMAL(10,8),
  lng             DECIMAL(11,8),
  prep_time_mins  INT           DEFAULT 30,
  gst_number      VARCHAR(20),
  bank_account    VARCHAR(20),
  bank_ifsc       VARCHAR(15),
  bank_name       VARCHAR(100),
  kyc_status      ENUM('pending','approved','rejected') DEFAULT 'pending',
  is_active       TINYINT(1)    DEFAULT 0,
  commission_pct  DECIMAL(5,2)  DEFAULT 10.00,
  created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 4. VENDOR SERVICE PINCODES ────────────────────────────────
CREATE TABLE IF NOT EXISTS vendor_pincodes (
  id         INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  vendor_id  INT UNSIGNED  NOT NULL,
  pincode    VARCHAR(10)   NOT NULL,
  FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE,
  UNIQUE KEY uq_vendor_pincode (vendor_id, pincode)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 5. CATEGORIES ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id          INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(100)  NOT NULL,
  slug        VARCHAR(100)  NOT NULL UNIQUE,
  emoji       VARCHAR(10),
  image_url   VARCHAR(500),
  parent_id   INT UNSIGNED  DEFAULT NULL,
  sort_order  INT           DEFAULT 0,
  is_active   TINYINT(1)    DEFAULT 1,
  created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 6. PRODUCTS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id                INT UNSIGNED   AUTO_INCREMENT PRIMARY KEY,
  uuid              CHAR(36)       NOT NULL UNIQUE,
  vendor_id         INT UNSIGNED   NOT NULL,
  category_id       INT UNSIGNED   NOT NULL,
  name              VARCHAR(300)   NOT NULL,
  description       TEXT,
  price             DECIMAL(10,2)  NOT NULL,
  mrp               DECIMAL(10,2),
  stock             INT            DEFAULT 0,
  unit              VARCHAR(50)    DEFAULT 'piece',
  images            JSON,
  delivery_type     SET('standard','urgent','rental') DEFAULT 'standard',
  urgent_eligible   TINYINT(1)     DEFAULT 0,
  rental_eligible   TINYINT(1)     DEFAULT 0,
  rental_price_day  DECIMAL(10,2),
  rental_deposit    DECIMAL(10,2),
  min_rental_days   INT            DEFAULT 1,
  gst_rate          DECIMAL(5,2)   DEFAULT 18.00,
  is_active         TINYINT(1)     DEFAULT 1,
  is_featured       TINYINT(1)     DEFAULT 0,
  rating_avg        DECIMAL(3,2)   DEFAULT 0.00,
  rating_count      INT            DEFAULT 0,
  created_at        TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (vendor_id)   REFERENCES vendors(id)    ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 7. PRODUCT VARIANTS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_variants (
  id          INT UNSIGNED   AUTO_INCREMENT PRIMARY KEY,
  product_id  INT UNSIGNED   NOT NULL,
  label       VARCHAR(100)   NOT NULL,
  price       DECIMAL(10,2)  NOT NULL,
  stock       INT            DEFAULT 0,
  is_active   TINYINT(1)     DEFAULT 1,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 8. ORDERS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id                INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
  order_number      VARCHAR(30)     NOT NULL UNIQUE,
  user_id           INT UNSIGNED    NOT NULL,
  vendor_id         INT UNSIGNED    NOT NULL,
  type              ENUM('purchase','rental','custom') DEFAULT 'purchase',
  delivery_mode     ENUM('urgent','standard','scheduled') DEFAULT 'standard',
  status            ENUM('pending','accepted','packing','ready','out_for_delivery','delivered','cancelled','returned') DEFAULT 'pending',
  delivery_address  JSON            NOT NULL,
  scheduled_at      DATETIME,
  subtotal          DECIMAL(10,2)   NOT NULL,
  delivery_charge   DECIMAL(10,2)   DEFAULT 0,
  express_charge    DECIMAL(10,2)   DEFAULT 0,
  discount_amount   DECIMAL(10,2)   DEFAULT 0,
  gst_amount        DECIMAL(10,2)   DEFAULT 0,
  total_amount      DECIMAL(10,2)   NOT NULL,
  coupon_code       VARCHAR(50),
  payment_status    ENUM('pending','paid','refunded','failed') DEFAULT 'pending',
  payment_method    VARCHAR(50),
  razorpay_order_id VARCHAR(100),
  razorpay_payment_id VARCHAR(100),
  notes             TEXT,
  invoice_url       VARCHAR(500),
  rider_id          INT UNSIGNED,
  rider_name        VARCHAR(100),
  rider_phone       VARCHAR(15),
  tracking_id       VARCHAR(100),
  created_at        TIMESTAMP       DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP       DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)   REFERENCES users(id)   ON DELETE RESTRICT,
  FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 9. ORDER ITEMS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
  id          INT UNSIGNED   AUTO_INCREMENT PRIMARY KEY,
  order_id    INT UNSIGNED   NOT NULL,
  product_id  INT UNSIGNED   NOT NULL,
  variant_id  INT UNSIGNED,
  name        VARCHAR(300)   NOT NULL,
  price       DECIMAL(10,2)  NOT NULL,
  quantity    INT            NOT NULL DEFAULT 1,
  subtotal    DECIMAL(10,2)  NOT NULL,
  FOREIGN KEY (order_id)   REFERENCES orders(id)           ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)         ON DELETE RESTRICT,
  FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 10. RENTAL BOOKINGS ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS rentals (
  id              INT UNSIGNED    AUTO_INCREMENT PRIMARY KEY,
  order_id        INT UNSIGNED    NOT NULL UNIQUE,
  product_id      INT UNSIGNED    NOT NULL,
  user_id         INT UNSIGNED    NOT NULL,
  pickup_date     DATE            NOT NULL,
  return_date     DATE            NOT NULL,
  rental_days     INT             NOT NULL,
  rental_amount   DECIMAL(10,2)  NOT NULL,
  deposit_amount  DECIMAL(10,2)  NOT NULL,
  deposit_status  ENUM('held','returned','forfeited') DEFAULT 'held',
  return_condition ENUM('good','damaged','missing')   DEFAULT 'good',
  damage_charge   DECIMAL(10,2)  DEFAULT 0,
  returned_at     DATETIME,
  FOREIGN KEY (order_id)   REFERENCES orders(id)   ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 11. CUSTOM REQUIREMENTS ───────────────────────────────────
CREATE TABLE IF NOT EXISTS custom_requirements (
  id              INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  uuid            CHAR(36)      NOT NULL UNIQUE,
  user_id         INT UNSIGNED  NOT NULL,
  event_type      VARCHAR(100),
  event_date      DATE,
  location        TEXT,
  budget_min      DECIMAL(10,2),
  budget_max      DECIMAL(10,2),
  quantity        INT,
  description     TEXT,
  reference_images JSON,
  status          ENUM('new','assigned','quoted','accepted','rejected','converted') DEFAULT 'new',
  assigned_to     INT UNSIGNED,
  converted_order_id INT UNSIGNED,
  created_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 12. QUOTATIONS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quotations (
  id              INT UNSIGNED   AUTO_INCREMENT PRIMARY KEY,
  uuid            CHAR(36)       NOT NULL UNIQUE,
  requirement_id  INT UNSIGNED   NOT NULL,
  user_id         INT UNSIGNED   NOT NULL,
  created_by      INT UNSIGNED   NOT NULL,
  items           JSON           NOT NULL,
  subtotal        DECIMAL(10,2)  NOT NULL,
  gst_amount      DECIMAL(10,2)  DEFAULT 0,
  total_amount    DECIMAL(10,2)  NOT NULL,
  validity_date   DATE,
  status          ENUM('draft','sent','accepted','rejected','expired') DEFAULT 'draft',
  payment_link    VARCHAR(500),
  notes           TEXT,
  created_at      TIMESTAMP      DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (requirement_id) REFERENCES custom_requirements(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)        REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 13. COUPONS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coupons (
  id              INT UNSIGNED   AUTO_INCREMENT PRIMARY KEY,
  code            VARCHAR(30)    NOT NULL UNIQUE,
  type            ENUM('flat','percent') DEFAULT 'flat',
  value           DECIMAL(10,2)  NOT NULL,
  min_order_value DECIMAL(10,2)  DEFAULT 0,
  max_discount    DECIMAL(10,2),
  usage_limit     INT            DEFAULT 1,
  used_count      INT            DEFAULT 0,
  valid_from      DATE,
  valid_to        DATE,
  is_active       TINYINT(1)     DEFAULT 1,
  created_at      TIMESTAMP      DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 14. BANNERS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS banners (
  id          INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  title       VARCHAR(200),
  image_url   VARCHAR(500)  NOT NULL,
  link_type   ENUM('product','category','custom','none') DEFAULT 'none',
  link_value  VARCHAR(200),
  sort_order  INT           DEFAULT 0,
  is_active   TINYINT(1)    DEFAULT 1,
  created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 15. REVIEWS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id          INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  product_id  INT UNSIGNED  NOT NULL,
  user_id     INT UNSIGNED  NOT NULL,
  order_id    INT UNSIGNED  NOT NULL,
  rating      TINYINT       NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
  FOREIGN KEY (order_id)   REFERENCES orders(id)   ON DELETE CASCADE,
  UNIQUE KEY uq_user_order_product (user_id, order_id, product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 16. WISHLIST ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wishlists (
  id          INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED  NOT NULL,
  product_id  INT UNSIGNED  NOT NULL,
  created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  UNIQUE KEY uq_user_product (user_id, product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 17. ADMIN STAFF ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff (
  id            INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  uuid          CHAR(36)      NOT NULL UNIQUE,
  name          VARCHAR(100)  NOT NULL,
  email         VARCHAR(150)  NOT NULL UNIQUE,
  phone         VARCHAR(15),
  password_hash VARCHAR(255)  NOT NULL,
  role          ENUM('super_admin','ops_manager','sales_exec','finance_exec','support_exec') DEFAULT 'support_exec',
  is_active     TINYINT(1)    DEFAULT 1,
  created_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 18. OTP STORE ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS otp_store (
  id          INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  phone       VARCHAR(15)   NOT NULL,
  otp         VARCHAR(10)   NOT NULL,
  expires_at  DATETIME      NOT NULL,
  used        TINYINT(1)    DEFAULT 0,
  created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 19. REFRESH TOKENS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED,
  vendor_id   INT UNSIGNED,
  staff_id    INT UNSIGNED,
  token_hash  VARCHAR(255)  NOT NULL,
  expires_at  DATETIME      NOT NULL,
  created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_token (token_hash(50))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── 20. NOTIFICATIONS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          INT UNSIGNED  AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED,
  vendor_id   INT UNSIGNED,
  type        VARCHAR(50)   NOT NULL,
  title       VARCHAR(200)  NOT NULL,
  body        TEXT,
  data        JSON,
  is_read     TINYINT(1)    DEFAULT 0,
  created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_vendor (vendor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;

-- ── SEED: Default admin ───────────────────────────────────────
-- Password: Admin@123 (change immediately after first login)
INSERT IGNORE INTO staff (uuid, name, email, phone, password_hash, role) VALUES
('00000000-0000-0000-0000-000000000001', 'Super Admin', 'admin@wedquick.in', '9999999999',
 '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LPVImSb7sMm', 'super_admin');

-- ── SEED: Sample categories ───────────────────────────────────
INSERT IGNORE INTO categories (name, slug, emoji, sort_order) VALUES
('Flowers & Garlands', 'flowers-garlands', '🌸', 1),
('Mandap & Decor',     'mandap-decor',     '🏛️', 2),
('Puja Items',         'puja-items',       '🪔', 3),
('Bridal Wear',        'bridal-wear',      '👗', 4),
('Return Gifts',       'return-gifts',     '🎁', 5),
('Photography',        'photography',      '📸', 6),
('Catering',           'catering',         '🍱', 7),
('Rentals',            'rentals',          '🔄', 8);

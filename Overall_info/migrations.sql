-- ============================================================
-- Hyper-Local Sustainability Marketplace
-- PostgreSQL + PostGIS Migrations
-- Run in order: 001 → 006
-- ============================================================

-- ============================================================
-- 001_extensions.sql
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ============================================================
-- 002_users.sql
-- ============================================================

CREATE TYPE user_role AS ENUM ('USER', 'ARTISAN', 'ADMIN');

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          VARCHAR(255)        NOT NULL,
  email         VARCHAR(255)        NOT NULL UNIQUE,
  password_hash TEXT                NOT NULL,
  role          user_role           NOT NULL DEFAULT 'USER',

  -- GeoPoint value object stored as PostGIS geometry
  location      GEOGRAPHY(POINT, 4326),   -- SRID 4326 = WGS84 (lat/lng)

  created_at    TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

-- Index for geo queries (find users near a point)
CREATE INDEX idx_users_location ON users USING GIST(location);
CREATE INDEX idx_users_email    ON users(email);


-- ============================================================
-- 003_artisans.sql
-- ============================================================

CREATE TYPE artisan_status AS ENUM (
  'PENDING_VERIFICATION',
  'VERIFIED',
  'SUSPENDED'
);

CREATE TABLE artisans (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id               UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_name         VARCHAR(255) NOT NULL,
  description           TEXT,
  status                artisan_status NOT NULL DEFAULT 'PENDING_VERIFICATION',
  zero_packaging        BOOLEAN     NOT NULL DEFAULT FALSE,
  sustainability_score  NUMERIC(5,2) NOT NULL DEFAULT 0.00  -- 0.00 - 100.00

    CONSTRAINT sustainability_score_range CHECK (
      sustainability_score >= 0 AND sustainability_score <= 100
    ),

  -- Artisan's base location
  location              GEOGRAPHY(POINT, 4326) NOT NULL,

  -- DeliveryZone value object
  -- Center defaults to artisan location, radius enforced <= 50
  delivery_zone_center  GEOGRAPHY(POINT, 4326),
  delivery_zone_radius_km NUMERIC(5,2) NOT NULL DEFAULT 50.00
    CONSTRAINT max_radius CHECK (delivery_zone_radius_km <= 50),

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_user_artisan UNIQUE(user_id)
);

CREATE INDEX idx_artisans_location      ON artisans USING GIST(location);
CREATE INDEX idx_artisans_user_id       ON artisans(user_id);
CREATE INDEX idx_artisans_status        ON artisans(status);
CREATE INDEX idx_artisans_zero_pkg      ON artisans(zero_packaging);
CREATE INDEX idx_artisans_sustainability ON artisans(sustainability_score);


-- ============================================================
-- 004_products.sql
-- ============================================================

CREATE TABLE products (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  artisan_id   UUID           NOT NULL REFERENCES artisans(id) ON DELETE CASCADE,
  name         VARCHAR(255)   NOT NULL,
  description  TEXT,
  price        NUMERIC(10,2)  NOT NULL
    CONSTRAINT price_positive CHECK (price > 0),
  category     VARCHAR(100),
  image_url    TEXT,
  is_available BOOLEAN        NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_products_artisan_id  ON products(artisan_id);
CREATE INDEX idx_products_category    ON products(category);
CREATE INDEX idx_products_available   ON products(is_available);


-- ============================================================
-- 005_orders.sql
-- ============================================================

CREATE TYPE order_status   AS ENUM (
  'PENDING', 'CONFIRMED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'
);
CREATE TYPE delivery_type  AS ENUM ('BICYCLE_ONLY');

CREATE TABLE orders (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID           NOT NULL REFERENCES users(id),
  artisan_id        UUID           NOT NULL REFERENCES artisans(id),
  status            order_status   NOT NULL DEFAULT 'PENDING',
  delivery_type     delivery_type  NOT NULL DEFAULT 'BICYCLE_ONLY',

  -- Distance enforced <= 50km at application layer AND stored here
  distance_km       NUMERIC(6,2)   NOT NULL
    CONSTRAINT max_distance CHECK (distance_km <= 50),

  -- Carbon saved calculated at order time
  carbon_saved_kg   NUMERIC(8,4)   NOT NULL DEFAULT 0,

  total_amount      NUMERIC(10,2)  NOT NULL,
  delivery_address  TEXT           NOT NULL,

  -- Delivery location as PostGIS point
  delivery_location GEOGRAPHY(POINT, 4326) NOT NULL,

  placed_at         TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  delivered_at      TIMESTAMPTZ,

  created_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TABLE order_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id    UUID          NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id  UUID          NOT NULL REFERENCES products(id),
  quantity    INT           NOT NULL
    CONSTRAINT quantity_positive CHECK (quantity > 0),
  unit_price  NUMERIC(10,2) NOT NULL,
  subtotal    NUMERIC(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED
);

CREATE INDEX idx_orders_user_id    ON orders(user_id);
CREATE INDEX idx_orders_artisan_id ON orders(artisan_id);
CREATE INDEX idx_orders_status     ON orders(status);
CREATE INDEX idx_orders_placed_at  ON orders(placed_at DESC);
CREATE INDEX idx_order_items_order ON order_items(order_id);


-- ============================================================
-- 006_triggers.sql  (auto-update updated_at)
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_artisans_updated_at
  BEFORE UPDATE ON artisans
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================================
-- USEFUL QUERIES (reference)
-- ============================================================

-- Find all verified artisans within 50km of a user point:
--
-- SELECT a.*, ST_Distance(a.location, ST_MakePoint(:lng, :lat)::geography) / 1000 AS distance_km
-- FROM artisans a
-- WHERE a.status = 'VERIFIED'
--   AND a.zero_packaging = TRUE
--   AND ST_DWithin(
--         a.location,
--         ST_MakePoint(:lng, :lat)::geography,
--         50000   -- metres
--       )
-- ORDER BY distance_km ASC;

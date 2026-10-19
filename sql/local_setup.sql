-- LuxeStay / HBMS — LOCAL DEV schema + seed data.
-- Reconstructed from hbms_saas.md (design doc) and the columns/status ids the code actually uses.
-- Lookup ids matter: the code hard-codes them (room_status 1=AVAILABLE, booking_status 2=CONFIRMED, ...).
-- All seeded users share the password:  Password@123

CREATE DATABASE IF NOT EXISTS HBMS CHARACTER SET utf8mb4;
USE HBMS;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS booking_holds, invoices, incidental_charges, guest_identifications, payments, booking_rooms, bookings,
  cancellation_policies, rooms, room_type_amenities, amenities, room_types, users, hotels,
  payment_methods, payment_types, payment_statuses, booking_sources, booking_statuses, id_types,
  room_statuses, user_roles, tenant_statuses;
SET FOREIGN_KEY_CHECKS = 1;

-- ---------- lookups ----------
CREATE TABLE tenant_statuses   (tenant_status_id INT PRIMARY KEY AUTO_INCREMENT, status_name VARCHAR(50) UNIQUE NOT NULL);
CREATE TABLE user_roles        (user_role_id INT PRIMARY KEY AUTO_INCREMENT, role_name VARCHAR(50) UNIQUE NOT NULL);
CREATE TABLE room_statuses     (room_status_id INT PRIMARY KEY AUTO_INCREMENT, status_name VARCHAR(50) UNIQUE NOT NULL);
CREATE TABLE booking_statuses  (booking_status_id INT PRIMARY KEY AUTO_INCREMENT, status_name VARCHAR(50) UNIQUE NOT NULL);
CREATE TABLE booking_sources   (booking_source_id INT PRIMARY KEY AUTO_INCREMENT, source_name VARCHAR(50) UNIQUE NOT NULL);
CREATE TABLE id_types          (id_type_id INT PRIMARY KEY AUTO_INCREMENT, type_name VARCHAR(50) UNIQUE NOT NULL);
CREATE TABLE payment_methods   (payment_method_id INT PRIMARY KEY AUTO_INCREMENT, method_name VARCHAR(50) UNIQUE NOT NULL);
CREATE TABLE payment_types     (payment_type_id INT PRIMARY KEY AUTO_INCREMENT, type_name VARCHAR(50) UNIQUE NOT NULL);
CREATE TABLE payment_statuses  (payment_status_id INT PRIMARY KEY AUTO_INCREMENT, status_name VARCHAR(50) UNIQUE NOT NULL);

INSERT INTO tenant_statuses (status_name) VALUES ('ACTIVE'),('SUSPENDED'),('PENDING');
INSERT INTO user_roles (role_name) VALUES ('SUPER_ADMIN'),('ADMIN'),('FRONT_DESK'),('GUEST');       -- 3=FRONT_DESK, 4=GUEST are hard-coded in code
INSERT INTO room_statuses (status_name) VALUES ('AVAILABLE'),('OCCUPIED'),('DIRTY'),('MAINTENANCE'); -- 1=AVAILABLE is hard-coded
INSERT INTO booking_statuses (status_name) VALUES ('PENDING'),('CONFIRMED'),('CHECKED_IN'),('CHECKED_OUT'),('CANCELLED');
INSERT INTO booking_sources (source_name) VALUES ('ONLINE'),('WALK_IN'),('PHONE');
INSERT INTO id_types (type_name) VALUES ('PASSPORT'),('DRIVING_LICENSE'),('AADHAR'),('OTHER');
INSERT INTO payment_methods (method_name) VALUES ('CASH'),('CARD'),('UPI'),('NETBANKING'),('WALLET'); -- payment page maps card=2, upi=3
INSERT INTO payment_types (type_name) VALUES ('ONLINE'),('OFFLINE');
INSERT INTO payment_statuses (status_name) VALUES ('PENDING'),('SUCCESS'),('FAILED'),('REFUNDED'),('BYPASSED');

-- ---------- core ----------
CREATE TABLE hotels (
  hotel_id INT PRIMARY KEY AUTO_INCREMENT,
  tenant_status_id INT NOT NULL DEFAULT 1,
  name VARCHAR(150) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  address TEXT, city VARCHAR(100), state VARCHAR(100), country VARCHAR(100),
  phone VARCHAR(20), email VARCHAR(150), logo_url VARCHAR(255), cover_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_status_id) REFERENCES tenant_statuses(tenant_status_id)
);

CREATE TABLE users (
  user_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  hotel_id INT NULL,
  user_role_id INT NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  phone VARCHAR(20),
  dob DATE NULL,
  gender VARCHAR(20) NULL,
  password_hash VARCHAR(255) NOT NULL,
  photo_url VARCHAR(255),
  state VARCHAR(100), city VARCHAR(100), address TEXT,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (hotel_id) REFERENCES hotels(hotel_id),
  FOREIGN KEY (user_role_id) REFERENCES user_roles(user_role_id)
);

CREATE TABLE room_types (
  room_type_id INT PRIMARY KEY AUTO_INCREMENT,
  hotel_id INT NOT NULL,
  type_name VARCHAR(100) NOT NULL,
  photo_url VARCHAR(255),
  description TEXT,
  base_price DECIMAL(10,2) NOT NULL,
  max_adults INT NOT NULL DEFAULT 2,
  max_children INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (hotel_id) REFERENCES hotels(hotel_id)
);

CREATE TABLE amenities (amenity_id INT PRIMARY KEY AUTO_INCREMENT, amenity_name VARCHAR(100) UNIQUE NOT NULL);
CREATE TABLE room_type_amenities (
  room_type_id INT NOT NULL, amenity_id INT NOT NULL,
  PRIMARY KEY (room_type_id, amenity_id),
  FOREIGN KEY (room_type_id) REFERENCES room_types(room_type_id),
  FOREIGN KEY (amenity_id) REFERENCES amenities(amenity_id)
);

CREATE TABLE rooms (
  room_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  hotel_id INT NOT NULL,
  room_type_id INT NOT NULL,
  room_status_id INT NOT NULL,
  room_number VARCHAR(20) NOT NULL,
  floor INT, photo_url VARCHAR(255), notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_hotel_room (hotel_id, room_number),
  FOREIGN KEY (hotel_id) REFERENCES hotels(hotel_id),
  FOREIGN KEY (room_type_id) REFERENCES room_types(room_type_id),
  FOREIGN KEY (room_status_id) REFERENCES room_statuses(room_status_id)
);

CREATE TABLE bookings (
  booking_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  hotel_id INT NOT NULL,
  user_id BIGINT NOT NULL,
  booking_status_id INT NOT NULL,
  booking_source_id INT NOT NULL,
  booking_reference VARCHAR(20) UNIQUE NOT NULL,
  checkin_date DATE NOT NULL,
  checkout_date DATE NOT NULL,
  adults INT NOT NULL DEFAULT 1,
  children INT NOT NULL DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  special_requests TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (hotel_id) REFERENCES hotels(hotel_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (booking_status_id) REFERENCES booking_statuses(booking_status_id),
  FOREIGN KEY (booking_source_id) REFERENCES booking_sources(booking_source_id)
);
CREATE INDEX idx_bookings_hotel_checkin ON bookings (hotel_id, checkin_date);

CREATE TABLE booking_rooms (
  booking_room_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  booking_id BIGINT NOT NULL,
  room_id BIGINT NOT NULL,
  rate_per_night DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (booking_id) REFERENCES bookings(booking_id),
  FOREIGN KEY (room_id) REFERENCES rooms(room_id)
);

CREATE TABLE guest_identifications (
  guest_id_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  booking_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  verified_by BIGINT NULL,
  id_type_id INT NOT NULL,
  id_number VARCHAR(100),
  document_url VARCHAR(255),
  verification_status VARCHAR(20),
  remarks TEXT,
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (booking_id) REFERENCES bookings(booking_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (id_type_id) REFERENCES id_types(id_type_id)
);

CREATE TABLE cancellation_policies (
  policy_id INT PRIMARY KEY AUTO_INCREMENT,
  hotel_id INT NOT NULL,
  room_type_id INT NOT NULL,
  free_cancellation_hours INT NOT NULL DEFAULT 24,
  refund_percentage DECIMAL(5,2) NOT NULL DEFAULT 100.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_hotel_roomtype_policy (hotel_id, room_type_id),
  FOREIGN KEY (hotel_id) REFERENCES hotels(hotel_id),
  FOREIGN KEY (room_type_id) REFERENCES room_types(room_type_id)
);

CREATE TABLE payments (
  payment_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  hotel_id INT NOT NULL,
  booking_id BIGINT NOT NULL,
  payment_method_id INT NOT NULL,
  payment_type_id INT NULL,                 -- code never sets it
  payment_status_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  is_bypassed TINYINT(1) NOT NULL DEFAULT 0, -- used by invoice.model.ts
  razorpay_order_id VARCHAR(100), razorpay_payment_id VARCHAR(100), razorpay_signature VARCHAR(255),
  paid_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (hotel_id) REFERENCES hotels(hotel_id),
  FOREIGN KEY (booking_id) REFERENCES bookings(booking_id),
  FOREIGN KEY (payment_method_id) REFERENCES payment_methods(payment_method_id),
  FOREIGN KEY (payment_type_id) REFERENCES payment_types(payment_type_id),
  FOREIGN KEY (payment_status_id) REFERENCES payment_statuses(payment_status_id)
);

-- legacy DB-side holds: room search/details queries read this table to hide held rooms
CREATE TABLE booking_holds (
  hold_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  hotel_id INT NULL,
  room_id BIGINT NOT NULL,
  user_id BIGINT NOT NULL,
  adults INT NOT NULL DEFAULT 1,
  children INT NOT NULL DEFAULT 0,
  checkin_date DATE NOT NULL,
  checkout_date DATE NOT NULL,
  expires_at DATETIME NOT NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES rooms(room_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE incidental_charges (
  incidental_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  hotel_id INT NOT NULL,
  booking_id BIGINT NOT NULL,
  added_by BIGINT NOT NULL,
  description VARCHAR(255) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (hotel_id) REFERENCES hotels(hotel_id),
  FOREIGN KEY (booking_id) REFERENCES bookings(booking_id),
  FOREIGN KEY (added_by) REFERENCES users(user_id)
);

CREATE TABLE invoices (
  invoice_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  hotel_id INT NOT NULL,
  booking_id BIGINT NOT NULL,
  room_charges DECIMAL(10,2) NOT NULL,
  incidentals DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_booking_invoice (booking_id),
  FOREIGN KEY (hotel_id) REFERENCES hotels(hotel_id),
  FOREIGN KEY (booking_id) REFERENCES bookings(booking_id)
);

-- ---------- demo seed data ----------
INSERT INTO amenities (amenity_name) VALUES ('WiFi'),('AC'),('Pool'),('Gym'),('Breakfast'),('Parking');

INSERT INTO hotels (name, slug, address, city, state, country, phone, email) VALUES
 ('Grand Palace',   'grand-palace',   '1 Ring Road',  'Ahmedabad', 'Gujarat',     'India', '9000000001', 'palace@example.com'),
 ('Sea View Resort','sea-view-resort','22 Marine Dr', 'Mumbai',    'Maharashtra', 'India', '9000000002', 'sea@example.com');

-- hash = bcrypt("Password@123")
SET @pw = '$2b$10$xdc31KuRLpjBl/Qk.1bIjOm/B0XJF8mPciAft.6fssVZ5CmD/MIJG';
INSERT INTO users (hotel_id, user_role_id, first_name, last_name, email, phone, dob, gender, password_hash, state, city, address) VALUES
 (NULL, 1, 'Super', 'Admin',  'superadmin@hbms.local', '9100000000', '1990-01-01', 'Male',   @pw, 'Gujarat', 'Ahmedabad', 'HQ'),
 (1,    2, 'Hotel', 'Admin',  'admin@hbms.local',      '9100000001', '1990-01-01', 'Male',   @pw, 'Gujarat', 'Ahmedabad', 'Grand Palace'),
 (1,    3, 'Front', 'Desk',   'frontdesk@hbms.local',  '9100000002', '1995-05-05', 'Female', @pw, 'Gujarat', 'Ahmedabad', 'Grand Palace'),
 (NULL, 4, 'Guest', 'User',   'guest@hbms.local',      '9100000003', '1998-08-08', 'Male',   @pw, 'Gujarat', 'Ahmedabad', 'Somewhere');

INSERT INTO room_types (hotel_id, type_name, description, base_price, max_adults, max_children) VALUES
 (1, 'Standard', 'Comfortable standard room', 2500, 2, 1),
 (1, 'Deluxe',   'Spacious deluxe room',      4500, 3, 2),
 (2, 'Suite',    'Ocean view suite',          9000, 4, 2);
INSERT INTO room_type_amenities VALUES (1,1),(1,2),(2,1),(2,2),(2,5),(3,1),(3,2),(3,3),(3,4);

INSERT INTO rooms (hotel_id, room_type_id, room_status_id, room_number, floor) VALUES
 (1,1,1,'101',1),(1,1,1,'102',1),(1,1,1,'103',1),(1,2,1,'201',2),(1,2,1,'202',2),
 (2,3,1,'301',3),(2,3,1,'302',3);

INSERT INTO cancellation_policies (hotel_id, room_type_id, free_cancellation_hours, refund_percentage) VALUES (1,1,24,100),(1,2,48,80);

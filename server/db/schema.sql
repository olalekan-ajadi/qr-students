-- E-Students QR System schema (PostgreSQL)
CREATE TABLE IF NOT EXISTS admins (
  admin_id      SERIAL PRIMARY KEY,
  full_name     VARCHAR(100) NOT NULL,
  email         VARCHAR(120) UNIQUE NOT NULL,
  password_hash VARCHAR(200) NOT NULL,
  created_at    TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS students (
  student_id      SERIAL PRIMARY KEY,
  matric_no       VARCHAR(30) UNIQUE NOT NULL,
  full_name       VARCHAR(100) NOT NULL,
  faculty         VARCHAR(100),
  department      VARCHAR(80)  NOT NULL,
  level           VARCHAR(10)  NOT NULL,
  dob             DATE,
  sex             VARCHAR(10),
  state_of_origin VARCHAR(60),
  phone           VARCHAR(20),
  address         TEXT,
  email           VARCHAR(120) UNIQUE NOT NULL,
  password_hash   VARCHAR(200) NOT NULL,
  photo           TEXT,
  qr_payload      TEXT,
  qr_valid        BOOLEAN DEFAULT FALSE,
  status          VARCHAR(15) DEFAULT 'pending',
  created_at      TIMESTAMP DEFAULT NOW()
);

-- Migration: add new columns to existing installs (safe to re-run)
ALTER TABLE students ADD COLUMN IF NOT EXISTS faculty         VARCHAR(100);
ALTER TABLE students ADD COLUMN IF NOT EXISTS dob             DATE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS sex             VARCHAR(10);
ALTER TABLE students ADD COLUMN IF NOT EXISTS state_of_origin VARCHAR(60);
ALTER TABLE students ADD COLUMN IF NOT EXISTS phone           VARCHAR(20);
ALTER TABLE students ADD COLUMN IF NOT EXISTS address         TEXT;

CREATE TABLE IF NOT EXISTS scan_logs (
  log_id     SERIAL PRIMARY KEY,
  student_id INTEGER REFERENCES students(student_id) ON DELETE SET NULL,
  scanned_by VARCHAR(120),
  result     VARCHAR(20) NOT NULL,
  scanned_at TIMESTAMP DEFAULT NOW()
);

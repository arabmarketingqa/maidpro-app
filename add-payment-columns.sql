-- Migration: Add payment tracking columns to bookings table
-- Run this in the Supabase SQL Editor

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS payment_method TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS paid_amount    NUMERIC(10,2) DEFAULT 0;

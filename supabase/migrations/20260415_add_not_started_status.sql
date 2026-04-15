-- Add "not_started" to attendance_status enum for shifts that haven't begun yet
ALTER TYPE attendance_status ADD VALUE IF NOT EXISTS 'not_started';

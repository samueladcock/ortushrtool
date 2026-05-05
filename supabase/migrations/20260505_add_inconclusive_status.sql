-- Add "inconclusive" to attendance_status for rows where pre-shift activity
-- bleeds into the workday and DeskTime can't tell us the real clock-in.
ALTER TYPE attendance_status ADD VALUE IF NOT EXISTS 'inconclusive';

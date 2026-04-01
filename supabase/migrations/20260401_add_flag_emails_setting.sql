INSERT INTO system_settings (key, value)
VALUES ('attendance_flag_emails_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

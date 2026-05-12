-- Optional URL HR adds when marking a document request as processed
-- (e.g. Google Drive, Dropbox, or any other shareable link).
ALTER TABLE public.document_requests
  ADD COLUMN IF NOT EXISTS processor_attachment_url TEXT;

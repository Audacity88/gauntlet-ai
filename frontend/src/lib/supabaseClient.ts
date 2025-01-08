import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://gkwdjhgfeqzpypucnnnx.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdrd2RqaGdmZXF6cHlwdWNubm54Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYyMTkyODIsImV4cCI6MjA1MTc5NTI4Mn0.N65guuLbrCFbqtEMtpR3wPkTsL0KIn2ZKOt2PxK77Ig'
) 
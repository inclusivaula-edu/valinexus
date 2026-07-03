-- Impede certidões duplicadas (mesmo nome + categoria) dentro da mesma empresa
CREATE UNIQUE INDEX IF NOT EXISTS idx_certifications_company_name_category
  ON certifications (company_id, LOWER(TRIM(name)), category);

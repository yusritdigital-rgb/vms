-- =====================================================
-- VMS — 018_fix_workshop_case_counts_view.sql
-- ----------------------------------------------------------
-- Fixes the workshop case-count view.
--
-- Two real bugs in the original (007):
--   1. Status filter used English values ('received'/'under_repair'/...);
--      the live data is Arabic so every count was 0.
--   2. The join used job_cards.workshop_id = workshops.id, but
--      job_cards.workshop_id is the slug from the hardcoded WORKSHOPS
--      constant ("الاوائل__الرياض") while workshops.id is a UUID.
--      They can NEVER match — so total/open/closed always stayed 0.
--
-- Fix: join on the name+city snapshot pair that the Create Case form
-- writes (job_cards.workshop_name = workshops.workshop_name_ar AND
-- job_cards.workshop_city = workshops.city_ar). Both sides are seeded
-- from the same source, so this match is reliable.
--
-- Open/closed sets follow the canonical Arabic CLOSED_STATUSES list.
-- =====================================================

CREATE OR REPLACE VIEW v_workshop_case_counts AS
SELECT
  w.id AS workshop_id,
  w.workshop_name_ar,
  w.workshop_name_en,
  w.city_ar,
  w.coverage_type,
  w.is_agency,
  w.latitude,
  w.longitude,
  w.active_status,
  COALESCE(c.total_cases,  0)::INT AS total_cases,
  COALESCE(c.open_cases,   0)::INT AS open_cases,
  COALESCE(c.closed_cases, 0)::INT AS closed_cases
FROM workshops w
LEFT JOIN (
  SELECT
    workshop_name,
    workshop_city,
    COUNT(*) AS total_cases,
    COUNT(*) FILTER (
      WHERE status NOT IN ('تم التسليم للعميل', 'تم البيع', 'خسارة كلية')
    ) AS open_cases,
    COUNT(*) FILTER (
      WHERE status IN ('تم التسليم للعميل', 'تم البيع', 'خسارة كلية')
    ) AS closed_cases
  FROM job_cards
  WHERE workshop_name IS NOT NULL
  GROUP BY workshop_name, workshop_city
) c
  ON  c.workshop_name = w.workshop_name_ar
  AND COALESCE(c.workshop_city, '') = COALESCE(w.city_ar, '');

GRANT SELECT ON v_workshop_case_counts TO authenticated;
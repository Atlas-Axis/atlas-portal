-- Unified change events for notion_database_pages
-- Returns new/changed/deleted events with both old_row and new_row when relevant
-- Usage: SELECT * FROM public_get_atlas_page_changes(100);

CREATE OR REPLACE FUNCTION public_get_atlas_page_changes(p_limit int DEFAULT 100)
RETURNS TABLE (
	notion_page_id uuid,
	event_time timestamptz,
	event_type text,
	old_row jsonb,
	new_row jsonb
) LANGUAGE sql STABLE AS $$
WITH versions AS (
	SELECT
		ndp.*,
		row_to_json(ndp) AS row_json,
		LAG(row_to_json(ndp)) OVER (PARTITION BY ndp.notion_page_id ORDER BY ndp.date_valid_from) AS prev_row_json,
		LEAD(row_to_json(ndp)) OVER (PARTITION BY ndp.notion_page_id ORDER BY ndp.date_valid_from) AS next_row_json,
		ROW_NUMBER() OVER (PARTITION BY ndp.notion_page_id ORDER BY ndp.date_valid_from) AS seq_num
	FROM notion_database_pages ndp
),
events AS (
	-- new: first version
	SELECT
		notion_page_id,
		(row_json->>'date_valid_from')::timestamptz AS event_time,
		'new'::text AS event_type,
		NULL::jsonb AS old_row,
		row_json::jsonb AS new_row
	FROM versions
	WHERE seq_num = 1

	UNION ALL

	-- changed: subsequent versions (pair prev -> current)
	SELECT
		notion_page_id,
		(row_json->>'date_valid_from')::timestamptz AS event_time,
		'changed'::text AS event_type,
		prev_row_json::jsonb AS old_row,
		row_json::jsonb AS new_row
	FROM versions
	WHERE seq_num > 1

	UNION ALL

	-- deleted: last version ended (no current row)
	SELECT
		notion_page_id,
		(row_json->>'date_valid_to')::timestamptz AS event_time,
		'deleted'::text AS event_type,
		row_json::jsonb AS old_row,
		NULL::jsonb AS new_row
	FROM versions
	WHERE next_row_json IS NULL
		AND (row_json->>'date_valid_to') IS NOT NULL
)
SELECT *
FROM events
ORDER BY event_time DESC
LIMIT p_limit;
$$;



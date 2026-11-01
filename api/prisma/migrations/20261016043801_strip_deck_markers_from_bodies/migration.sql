-- The rename migration moved the relation to `Deck` but left the marker text in the
-- bodies written before it (`#home buy coffee`): back then the `#...` in the content was
-- the only source of the relation. This migration takes the marker out of the bodies it
-- belongs to.
--
-- Four passes, applied innermost first. Each one matches only marker names the dump is
-- actually linked to, and only when the name is not a prefix of a longer one — so a body
-- saying `#home-office #home` loses both, and one saying `#home` while linked to
-- `home-office` loses nothing:
--
--   (1) a marker alone on its line takes the whole line with it
--   (2) a marker opening a line keeps the line, drops the trailing space
--   (3) a marker inside a line drops the space that carried it
--   (4) a marker glued to a word (`door#home`), the old parser matched it too
--
-- A `#word` whose deck was deleted stays exactly as written: it is literal text now, and
-- there is no name left to match it against. A body that was nothing but markers ends up
-- empty and keeps its decks; the API stops you from creating one like that today.

WITH deck_names AS (
  SELECT link."B" AS dump_id,
         string_agg(deck.name, '|' ORDER BY length(deck.name) DESC, deck.name) AS pattern
  FROM "_DeckToDump" link
  JOIN "Deck" deck ON deck.id = link."A"
  GROUP BY link."B"
)
UPDATE "Dump" AS dump
SET content = btrim(
  regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          dump.content,
          '(^|\n)[ \t]*#(' || deck_names.pattern || ')(?![[:alnum:]_-]|[^[:ascii:]])[ \t]*(\n|$)',
          '\1', 'gi'
        ),
        '(^|\n)[ \t]*#(' || deck_names.pattern || ')(?![[:alnum:]_-]|[^[:ascii:]])[ \t]?',
        '\1', 'gi'
      ),
      '[ \t]#(' || deck_names.pattern || ')(?![[:alnum:]_-]|[^[:ascii:]])[ \t]?',
      '', 'gi'
    ),
    '#(' || deck_names.pattern || ')(?![[:alnum:]_-]|[^[:ascii:]])',
    '', 'gi'
  )
)
FROM deck_names
WHERE deck_names.dump_id = dump.id
  AND dump.content ~* ('#(' || deck_names.pattern || ')(?![[:alnum:]_-]|[^[:ascii:]])');

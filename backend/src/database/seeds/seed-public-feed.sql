-- ============================================================================
-- SkillStreak: Seeding av de 10 forsta AI-mikroutmaningarna i publika feeden
-- Genererad: 2026-11-10 av IT-avdelningen
-- Deterministisk och idempotent (kan koras upprepade ganger utan fel)
-- ============================================================================
BEGIN;

DO $$
DECLARE
    v_team_id UUID := 'cd0ce417-300b-417a-aea4-8bfe1b4a58f4'::uuid;
    v_player_id UUID;
    v_clip_id UUID;
BEGIN
    RAISE NOTICE '--- Startar seedning av 10 AI-mikroutmaningar i publika feeden ---';

    -- 1. Sakra content-team (Ackers Test / PUBLIC_SHARING_ENABLED_TEAM_IDS)
    IF NOT EXISTS (SELECT 1 FROM team WHERE id = v_team_id) THEN
        INSERT INTO team (id, name, invite_code, jurisdiction, created_at)
        VALUES (v_team_id, 'Ackers Test', 'ACKERS-CONTENT', 'SE', now());
        RAISE NOTICE 'Skapade team: Ackers Test (ID: %)', v_team_id;
    ELSE
        UPDATE team SET jurisdiction = 'SE' WHERE id = v_team_id;
        RAISE NOTICE 'Team Ackers Test fanns redan (ID: %)', v_team_id;
    END IF;

    -- [1/10] innebandy_zorro_kontroll_v1 (CoachHare)
    SELECT id INTO v_player_id FROM player WHERE team_id = v_team_id AND screen_name = 'CoachHare';
    IF v_player_id IS NULL THEN
        INSERT INTO player (
            id, team_id, jurisdiction, screen_name, avatar_id, birth_year,
            parental_consent_status, team_join_status, is_captain, locale,
            current_streak_count, longest_streak_count, banked_streak_saver_count, created_at
        ) VALUES (
            gen_random_uuid(), v_team_id, 'SE', 'CoachHare', 'hare', 2013,
            'approved', 'approved', false, 'sv',
            0, 0, 0, now()
        ) RETURNING id INTO v_player_id;
        RAISE NOTICE 'Skapade bot-spelare: CoachHare (ID: %)', v_player_id;
    ELSE
        UPDATE player
        SET parental_consent_status = 'approved', team_join_status = 'approved', avatar_id = 'hare'
        WHERE id = v_player_id;
    END IF;

    -- Public sharing consent
    IF NOT EXISTS (SELECT 1 FROM public_sharing_consent WHERE player_id = v_player_id) THEN
        INSERT INTO public_sharing_consent (id, player_id, status, created_at)
        VALUES (gen_random_uuid(), v_player_id, 'active', now());
    ELSE
        UPDATE public_sharing_consent SET status = 'active' WHERE player_id = v_player_id;
    END IF;

    -- VideoClip
    SELECT id INTO v_clip_id FROM video_clip WHERE storage_key = 'clips/cd0ce417-300b-417a-aea4-8bfe1b4a58f4/innebandy_zorro_kontroll_v1.published-seed.mp4';
    IF v_clip_id IS NULL THEN
        INSERT INTO video_clip (
            id, team_id, uploader_player_id, storage_key, mime_type, file_size_bytes,
            duration_seconds, caption, status, tagging_status, tagging_attempts,
            published_publicly_at, public_review_status, public_reviewed_at, created_at
        ) VALUES (
            gen_random_uuid(), v_team_id, v_player_id, 'clips/cd0ce417-300b-417a-aea4-8bfe1b4a58f4/innebandy_zorro_kontroll_v1.published-seed.mp4', 'video/mp4', 5242880,
            22, 'Innebandy: Zorro-kontroll och bollkänsla', 'published', 'tagged', 1,
            '2026-11-10 10:00:00+00'::timestamptz - interval '0 minutes', 'approved', '2026-11-10 10:00:00+00'::timestamptz, now()
        ) RETURNING id INTO v_clip_id;
        RAISE NOTICE 'Skapade video_clip for innebandy_zorro_kontroll_v1 (ID: %)', v_clip_id;
    ELSE
        UPDATE video_clip
        SET status = 'published', public_review_status = 'approved',
            duration_seconds = 22, caption = 'Innebandy: Zorro-kontroll och bollkänsla',
            published_publicly_at = '2026-11-10 10:00:00+00'::timestamptz - interval '0 minutes',
            public_reviewed_at = '2026-11-10 10:00:00+00'::timestamptz
        WHERE id = v_clip_id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM video_clip_tag WHERE clip_id = v_clip_id AND tag = 'stickhandling') THEN
        INSERT INTO video_clip_tag (id, clip_id, tag, confidence, source, created_at)
        VALUES (gen_random_uuid(), v_clip_id, 'stickhandling', 1.000, 'ai_seed_v1', now());
    END IF;

    -- [2/10] fotboll_sulduttar_snabbhet_v1 (CheetahLeo)
    SELECT id INTO v_player_id FROM player WHERE team_id = v_team_id AND screen_name = 'CheetahLeo';
    IF v_player_id IS NULL THEN
        INSERT INTO player (
            id, team_id, jurisdiction, screen_name, avatar_id, birth_year,
            parental_consent_status, team_join_status, is_captain, locale,
            current_streak_count, longest_streak_count, banked_streak_saver_count, created_at
        ) VALUES (
            gen_random_uuid(), v_team_id, 'SE', 'CheetahLeo', 'cheetah', 2015,
            'approved', 'approved', false, 'sv',
            0, 0, 0, now()
        ) RETURNING id INTO v_player_id;
        RAISE NOTICE 'Skapade bot-spelare: CheetahLeo (ID: %)', v_player_id;
    ELSE
        UPDATE player
        SET parental_consent_status = 'approved', team_join_status = 'approved', avatar_id = 'cheetah'
        WHERE id = v_player_id;
    END IF;

    -- Public sharing consent
    IF NOT EXISTS (SELECT 1 FROM public_sharing_consent WHERE player_id = v_player_id) THEN
        INSERT INTO public_sharing_consent (id, player_id, status, created_at)
        VALUES (gen_random_uuid(), v_player_id, 'active', now());
    ELSE
        UPDATE public_sharing_consent SET status = 'active' WHERE player_id = v_player_id;
    END IF;

    -- VideoClip
    SELECT id INTO v_clip_id FROM video_clip WHERE storage_key = 'clips/cd0ce417-300b-417a-aea4-8bfe1b4a58f4/fotboll_sulduttar_snabbhet_v1.published-seed.mp4';
    IF v_clip_id IS NULL THEN
        INSERT INTO video_clip (
            id, team_id, uploader_player_id, storage_key, mime_type, file_size_bytes,
            duration_seconds, caption, status, tagging_status, tagging_attempts,
            published_publicly_at, public_review_status, public_reviewed_at, created_at
        ) VALUES (
            gen_random_uuid(), v_team_id, v_player_id, 'clips/cd0ce417-300b-417a-aea4-8bfe1b4a58f4/fotboll_sulduttar_snabbhet_v1.published-seed.mp4', 'video/mp4', 5242880,
            20, 'Fotboll: Sul-duttar och snabba fötter', 'published', 'tagged', 1,
            '2026-11-10 10:00:00+00'::timestamptz - interval '1 minutes', 'approved', '2026-11-10 10:00:00+00'::timestamptz, now()
        ) RETURNING id INTO v_clip_id;
        RAISE NOTICE 'Skapade video_clip for fotboll_sulduttar_snabbhet_v1 (ID: %)', v_clip_id;
    ELSE
        UPDATE video_clip
        SET status = 'published', public_review_status = 'approved',
            duration_seconds = 20, caption = 'Fotboll: Sul-duttar och snabba fötter',
            published_publicly_at = '2026-11-10 10:00:00+00'::timestamptz - interval '1 minutes',
            public_reviewed_at = '2026-11-10 10:00:00+00'::timestamptz
        WHERE id = v_clip_id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM video_clip_tag WHERE clip_id = v_clip_id AND tag = 'stickhandling') THEN
        INSERT INTO video_clip_tag (id, clip_id, tag, confidence, source, created_at)
        VALUES (gen_random_uuid(), v_clip_id, 'stickhandling', 1.000, 'ai_seed_v1', now());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM video_clip_tag WHERE clip_id = v_clip_id AND tag = 'fitness_conditioning') THEN
        INSERT INTO video_clip_tag (id, clip_id, tag, confidence, source, created_at)
        VALUES (gen_random_uuid(), v_clip_id, 'fitness_conditioning', 1.000, 'ai_seed_v1', now());
    END IF;

    -- [3/10] fys_sidoplanka_core_v1 (BearBjorn)
    SELECT id INTO v_player_id FROM player WHERE team_id = v_team_id AND screen_name = 'BearBjorn';
    IF v_player_id IS NULL THEN
        INSERT INTO player (
            id, team_id, jurisdiction, screen_name, avatar_id, birth_year,
            parental_consent_status, team_join_status, is_captain, locale,
            current_streak_count, longest_streak_count, banked_streak_saver_count, created_at
        ) VALUES (
            gen_random_uuid(), v_team_id, 'SE', 'BearBjorn', 'bear', 2013,
            'approved', 'approved', false, 'sv',
            0, 0, 0, now()
        ) RETURNING id INTO v_player_id;
        RAISE NOTICE 'Skapade bot-spelare: BearBjorn (ID: %)', v_player_id;
    ELSE
        UPDATE player
        SET parental_consent_status = 'approved', team_join_status = 'approved', avatar_id = 'bear'
        WHERE id = v_player_id;
    END IF;

    -- Public sharing consent
    IF NOT EXISTS (SELECT 1 FROM public_sharing_consent WHERE player_id = v_player_id) THEN
        INSERT INTO public_sharing_consent (id, player_id, status, created_at)
        VALUES (gen_random_uuid(), v_player_id, 'active', now());
    ELSE
        UPDATE public_sharing_consent SET status = 'active' WHERE player_id = v_player_id;
    END IF;

    -- VideoClip
    SELECT id INTO v_clip_id FROM video_clip WHERE storage_key = 'clips/cd0ce417-300b-417a-aea4-8bfe1b4a58f4/fys_sidoplanka_core_v1.published-seed.mp4';
    IF v_clip_id IS NULL THEN
        INSERT INTO video_clip (
            id, team_id, uploader_player_id, storage_key, mime_type, file_size_bytes,
            duration_seconds, caption, status, tagging_status, tagging_attempts,
            published_publicly_at, public_review_status, public_reviewed_at, created_at
        ) VALUES (
            gen_random_uuid(), v_team_id, v_player_id, 'clips/cd0ce417-300b-417a-aea4-8bfe1b4a58f4/fys_sidoplanka_core_v1.published-seed.mp4', 'video/mp4', 5242880,
            24, 'Fys/Core: Sidoplanka och bålstabilitet', 'published', 'tagged', 1,
            '2026-11-10 10:00:00+00'::timestamptz - interval '2 minutes', 'approved', '2026-11-10 10:00:00+00'::timestamptz, now()
        ) RETURNING id INTO v_clip_id;
        RAISE NOTICE 'Skapade video_clip for fys_sidoplanka_core_v1 (ID: %)', v_clip_id;
    ELSE
        UPDATE video_clip
        SET status = 'published', public_review_status = 'approved',
            duration_seconds = 24, caption = 'Fys/Core: Sidoplanka och bålstabilitet',
            published_publicly_at = '2026-11-10 10:00:00+00'::timestamptz - interval '2 minutes',
            public_reviewed_at = '2026-11-10 10:00:00+00'::timestamptz
        WHERE id = v_clip_id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM video_clip_tag WHERE clip_id = v_clip_id AND tag = 'fitness_conditioning') THEN
        INSERT INTO video_clip_tag (id, clip_id, tag, confidence, source, created_at)
        VALUES (gen_random_uuid(), v_clip_id, 'fitness_conditioning', 1.000, 'ai_seed_v1', now());
    END IF;

    -- [4/10] basket_crossover_koordination_v1 (TigerTim)
    SELECT id INTO v_player_id FROM player WHERE team_id = v_team_id AND screen_name = 'TigerTim';
    IF v_player_id IS NULL THEN
        INSERT INTO player (
            id, team_id, jurisdiction, screen_name, avatar_id, birth_year,
            parental_consent_status, team_join_status, is_captain, locale,
            current_streak_count, longest_streak_count, banked_streak_saver_count, created_at
        ) VALUES (
            gen_random_uuid(), v_team_id, 'SE', 'TigerTim', 'tiger', 2013,
            'approved', 'approved', false, 'sv',
            0, 0, 0, now()
        ) RETURNING id INTO v_player_id;
        RAISE NOTICE 'Skapade bot-spelare: TigerTim (ID: %)', v_player_id;
    ELSE
        UPDATE player
        SET parental_consent_status = 'approved', team_join_status = 'approved', avatar_id = 'tiger'
        WHERE id = v_player_id;
    END IF;

    -- Public sharing consent
    IF NOT EXISTS (SELECT 1 FROM public_sharing_consent WHERE player_id = v_player_id) THEN
        INSERT INTO public_sharing_consent (id, player_id, status, created_at)
        VALUES (gen_random_uuid(), v_player_id, 'active', now());
    ELSE
        UPDATE public_sharing_consent SET status = 'active' WHERE player_id = v_player_id;
    END IF;

    -- VideoClip
    SELECT id INTO v_clip_id FROM video_clip WHERE storage_key = 'clips/cd0ce417-300b-417a-aea4-8bfe1b4a58f4/basket_crossover_koordination_v1.published-seed.mp4';
    IF v_clip_id IS NULL THEN
        INSERT INTO video_clip (
            id, team_id, uploader_player_id, storage_key, mime_type, file_size_bytes,
            duration_seconds, caption, status, tagging_status, tagging_attempts,
            published_publicly_at, public_review_status, public_reviewed_at, created_at
        ) VALUES (
            gen_random_uuid(), v_team_id, v_player_id, 'clips/cd0ce417-300b-417a-aea4-8bfe1b4a58f4/basket_crossover_koordination_v1.published-seed.mp4', 'video/mp4', 5242880,
            22, 'Basket: Crossover och koordination', 'published', 'tagged', 1,
            '2026-11-10 10:00:00+00'::timestamptz - interval '3 minutes', 'approved', '2026-11-10 10:00:00+00'::timestamptz, now()
        ) RETURNING id INTO v_clip_id;
        RAISE NOTICE 'Skapade video_clip for basket_crossover_koordination_v1 (ID: %)', v_clip_id;
    ELSE
        UPDATE video_clip
        SET status = 'published', public_review_status = 'approved',
            duration_seconds = 22, caption = 'Basket: Crossover och koordination',
            published_publicly_at = '2026-11-10 10:00:00+00'::timestamptz - interval '3 minutes',
            public_reviewed_at = '2026-11-10 10:00:00+00'::timestamptz
        WHERE id = v_clip_id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM video_clip_tag WHERE clip_id = v_clip_id AND tag = 'stickhandling') THEN
        INSERT INTO video_clip_tag (id, clip_id, tag, confidence, source, created_at)
        VALUES (gen_random_uuid(), v_clip_id, 'stickhandling', 1.000, 'ai_seed_v1', now());
    END IF;

    -- [5/10] agility_reflex_vandningsbana_v1 (LynxLova)
    SELECT id INTO v_player_id FROM player WHERE team_id = v_team_id AND screen_name = 'LynxLova';
    IF v_player_id IS NULL THEN
        INSERT INTO player (
            id, team_id, jurisdiction, screen_name, avatar_id, birth_year,
            parental_consent_status, team_join_status, is_captain, locale,
            current_streak_count, longest_streak_count, banked_streak_saver_count, created_at
        ) VALUES (
            gen_random_uuid(), v_team_id, 'SE', 'LynxLova', 'lynx', 2013,
            'approved', 'approved', false, 'sv',
            0, 0, 0, now()
        ) RETURNING id INTO v_player_id;
        RAISE NOTICE 'Skapade bot-spelare: LynxLova (ID: %)', v_player_id;
    ELSE
        UPDATE player
        SET parental_consent_status = 'approved', team_join_status = 'approved', avatar_id = 'lynx'
        WHERE id = v_player_id;
    END IF;

    -- Public sharing consent
    IF NOT EXISTS (SELECT 1 FROM public_sharing_consent WHERE player_id = v_player_id) THEN
        INSERT INTO public_sharing_consent (id, player_id, status, created_at)
        VALUES (gen_random_uuid(), v_player_id, 'active', now());
    ELSE
        UPDATE public_sharing_consent SET status = 'active' WHERE player_id = v_player_id;
    END IF;

    -- VideoClip
    SELECT id INTO v_clip_id FROM video_clip WHERE storage_key = 'clips/cd0ce417-300b-417a-aea4-8bfe1b4a58f4/agility_reflex_vandningsbana_v1.published-seed.mp4';
    IF v_clip_id IS NULL THEN
        INSERT INTO video_clip (
            id, team_id, uploader_player_id, storage_key, mime_type, file_size_bytes,
            duration_seconds, caption, status, tagging_status, tagging_attempts,
            published_publicly_at, public_review_status, public_reviewed_at, created_at
        ) VALUES (
            gen_random_uuid(), v_team_id, v_player_id, 'clips/cd0ce417-300b-417a-aea4-8bfe1b4a58f4/agility_reflex_vandningsbana_v1.published-seed.mp4', 'video/mp4', 5242880,
            25, 'Agility: 30-sekunders reflex- och vändningsbana', 'published', 'tagged', 1,
            '2026-11-10 10:00:00+00'::timestamptz - interval '4 minutes', 'approved', '2026-11-10 10:00:00+00'::timestamptz, now()
        ) RETURNING id INTO v_clip_id;
        RAISE NOTICE 'Skapade video_clip for agility_reflex_vandningsbana_v1 (ID: %)', v_clip_id;
    ELSE
        UPDATE video_clip
        SET status = 'published', public_review_status = 'approved',
            duration_seconds = 25, caption = 'Agility: 30-sekunders reflex- och vändningsbana',
            published_publicly_at = '2026-11-10 10:00:00+00'::timestamptz - interval '4 minutes',
            public_reviewed_at = '2026-11-10 10:00:00+00'::timestamptz
        WHERE id = v_clip_id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM video_clip_tag WHERE clip_id = v_clip_id AND tag = 'fitness_conditioning') THEN
        INSERT INTO video_clip_tag (id, clip_id, tag, confidence, source, created_at)
        VALUES (gen_random_uuid(), v_clip_id, 'fitness_conditioning', 1.000, 'ai_seed_v1', now());
    END IF;

    -- [6/10] ishockey_skott_i_steget_v1 (MooseMille)
    SELECT id INTO v_player_id FROM player WHERE team_id = v_team_id AND screen_name = 'MooseMille';
    IF v_player_id IS NULL THEN
        INSERT INTO player (
            id, team_id, jurisdiction, screen_name, avatar_id, birth_year,
            parental_consent_status, team_join_status, is_captain, locale,
            current_streak_count, longest_streak_count, banked_streak_saver_count, created_at
        ) VALUES (
            gen_random_uuid(), v_team_id, 'SE', 'MooseMille', 'moose', 2013,
            'approved', 'approved', false, 'sv',
            0, 0, 0, now()
        ) RETURNING id INTO v_player_id;
        RAISE NOTICE 'Skapade bot-spelare: MooseMille (ID: %)', v_player_id;
    ELSE
        UPDATE player
        SET parental_consent_status = 'approved', team_join_status = 'approved', avatar_id = 'moose'
        WHERE id = v_player_id;
    END IF;

    -- Public sharing consent
    IF NOT EXISTS (SELECT 1 FROM public_sharing_consent WHERE player_id = v_player_id) THEN
        INSERT INTO public_sharing_consent (id, player_id, status, created_at)
        VALUES (gen_random_uuid(), v_player_id, 'active', now());
    ELSE
        UPDATE public_sharing_consent SET status = 'active' WHERE player_id = v_player_id;
    END IF;

    -- VideoClip
    SELECT id INTO v_clip_id FROM video_clip WHERE storage_key = 'clips/cd0ce417-300b-417a-aea4-8bfe1b4a58f4/ishockey_skott_i_steget_v1.published-seed.mp4';
    IF v_clip_id IS NULL THEN
        INSERT INTO video_clip (
            id, team_id, uploader_player_id, storage_key, mime_type, file_size_bytes,
            duration_seconds, caption, status, tagging_status, tagging_attempts,
            published_publicly_at, public_review_status, public_reviewed_at, created_at
        ) VALUES (
            gen_random_uuid(), v_team_id, v_player_id, 'clips/cd0ce417-300b-417a-aea4-8bfe1b4a58f4/ishockey_skott_i_steget_v1.published-seed.mp4', 'video/mp4', 5242880,
            22, 'Ishockey: Skott i steget och skottramp', 'published', 'tagged', 1,
            '2026-11-10 10:00:00+00'::timestamptz - interval '5 minutes', 'approved', '2026-11-10 10:00:00+00'::timestamptz, now()
        ) RETURNING id INTO v_clip_id;
        RAISE NOTICE 'Skapade video_clip for ishockey_skott_i_steget_v1 (ID: %)', v_clip_id;
    ELSE
        UPDATE video_clip
        SET status = 'published', public_review_status = 'approved',
            duration_seconds = 22, caption = 'Ishockey: Skott i steget och skottramp',
            published_publicly_at = '2026-11-10 10:00:00+00'::timestamptz - interval '5 minutes',
            public_reviewed_at = '2026-11-10 10:00:00+00'::timestamptz
        WHERE id = v_clip_id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM video_clip_tag WHERE clip_id = v_clip_id AND tag = 'shooting') THEN
        INSERT INTO video_clip_tag (id, clip_id, tag, confidence, source, created_at)
        VALUES (gen_random_uuid(), v_clip_id, 'shooting', 1.000, 'ai_seed_v1', now());
    END IF;

    -- [7/10] innebandy_sidledshopp_teknik_v1 (KangarooKajsa)
    SELECT id INTO v_player_id FROM player WHERE team_id = v_team_id AND screen_name = 'KangarooKajsa';
    IF v_player_id IS NULL THEN
        INSERT INTO player (
            id, team_id, jurisdiction, screen_name, avatar_id, birth_year,
            parental_consent_status, team_join_status, is_captain, locale,
            current_streak_count, longest_streak_count, banked_streak_saver_count, created_at
        ) VALUES (
            gen_random_uuid(), v_team_id, 'SE', 'KangarooKajsa', 'kangaroo', 2013,
            'approved', 'approved', false, 'sv',
            0, 0, 0, now()
        ) RETURNING id INTO v_player_id;
        RAISE NOTICE 'Skapade bot-spelare: KangarooKajsa (ID: %)', v_player_id;
    ELSE
        UPDATE player
        SET parental_consent_status = 'approved', team_join_status = 'approved', avatar_id = 'kangaroo'
        WHERE id = v_player_id;
    END IF;

    -- Public sharing consent
    IF NOT EXISTS (SELECT 1 FROM public_sharing_consent WHERE player_id = v_player_id) THEN
        INSERT INTO public_sharing_consent (id, player_id, status, created_at)
        VALUES (gen_random_uuid(), v_player_id, 'active', now());
    ELSE
        UPDATE public_sharing_consent SET status = 'active' WHERE player_id = v_player_id;
    END IF;

    -- VideoClip
    SELECT id INTO v_clip_id FROM video_clip WHERE storage_key = 'clips/cd0ce417-300b-417a-aea4-8bfe1b4a58f4/innebandy_sidledshopp_teknik_v1.published-seed.mp4';
    IF v_clip_id IS NULL THEN
        INSERT INTO video_clip (
            id, team_id, uploader_player_id, storage_key, mime_type, file_size_bytes,
            duration_seconds, caption, status, tagging_status, tagging_attempts,
            published_publicly_at, public_review_status, public_reviewed_at, created_at
        ) VALUES (
            gen_random_uuid(), v_team_id, v_player_id, 'clips/cd0ce417-300b-417a-aea4-8bfe1b4a58f4/innebandy_sidledshopp_teknik_v1.published-seed.mp4', 'video/mp4', 5242880,
            22, 'Innebandy: Sidledshopp och klubbkontroll', 'published', 'tagged', 1,
            '2026-11-10 10:00:00+00'::timestamptz - interval '6 minutes', 'approved', '2026-11-10 10:00:00+00'::timestamptz, now()
        ) RETURNING id INTO v_clip_id;
        RAISE NOTICE 'Skapade video_clip for innebandy_sidledshopp_teknik_v1 (ID: %)', v_clip_id;
    ELSE
        UPDATE video_clip
        SET status = 'published', public_review_status = 'approved',
            duration_seconds = 22, caption = 'Innebandy: Sidledshopp och klubbkontroll',
            published_publicly_at = '2026-11-10 10:00:00+00'::timestamptz - interval '6 minutes',
            public_reviewed_at = '2026-11-10 10:00:00+00'::timestamptz
        WHERE id = v_clip_id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM video_clip_tag WHERE clip_id = v_clip_id AND tag = 'stickhandling') THEN
        INSERT INTO video_clip_tag (id, clip_id, tag, confidence, source, created_at)
        VALUES (gen_random_uuid(), v_clip_id, 'stickhandling', 1.000, 'ai_seed_v1', now());
    END IF;
    IF NOT EXISTS (SELECT 1 FROM video_clip_tag WHERE clip_id = v_clip_id AND tag = 'fitness_conditioning') THEN
        INSERT INTO video_clip_tag (id, clip_id, tag, confidence, source, created_at)
        VALUES (gen_random_uuid(), v_clip_id, 'fitness_conditioning', 1.000, 'ai_seed_v1', now());
    END IF;

    -- [8/10] badminton_fotarbete_reaktion_v1 (EagleEddie)
    SELECT id INTO v_player_id FROM player WHERE team_id = v_team_id AND screen_name = 'EagleEddie';
    IF v_player_id IS NULL THEN
        INSERT INTO player (
            id, team_id, jurisdiction, screen_name, avatar_id, birth_year,
            parental_consent_status, team_join_status, is_captain, locale,
            current_streak_count, longest_streak_count, banked_streak_saver_count, created_at
        ) VALUES (
            gen_random_uuid(), v_team_id, 'SE', 'EagleEddie', 'eagle', 2013,
            'approved', 'approved', false, 'sv',
            0, 0, 0, now()
        ) RETURNING id INTO v_player_id;
        RAISE NOTICE 'Skapade bot-spelare: EagleEddie (ID: %)', v_player_id;
    ELSE
        UPDATE player
        SET parental_consent_status = 'approved', team_join_status = 'approved', avatar_id = 'eagle'
        WHERE id = v_player_id;
    END IF;

    -- Public sharing consent
    IF NOT EXISTS (SELECT 1 FROM public_sharing_consent WHERE player_id = v_player_id) THEN
        INSERT INTO public_sharing_consent (id, player_id, status, created_at)
        VALUES (gen_random_uuid(), v_player_id, 'active', now());
    ELSE
        UPDATE public_sharing_consent SET status = 'active' WHERE player_id = v_player_id;
    END IF;

    -- VideoClip
    SELECT id INTO v_clip_id FROM video_clip WHERE storage_key = 'clips/cd0ce417-300b-417a-aea4-8bfe1b4a58f4/badminton_fotarbete_reaktion_v1.published-seed.mp4';
    IF v_clip_id IS NULL THEN
        INSERT INTO video_clip (
            id, team_id, uploader_player_id, storage_key, mime_type, file_size_bytes,
            duration_seconds, caption, status, tagging_status, tagging_attempts,
            published_publicly_at, public_review_status, public_reviewed_at, created_at
        ) VALUES (
            gen_random_uuid(), v_team_id, v_player_id, 'clips/cd0ce417-300b-417a-aea4-8bfe1b4a58f4/badminton_fotarbete_reaktion_v1.published-seed.mp4', 'video/mp4', 5242880,
            21, 'Badminton: Snabbt fotarbete och reflexer', 'published', 'tagged', 1,
            '2026-11-10 10:00:00+00'::timestamptz - interval '7 minutes', 'approved', '2026-11-10 10:00:00+00'::timestamptz, now()
        ) RETURNING id INTO v_clip_id;
        RAISE NOTICE 'Skapade video_clip for badminton_fotarbete_reaktion_v1 (ID: %)', v_clip_id;
    ELSE
        UPDATE video_clip
        SET status = 'published', public_review_status = 'approved',
            duration_seconds = 21, caption = 'Badminton: Snabbt fotarbete och reflexer',
            published_publicly_at = '2026-11-10 10:00:00+00'::timestamptz - interval '7 minutes',
            public_reviewed_at = '2026-11-10 10:00:00+00'::timestamptz
        WHERE id = v_clip_id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM video_clip_tag WHERE clip_id = v_clip_id AND tag = 'fitness_conditioning') THEN
        INSERT INTO video_clip_tag (id, clip_id, tag, confidence, source, created_at)
        VALUES (gen_random_uuid(), v_clip_id, 'fitness_conditioning', 1.000, 'ai_seed_v1', now());
    END IF;

    -- [9/10] fotboll_malvakt_markraddning_v1 (KeeperLeo)
    SELECT id INTO v_player_id FROM player WHERE team_id = v_team_id AND screen_name = 'KeeperLeo';
    IF v_player_id IS NULL THEN
        INSERT INTO player (
            id, team_id, jurisdiction, screen_name, avatar_id, birth_year,
            parental_consent_status, team_join_status, is_captain, locale,
            current_streak_count, longest_streak_count, banked_streak_saver_count, created_at
        ) VALUES (
            gen_random_uuid(), v_team_id, 'SE', 'KeeperLeo', 'lion', 2013,
            'approved', 'approved', false, 'sv',
            0, 0, 0, now()
        ) RETURNING id INTO v_player_id;
        RAISE NOTICE 'Skapade bot-spelare: KeeperLeo (ID: %)', v_player_id;
    ELSE
        UPDATE player
        SET parental_consent_status = 'approved', team_join_status = 'approved', avatar_id = 'lion'
        WHERE id = v_player_id;
    END IF;

    -- Public sharing consent
    IF NOT EXISTS (SELECT 1 FROM public_sharing_consent WHERE player_id = v_player_id) THEN
        INSERT INTO public_sharing_consent (id, player_id, status, created_at)
        VALUES (gen_random_uuid(), v_player_id, 'active', now());
    ELSE
        UPDATE public_sharing_consent SET status = 'active' WHERE player_id = v_player_id;
    END IF;

    -- VideoClip
    SELECT id INTO v_clip_id FROM video_clip WHERE storage_key = 'clips/cd0ce417-300b-417a-aea4-8bfe1b4a58f4/fotboll_malvakt_markraddning_v1.published-seed.mp4';
    IF v_clip_id IS NULL THEN
        INSERT INTO video_clip (
            id, team_id, uploader_player_id, storage_key, mime_type, file_size_bytes,
            duration_seconds, caption, status, tagging_status, tagging_attempts,
            published_publicly_at, public_review_status, public_reviewed_at, created_at
        ) VALUES (
            gen_random_uuid(), v_team_id, v_player_id, 'clips/cd0ce417-300b-417a-aea4-8bfe1b4a58f4/fotboll_malvakt_markraddning_v1.published-seed.mp4', 'video/mp4', 5242880,
            23, 'Fotboll: Målvakt – låga markräddningar', 'published', 'tagged', 1,
            '2026-11-10 10:00:00+00'::timestamptz - interval '8 minutes', 'approved', '2026-11-10 10:00:00+00'::timestamptz, now()
        ) RETURNING id INTO v_clip_id;
        RAISE NOTICE 'Skapade video_clip for fotboll_malvakt_markraddning_v1 (ID: %)', v_clip_id;
    ELSE
        UPDATE video_clip
        SET status = 'published', public_review_status = 'approved',
            duration_seconds = 23, caption = 'Fotboll: Målvakt – låga markräddningar',
            published_publicly_at = '2026-11-10 10:00:00+00'::timestamptz - interval '8 minutes',
            public_reviewed_at = '2026-11-10 10:00:00+00'::timestamptz
        WHERE id = v_clip_id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM video_clip_tag WHERE clip_id = v_clip_id AND tag = 'goalkeeping') THEN
        INSERT INTO video_clip_tag (id, clip_id, tag, confidence, source, created_at)
        VALUES (gen_random_uuid(), v_clip_id, 'goalkeeping', 1.000, 'ai_seed_v1', now());
    END IF;

    -- [10/10] fys_kneetucks_sliders_core_v1 (BadgerBo)
    SELECT id INTO v_player_id FROM player WHERE team_id = v_team_id AND screen_name = 'BadgerBo';
    IF v_player_id IS NULL THEN
        INSERT INTO player (
            id, team_id, jurisdiction, screen_name, avatar_id, birth_year,
            parental_consent_status, team_join_status, is_captain, locale,
            current_streak_count, longest_streak_count, banked_streak_saver_count, created_at
        ) VALUES (
            gen_random_uuid(), v_team_id, 'SE', 'BadgerBo', 'badger', 2013,
            'approved', 'approved', false, 'sv',
            0, 0, 0, now()
        ) RETURNING id INTO v_player_id;
        RAISE NOTICE 'Skapade bot-spelare: BadgerBo (ID: %)', v_player_id;
    ELSE
        UPDATE player
        SET parental_consent_status = 'approved', team_join_status = 'approved', avatar_id = 'badger'
        WHERE id = v_player_id;
    END IF;

    -- Public sharing consent
    IF NOT EXISTS (SELECT 1 FROM public_sharing_consent WHERE player_id = v_player_id) THEN
        INSERT INTO public_sharing_consent (id, player_id, status, created_at)
        VALUES (gen_random_uuid(), v_player_id, 'active', now());
    ELSE
        UPDATE public_sharing_consent SET status = 'active' WHERE player_id = v_player_id;
    END IF;

    -- VideoClip
    SELECT id INTO v_clip_id FROM video_clip WHERE storage_key = 'clips/cd0ce417-300b-417a-aea4-8bfe1b4a58f4/fys_kneetucks_sliders_core_v1.published-seed.mp4';
    IF v_clip_id IS NULL THEN
        INSERT INTO video_clip (
            id, team_id, uploader_player_id, storage_key, mime_type, file_size_bytes,
            duration_seconds, caption, status, tagging_status, tagging_attempts,
            published_publicly_at, public_review_status, public_reviewed_at, created_at
        ) VALUES (
            gen_random_uuid(), v_team_id, v_player_id, 'clips/cd0ce417-300b-417a-aea4-8bfe1b4a58f4/fys_kneetucks_sliders_core_v1.published-seed.mp4', 'video/mp4', 5242880,
            24, 'Fys/Core: Knee-tucks och bålstyrka i planka', 'published', 'tagged', 1,
            '2026-11-10 10:00:00+00'::timestamptz - interval '9 minutes', 'approved', '2026-11-10 10:00:00+00'::timestamptz, now()
        ) RETURNING id INTO v_clip_id;
        RAISE NOTICE 'Skapade video_clip for fys_kneetucks_sliders_core_v1 (ID: %)', v_clip_id;
    ELSE
        UPDATE video_clip
        SET status = 'published', public_review_status = 'approved',
            duration_seconds = 24, caption = 'Fys/Core: Knee-tucks och bålstyrka i planka',
            published_publicly_at = '2026-11-10 10:00:00+00'::timestamptz - interval '9 minutes',
            public_reviewed_at = '2026-11-10 10:00:00+00'::timestamptz
        WHERE id = v_clip_id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM video_clip_tag WHERE clip_id = v_clip_id AND tag = 'fitness_conditioning') THEN
        INSERT INTO video_clip_tag (id, clip_id, tag, confidence, source, created_at)
        VALUES (gen_random_uuid(), v_clip_id, 'fitness_conditioning', 1.000, 'ai_seed_v1', now());
    END IF;

    RAISE NOTICE '--- Seedning av 10 AI-mikroutmaningar klar! ---';
END $$;
COMMIT;




SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."admin_register_open_play"("p_session_id" "uuid", "p_name" "text", "p_phone" "text", "p_status" "text", "p_payment_method" "text", "p_payment_status" "text", "p_player_notes" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_user_id uuid;
    v_player_id uuid;
    v_existing_status text;
BEGIN
    -- 🛡️ 第一道防線：強制驗證僅限後台登入者 (authenticated)
    IF auth.role() <> 'authenticated' THEN
        RETURN jsonb_build_object('success', false, 'message', '資安拒絕：僅限已登入的管理員執行此操作');
    END IF;

    p_name := trim(p_name);
    p_phone := trim(p_phone);

    IF p_name = '' OR p_phone = '' THEN
        RETURN jsonb_build_object('success', false, 'message', '球友姓名與電話不可為空！');
    END IF;

    -- 查詢或建立使用者
    SELECT id INTO v_user_id FROM public.users WHERE phone = p_phone LIMIT 1;
    IF v_user_id IS NULL THEN
        INSERT INTO public.users (name, phone)
        VALUES (p_name, p_phone)
        RETURNING id INTO v_user_id;
    ELSE
        UPDATE public.users SET name = p_name WHERE id = v_user_id;
    END IF;

    -- 防重複登記校驗
    SELECT status INTO v_existing_status
    FROM public.open_play_players
    WHERE session_id = p_session_id 
      AND user_id = v_user_id 
      AND status <> 'cancelled'
    LIMIT 1;

    IF v_existing_status IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', false, 
            'message', '該球友已在名冊中（狀態：' || CASE WHEN v_existing_status = 'registered' THEN '正取' ELSE '候補' END || '），請勿重複登記！'
        );
    END IF;

    -- 寫入紀錄
    INSERT INTO public.open_play_players (
        session_id,
        user_id,
        status,
        payment_method,
        payment_status,
        player_notes,
        created_at
    ) VALUES (
        p_session_id,
        v_user_id,
        p_status,
        coalesce(p_payment_method, 'onsite'),
        coalesce(p_payment_status, 'unpaid'),
        p_player_notes,
        clock_timestamp()
    ) RETURNING id INTO v_player_id;

    RETURN jsonb_build_object(
        'success', true, 
        'message', '代客登記成功', 
        'player_id', v_player_id
    );
END;
$$;


ALTER FUNCTION "public"."admin_register_open_play"("p_session_id" "uuid", "p_name" "text", "p_phone" "text", "p_status" "text", "p_payment_method" "text", "p_payment_status" "text", "p_player_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."book_court"("p_court_id" bigint, "p_booking_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_name" "text", "p_phone" "text", "p_price" integer DEFAULT 250, "p_payment_method" "text" DEFAULT 'onsite'::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_user_id bigint;
  v_conflict_count integer;
  v_booking_id bigint;
begin
  -- 1. 取得或建立球友資料
  select id into v_user_id from users where phone = trim(p_phone);
  if not found then
    insert into users (name, phone)
    values (trim(p_name), trim(p_phone))
    returning id into v_user_id;
  else
    update users set name = trim(p_name) where id = v_user_id;
  end if;

  -- 2. 檢查時段衝突 (同球場、同日期、有效狀態、時段重疊)
  select count(*) into v_conflict_count
  from court_bookings
  where court_id = p_court_id
    and booking_date = p_booking_date
    and status != 'cancelled'
    and (
      (start_time <= p_start_time and end_time > p_start_time)
      or (start_time < p_end_time and end_time >= p_end_time)
      or (start_time >= p_start_time and end_time <= p_end_time)
    )
  for update;

  if v_conflict_count > 0 then
    return jsonb_build_object('success', false, 'message', '該時段已被預約，請選擇其他時段或球場');
  end if;

  -- 3. 寫入場地預約紀錄
  insert into court_bookings (
    court_id,
    user_id,
    booking_date,
    start_time,
    end_time,
    price,
    status,
    payment_method,
    payment_status,
    created_at,
    updated_at
  )
  values (
    p_court_id,
    v_user_id,
    p_booking_date,
    p_start_time,
    p_end_time,
    p_price,
    'booked',
    p_payment_method,
    'unpaid',
    now(),
    now()
  )
  returning id into v_booking_id;

  return jsonb_build_object(
    'success', true,
    'booking_id', v_booking_id,
    'message', '預約成功！'
  );
end;
$$;


ALTER FUNCTION "public"."book_court"("p_court_id" bigint, "p_booking_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_name" "text", "p_phone" "text", "p_price" integer, "p_payment_method" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."book_court_batch"("p_court_id" "uuid", "p_booking_date" "date", "p_slots" "text"[], "p_name" "text", "p_phone" "text", "p_price_per_slot" integer) RETURNS json
    LANGUAGE "plpgsql"
    AS $$
declare
  v_user_id uuid;
  v_slot text;
  v_start_time time;
  v_end_time time;
  v_booking_id uuid;
  v_booking_ids uuid[] := '{}';
begin
  select id into v_user_id from users where phone = p_phone;
  if v_user_id is null then
    insert into users (name, phone) values (p_name, p_phone) returning id into v_user_id;
  else
    update users set name = p_name where id = v_user_id;
  end if;

  foreach v_slot in array p_slots loop
    v_start_time := v_slot::time;
    v_end_time := (v_slot::time + interval '30 minute')::time;

    if exists (
      select 1 from court_bookings 
      where court_id = p_court_id 
        and booking_date = p_booking_date 
        and start_time = v_start_time 
        and status = 'booked'
    ) then
      return json_build_object('success', false, 'message', format('時段 %s 已被人預約，請重新選擇！', v_slot));
    end if;
  end loop;

  foreach v_slot in array p_slots loop
    v_start_time := v_slot::time;
    v_end_time := (v_slot::time + interval '30 minute')::time;

    insert into court_bookings (
      court_id, user_id, booking_date, start_time, end_time, price, status, payment_method, payment_status
    ) values (
      p_court_id, v_user_id, p_booking_date, v_start_time, v_end_time, p_price_per_slot, 'booked', 'onsite', 'unpaid'
    ) returning id into v_booking_id;

    v_booking_ids := array_append(v_booking_ids, v_booking_id);
  end loop;

  return json_build_object('success', true, 'booking_ids', v_booking_ids);
end;
$$;


ALTER FUNCTION "public"."book_court_batch"("p_court_id" "uuid", "p_booking_date" "date", "p_slots" "text"[], "p_name" "text", "p_phone" "text", "p_price_per_slot" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."book_court_batch_dynamic"("p_name" "text", "p_phone" "text", "p_court_id" "uuid", "p_booking_date" "date", "p_slots_data" "jsonb") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_user_id uuid;
  v_item jsonb;
  v_slot text;
  v_price int;
  v_start_time time;
  v_end_time time;
  v_booking_id uuid;
  v_booking_ids uuid[] := '{}';
begin
  -- 1. 檢查或建立使用者
  select id into v_user_id from users where phone = p_phone;
  if v_user_id is null then
    insert into users (name, phone) values (p_name, p_phone) returning id into v_user_id;
  else
    update users set name = p_name where id = v_user_id;
  end if;

  -- 2. 迴圈檢查每個時段是否已被預約
  for v_item in select * from jsonb_array_elements(p_slots_data) loop
    v_slot := v_item->>'slot';
    v_start_time := v_slot::time;
    v_end_time := (v_slot::time + interval '30 minute')::time;

    if exists (
      select 1 from court_bookings 
      where court_id = p_court_id 
        and booking_date = p_booking_date 
        and start_time = v_start_time 
        and status = 'booked'
    ) then
      return json_build_object('success', false, 'message', format('時段 %s 已被人預約，請重新選擇！', v_slot));
    end if;
  end loop;

  -- 3. 批次寫入預約（帶入各時段動態價格）
  for v_item in select * from jsonb_array_elements(p_slots_data) loop
    v_slot := v_item->>'slot';
    v_price := (v_item->>'price')::int;
    v_start_time := v_slot::time;
    v_end_time := (v_slot::time + interval '30 minute')::time;

    insert into court_bookings (
      court_id, user_id, booking_date, start_time, end_time, price, status, payment_method, payment_status
    ) values (
      p_court_id, v_user_id, p_booking_date, v_start_time, v_end_time, v_price, 'booked', 'onsite', 'unpaid'
    ) returning id into v_booking_id;

    v_booking_ids := array_append(v_booking_ids, v_booking_id);
  end loop;

  return json_build_object('success', true, 'booking_ids', v_booking_ids);
end;
$$;


ALTER FUNCTION "public"."book_court_batch_dynamic"("p_name" "text", "p_phone" "text", "p_court_id" "uuid", "p_booking_date" "date", "p_slots_data" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."cancel_open_play_booking"("p_booking_id" bigint, "p_phone" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_session open_play_sessions%rowtype;
  v_booking open_play_players%rowtype;
  v_user users%rowtype;
  v_next_waitlist open_play_players%rowtype;
  v_session_time timestamp with time zone;
  v_hours_before numeric;
begin
  -- 1. 驗證球友身份（透過手機號碼確保不能取消他人訂單）
  select * into v_user
  from users
  where phone = p_phone;

  if not found then
    return jsonb_build_object('success', false, 'message', '使用者驗證失敗');
  end if;

  -- 2. 鎖定並檢查此筆報名紀錄
  select * into v_booking
  from open_play_players
  where id = p_booking_id and user_id = v_user.id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'message', '找不到此預約紀錄或無權限操作');
  end if;

  if v_booking.status = 'cancelled' then
    return jsonb_build_object('success', false, 'message', '此預約先前已取消');
  end if;

  -- 3. 取得場次時間並加鎖
  select * into v_session
  from open_play_sessions
  where id = v_booking.session_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'message', '找不到對應的臨打場次');
  end if;

  -- 4. 驗證「開打前 3 小時不可取消」規則
  -- 假設 session_date 為 'YYYY-MM-DD'，start_time 為 'HH:MM:SS' 或 'HH:MM'
  v_session_time := (v_session.session_date || ' ' || v_session.start_time)::timestamp with time zone;
  v_hours_before := extract(epoch from (v_session_time - now())) / 3600;

  if v_hours_before < 3 then
    return jsonb_build_object('success', false, 'message', '活動開始前 3 小時內不開放自行取消，請聯繫球館管理員');
  end if;

  -- 5. 將目前預約改為取消
  update open_play_players
  set status = 'cancelled'
  where id = v_booking.id;

  -- 6. 若取消者原為「正取 (registered)」，自動將候補第一順位轉為正取
  if v_booking.status = 'registered' then
    select * into v_next_waitlist
    from open_play_players
    where session_id = v_session.id
      and status = 'waitlisted'
    order by created_at asc
    limit 1
    for update skip locked;

    if found then
      update open_play_players
      set status = 'registered'
      where id = v_next_waitlist.id;
    end if;
  end if;

  return jsonb_build_object('success', true, 'message', '取消預約成功');
end;
$$;


ALTER FUNCTION "public"."cancel_open_play_booking"("p_booking_id" bigint, "p_phone" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_court_has_conflict"("p_court_ids" "uuid"[], "p_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_exclude_type" "text", "p_exclude_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_court_id uuid;
    v_conflict_detail text;
    v_court_name text;
BEGIN
    -- 驗證開始與結束時間合法性
    IF p_start_time >= p_end_time THEN
        RETURN '開始時間必須早於結束時間！';
    END IF;

    FOREACH v_court_id IN ARRAY p_court_ids
    LOOP
        SELECT name INTO v_court_name FROM public.courts WHERE id = v_court_id;

        -- 1. 檢查是否與「場地私人預約」衝突
        SELECT '私人預約 (' || to_char(cb.start_time, 'HH24:MI') || '-' || to_char(cb.end_time, 'HH24:MI') || ')'
        INTO v_conflict_detail
        FROM public.court_bookings cb
        WHERE cb.court_id = v_court_id
          AND cb.booking_date = p_date
          AND cb.status = 'booked'
          AND (p_exclude_type <> 'court_booking' OR cb.id <> p_exclude_id)
          AND p_start_time < cb.end_time AND p_end_time > cb.start_time
        LIMIT 1;

        IF v_conflict_detail IS NOT NULL THEN
            RETURN '【' || coalesce(v_court_name, '此場地') || '】該時段已有 ' || v_conflict_detail || '，不可重疊安排！';
        END IF;

        -- 2. 檢查是否與「體驗課程」衝突
        SELECT '體驗課程【' || cls.title || '】(' || to_char(cls.start_time, 'HH24:MI') || '-' || to_char(cls.end_time, 'HH24:MI') || ')'
        INTO v_conflict_detail
        FROM public.classes cls
        WHERE cls.court_id = v_court_id
          AND cls.class_date = p_date
          AND cls.status <> 'cancelled'
          AND (p_exclude_type <> 'class' OR cls.id <> p_exclude_id)
          AND p_start_time < cls.end_time AND p_end_time > cls.start_time
        LIMIT 1;

        IF v_conflict_detail IS NOT NULL THEN
            RETURN '【' || coalesce(v_court_name, '此場地') || '】該時段已有 ' || v_conflict_detail || '，不可重疊安排！';
        END IF;

        -- 3. 檢查是否與「臨打活動」衝突
        SELECT '臨打活動【' || ops.title || '】(' || to_char(ops.start_time, 'HH24:MI') || '-' || to_char(ops.end_time, 'HH24:MI') || ')'
        INTO v_conflict_detail
        FROM public.open_play_sessions ops
        WHERE (v_court_id = ANY(ops.court_ids) OR ops.court_id = v_court_id)
          AND ops.session_date = p_date
          AND ops.status <> 'cancelled'
          AND (p_exclude_type <> 'open_play' OR ops.id <> p_exclude_id)
          AND p_start_time < ops.end_time AND p_end_time > ops.start_time
        LIMIT 1;

        IF v_conflict_detail IS NOT NULL THEN
            RETURN '【' || coalesce(v_court_name, '此場地') || '】該時段已有 ' || v_conflict_detail || '，不可重疊安排！';
        END IF;
    END LOOP;

    RETURN NULL; -- 代表時段完全乾淨，無任何重疊
END;
$$;


ALTER FUNCTION "public"."check_court_has_conflict"("p_court_ids" "uuid"[], "p_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_exclude_type" "text", "p_exclude_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_class"("p_title" "text", "p_coach" "text", "p_class_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_price" numeric, "p_max_players" integer, "p_court_id" "uuid", "p_notes" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_conflict text;
    v_class_id uuid;
BEGIN
    v_conflict := public.check_court_has_conflict(ARRAY[p_court_id], p_class_date, p_start_time, p_end_time, 'class', NULL);
    IF v_conflict IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'message', v_conflict);
    END IF;

    INSERT INTO public.classes (
        title, coach, class_date, start_time, end_time, price, max_players, court_id, notes, status
    ) VALUES (
        p_title, p_coach, p_class_date, p_start_time, p_end_time, p_price, p_max_players, p_court_id, p_notes, 'open'
    ) RETURNING id INTO v_class_id;

    RETURN jsonb_build_object('success', true, 'message', '課程新增成功', 'class_id', v_class_id);
END;
$$;


ALTER FUNCTION "public"."create_class"("p_title" "text", "p_coach" "text", "p_class_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_price" numeric, "p_max_players" integer, "p_court_id" "uuid", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_open_play_session"("p_title" "text", "p_level" "text", "p_session_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_price" numeric, "p_max_players" integer, "p_max_waitlist" integer, "p_court_ids" "uuid"[], "p_notes" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_conflict text;
    v_session_id uuid;
BEGIN
    v_conflict := public.check_court_has_conflict(p_court_ids, p_session_date, p_start_time, p_end_time, 'open_play', NULL);
    IF v_conflict IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'message', v_conflict);
    END IF;

    INSERT INTO public.open_play_sessions (
        title, level, session_date, start_time, end_time, price, max_players, max_waitlist, court_ids, court_id, notes, status
    ) VALUES (
        p_title, p_level, p_session_date, p_start_time, p_end_time, p_price, p_max_players, p_max_waitlist, p_court_ids, p_court_ids[1], p_notes, 'open'
    ) RETURNING id INTO v_session_id;

    RETURN jsonb_build_object('success', true, 'message', '臨打場次新增成功', 'session_id', v_session_id);
END;
$$;


ALTER FUNCTION "public"."create_open_play_session"("p_title" "text", "p_level" "text", "p_session_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_price" numeric, "p_max_players" integer, "p_max_waitlist" integer, "p_court_ids" "uuid"[], "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_open_play_session"("p_title" "text", "p_level" "text", "p_session_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_price" integer, "p_max_players" integer, "p_max_waitlist" integer, "p_court_ids" "uuid"[], "p_notes" "text", "p_admin_username" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_court_id uuid;
  v_conflict_found boolean := false;
  v_conflict_msg text := '';
begin
  -- 🛡️ 1. 嚴格驗證呼叫者身分 (完全基於 Supabase Auth JWT)
  IF (SELECT auth.uid()) IS NULL THEN
      RAISE EXCEPTION 'Unauthorized: authentication required.';
  END IF;

  IF NOT EXISTS (
      SELECT 1
      FROM public.admins
      WHERE auth_user_id = (SELECT auth.uid())
  ) THEN
      RAISE EXCEPTION 'Unauthorized: administrator access required.';
  END IF;

  -- 🛡️ 2. 檢查每個選擇的場地是否有衝突 (全面加上 public. 前綴)
  foreach v_court_id in array p_court_ids loop
    -- 檢查一般場地預約
    if exists (
      select 1 from public.court_bookings
      where court_id = v_court_id
        and booking_date = p_session_date
        and status = 'booked'
        and start_time < p_end_time
        and end_time > p_start_time
    ) then
      v_conflict_found := true;
      v_conflict_msg := format('新增失敗：所選時段內，有場地已被一般私人預約佔用！');
      exit;
    end if;

    -- 檢查課程
    if exists (
      select 1 from public.classes
      where court_id = v_court_id
        and class_date = p_session_date
        and status != 'cancelled'
        and start_time < p_end_time
        and end_time > p_start_time
    ) then
      v_conflict_found := true;
      v_conflict_msg := format('新增失敗：所選時段內，有場地已被體驗課程佔用！');
      exit;
    end if;

    -- 檢查其他臨打場次
    if exists (
      select 1 from public.open_play_sessions
      where session_date = p_session_date
        and status = 'open'
        and v_court_id = any(court_ids)
        and start_time < p_end_time
        and end_time > p_start_time
    ) then
      v_conflict_found := true;
      v_conflict_msg := format('新增失敗：所選時段內，有場地已有其他臨打活動佔用！');
      exit;
    end if;
  end loop;

  if v_conflict_found then
    return json_build_object('success', false, 'message', v_conflict_msg);
  end if;

  -- 🛡️ 3. 通過檢查，正式建立臨打 (加上 public. 前綴)
  insert into public.open_play_sessions (
    title, level, session_date, start_time, end_time, price, max_players, max_waitlist, court_id, court_ids, notes, status
  ) values (
    p_title, p_level, p_session_date, p_start_time, p_end_time, p_price, p_max_players, p_max_waitlist, p_court_ids[1], p_court_ids, p_notes, 'open'
  );

  return json_build_object('success', true, 'message', '臨打場次新增成功！');
end;
$$;


ALTER FUNCTION "public"."create_open_play_session"("p_title" "text", "p_level" "text", "p_session_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_price" integer, "p_max_players" integer, "p_max_waitlist" integer, "p_court_ids" "uuid"[], "p_notes" "text", "p_admin_username" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_bookings_by_phone"("p_phone" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_user record;
    v_open_plays jsonb;
    v_courts jsonb;
    v_classes jsonb;
BEGIN
    SELECT id, name, phone INTO v_user
    FROM public.users
    WHERE phone = trim(p_phone)
    LIMIT 1;

    IF v_user.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', '找不到此手機號碼的預約紀錄');
    END IF;

    -- 臨打紀錄
    SELECT coalesce(jsonb_agg(sub), '[]'::jsonb) INTO v_open_plays
    FROM (
        SELECT 
            op.id,
            op.status,
            op.player_notes,
            op.payment_status,
            op.payment_method,
            jsonb_build_object(
                'id', s.id,
                'title', s.title,
                'level', s.level,
                'session_date', s.session_date,
                'start_time', s.start_time,
                'end_time', s.end_time,
                'price', s.price,
                'courts', jsonb_build_object('name', c.name)
            ) AS open_play_sessions
        FROM public.open_play_players op
        JOIN public.open_play_sessions s ON op.session_id = s.id
        LEFT JOIN public.courts c ON s.court_id = c.id
        WHERE op.user_id = v_user.id
        ORDER BY s.session_date DESC, s.start_time DESC
    ) sub;

    -- 場地租借紀錄
    SELECT coalesce(jsonb_agg(sub), '[]'::jsonb) INTO v_courts
    FROM (
        SELECT 
            cb.id,
            cb.court_id,
            cb.booking_date,
            cb.start_time,
            cb.end_time,
            cb.status,
            cb.payment_status,
            cb.price,
            jsonb_build_object('name', c.name) AS courts
        FROM public.court_bookings cb
        LEFT JOIN public.courts c ON cb.court_id = c.id
        WHERE cb.user_id = v_user.id
        ORDER BY cb.booking_date DESC, cb.court_id ASC, cb.start_time ASC
    ) sub;

    -- 體驗課程紀錄
    SELECT coalesce(jsonb_agg(sub), '[]'::jsonb) INTO v_classes
    FROM (
        SELECT 
            clb.id,
            clb.status,
            clb.payment_status,
            clb.need_paddle,
            clb.notes,
            jsonb_build_object(
                'id', cls.id,
                'title', cls.title,
                'coach', cls.coach,
                'class_date', cls.class_date,
                'start_time', cls.start_time,
                'end_time', cls.end_time,
                'price', cls.price
            ) AS classes
        FROM public.class_bookings clb
        JOIN public.classes cls ON clb.class_id = cls.id
        WHERE clb.user_id = v_user.id
        ORDER BY cls.class_date DESC, cls.start_time DESC
    ) sub;

    RETURN jsonb_build_object(
        'success', true,
        'user', jsonb_build_object('id', v_user.id, 'name', v_user.name, 'phone', v_user.phone),
        'open_play_bookings', v_open_plays,
        'court_bookings', v_courts,
        'class_bookings', v_classes
    );
END;
$$;


ALTER FUNCTION "public"."get_my_bookings_by_phone"("p_phone" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."register_class"("p_class_id" "uuid", "p_name" "text", "p_phone" "text", "p_notes" "text", "p_need_paddle" boolean) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_user_id uuid;
  v_class record;
  v_reg_count int;
  v_booking_id uuid;
begin
  -- 1. 基礎輸入防線 (拒絕 NULL、空字串或純空白)
  if p_phone is null or trim(p_phone) = '' then
    return json_build_object('success', false, 'message', '請輸入有效的手機號碼！');
  end if;

  if p_name is null or trim(p_name) = '' then
    return json_build_object('success', false, 'message', '請輸入有效的姓名！');
  end if;

  -- 2. 課程優先驗證 + 排他鎖 (確保無效、關閉、過期或額滿時，零使用者副作用)
  select id, status, registration_deadline, max_players
  into v_class 
  from public.classes 
  where id = p_class_id
  FOR UPDATE;

  if not found then
    return json_build_object('success', false, 'message', '找不到此課程！');
  end if;

  if v_class.status != 'open' then
    return json_build_object('success', false, 'message', '此課程目前未開放報名或已關閉！');
  end if;

  if v_class.registration_deadline is not null and now() > v_class.registration_deadline then
    return json_build_object('success', false, 'message', '此課程已過報名截止時間！');
  end if;

  -- 3. 提前計算目前報名人數與檢查額滿狀態 (避免額滿才建立 user)
  select count(*) into v_reg_count 
  from public.class_bookings 
  where class_id = p_class_id and status = 'booked';

  if v_reg_count >= v_class.max_players then
    return json_build_object('success', false, 'message', '此課程已額滿，下次請早！');
  end if;

  -- 4. 安全的使用者身分對應與建立 (透過 ON CONFLICT 免疫併發 Unique Violation，且不覆蓋既有姓名)
  select id into v_user_id 
  from public.users 
  where phone = trim(p_phone);

  if v_user_id is null then
    insert into public.users (name, phone) 
    values (trim(p_name), trim(p_phone)) 
    on conflict (phone) do nothing
    returning id into v_user_id;

    if v_user_id is null then
      select id into v_user_id 
      from public.users 
      where phone = trim(p_phone);
    end if;
  end if;

  -- 5. 重複報名檢查
  if exists (
    select 1 from public.class_bookings 
    where class_id = p_class_id 
      and user_id = v_user_id 
      and status != 'cancelled'
  ) then
    return json_build_object('success', false, 'message', '您已經報名過此課程了！');
  end if;

  -- 6. 寫入正式報名資料 (伺服器強制鎖定付款狀態與方式)
  insert into public.class_bookings (
    class_id, 
    user_id, 
    status, 
    payment_method, 
    payment_status, 
    notes, 
    need_paddle,
    created_at,
    updated_at
  ) values (
    p_class_id, 
    v_user_id, 
    'booked', 
    'onsite', 
    'unpaid', 
    trim(p_notes), 
    p_need_paddle,
    now(),
    now()
  ) returning id into v_booking_id;

  return json_build_object('success', true, 'booking_id', v_booking_id, 'message', '報名成功！');
end;
$$;


ALTER FUNCTION "public"."register_class"("p_class_id" "uuid", "p_name" "text", "p_phone" "text", "p_notes" "text", "p_need_paddle" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."register_class_booking"("p_class_id" bigint, "p_name" "text", "p_phone" "text", "p_need_paddle" boolean DEFAULT false, "p_notes" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_class classes%rowtype;
  v_user_id bigint;
  v_existing_booking class_bookings%rowtype;
  v_reg_count integer;
  v_booking_id bigint;
begin
  -- 1. 取得或更新使用者資料
  select id into v_user_id from users where phone = trim(p_phone);
  if not found then
    insert into users (name, phone)
    values (trim(p_name), trim(p_phone))
    returning id into v_user_id;
  else
    update users set name = trim(p_name) where id = v_user_id;
  end if;

  -- 2. 排他鎖定課程資料列，防止併發超額
  select * into v_class
  from classes
  where id = p_class_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'message', '找不到此課程場次');
  end if;

  if v_class.status != 'open' then
    return jsonb_build_object('success', false, 'message', '此課程目前未開放報名');
  end if;

  -- 3. 檢查學員是否已報名過（排除 cancelled 狀態）
  select * into v_existing_booking
  from class_bookings
  where class_id = p_class_id and user_id = v_user_id and status != 'cancelled';

  if found then
    return jsonb_build_object('success', false, 'message', '您已報名過此課程，請至「查詢我的預約」查看');
  end if;

  -- 4. 計算目前已報名且未取消之人數
  select count(*) into v_reg_count
  from class_bookings
  where class_id = p_class_id and status != 'cancelled';

  if v_reg_count >= v_class.max_players then
    return jsonb_build_object('success', false, 'message', '抱歉！此課程名額已額滿');
  end if;

  -- 5. 寫入報名紀錄
  insert into class_bookings (
    class_id,
    user_id,
    status,
    need_paddle,
    notes,
    payment_method,
    payment_status,
    created_at,
    updated_at
  )
  values (
    p_class_id,
    v_user_id,
    'booked',
    p_need_paddle,
    p_notes,
    'onsite',
    'unpaid',
    now(),
    now()
  )
  returning id into v_booking_id;

  return jsonb_build_object(
    'success', true,
    'booking_id', v_booking_id,
    'message', '報名成功！'
  );
end;
$$;


ALTER FUNCTION "public"."register_class_booking"("p_class_id" bigint, "p_name" "text", "p_phone" "text", "p_need_paddle" boolean, "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."register_open_play"("p_session_id" "uuid", "p_name" "text", "p_phone" "text", "p_player_notes" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_user_id uuid;
  v_reg_count int;
  v_max_players int;
  v_max_waitlist int;
  v_waitlist_count int;
  v_status text;
  v_booking_id uuid;
begin
  -- 1. 檢查或建立使用者 (需加上 public. 前綴)
  select id into v_user_id from public.users where phone = p_phone;
  if v_user_id is null then
    insert into public.users (name, phone) values (p_name, p_phone) returning id into v_user_id;
  else
    update public.users set name = p_name where id = v_user_id;
  end if;

  -- 🛡️ 2. 核心修正：取得場次限制並「鎖定」該筆場次資料 (FOR UPDATE)
  select max_players, max_waitlist 
  into v_max_players, v_max_waitlist 
  from public.open_play_sessions 
  where id = p_session_id
  FOR UPDATE; -- 👈 就是這行！鎖定這筆場次，直到這筆報名處理完畢

  if not found then
    return json_build_object('success', false, 'message', '找不到此臨打場次！');
  end if;

  -- 3. 檢查是否重複報名
  if exists (
    select 1 from public.open_play_players 
    where session_id = p_session_id 
      and user_id = v_user_id 
      and status != 'cancelled'
  ) then
    return json_build_object('success', false, 'message', '您已經報名過此場次了！');
  end if;

  -- 4. 計算現有正取人數 (此時其他併發請求都會被擋在上面的 FOR UPDATE 等待)
  select count(*) into v_reg_count 
  from public.open_play_players 
  where session_id = p_session_id and status = 'registered';

  -- 5. 判斷正取或候補
  if v_reg_count < v_max_players then
    v_status := 'registered';
  else
    select count(*) into v_waitlist_count 
    from public.open_play_players 
    where session_id = p_session_id and status = 'waitlisted';

    if v_waitlist_count < v_max_waitlist then
      v_status := 'waitlisted';
    else
      return json_build_object('success', false, 'message', '此場次正取與候補皆已額滿！');
    end if;
  end if;

  -- 6. 寫入報名資料
  insert into public.open_play_players (
    session_id, user_id, status, payment_method, payment_status, player_notes
  ) values (
    p_session_id, v_user_id, v_status, 'onsite', 'unpaid', p_player_notes
  ) returning id into v_booking_id;

  return json_build_object('success', true, 'status', v_status, 'booking_id', v_booking_id);
end;
$$;


ALTER FUNCTION "public"."register_open_play"("p_session_id" "uuid", "p_name" "text", "p_phone" "text", "p_player_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."register_open_play"("p_session_id" "uuid", "p_name" "text", "p_phone" "text", "p_notes" "text", "p_need_paddle" boolean) RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_user_id uuid;
  v_session record;
  v_reg_count int;
  v_wait_count int;
  v_status text;
  v_player_id uuid;
begin
  if p_phone is null or trim(p_phone) = '' then
    return json_build_object('success', false, 'message', '請輸入有效的手機號碼！');
  end if;

  if p_name is null or trim(p_name) = '' then
    return json_build_object('success', false, 'message', '請輸入有效的姓名！');
  end if;

  select id, status, max_players, max_waitlist
  into v_session 
  from public.open_play_sessions 
  where id = p_session_id
  FOR UPDATE;

  if not found then
    return json_build_object('success', false, 'message', '找不到此場次！');
  end if;

  if v_session.status != 'open' then
    return json_build_object('success', false, 'message', '此場次目前未開放報名或已關閉！');
  end if;

  select 
    count(*) filter (where status = 'registered'),
    count(*) filter (where status = 'waitlisted')
  into v_reg_count, v_wait_count
  from public.open_play_players 
  where session_id = p_session_id;

  if v_reg_count >= v_session.max_players then
    if v_wait_count >= v_session.max_waitlist then
      return json_build_object('success', false, 'message', '此場次與候補皆已額滿！');
    else
      v_status := 'waitlisted';
    end if;
  else
    v_status := 'registered';
  end if;

  select id into v_user_id 
  from public.users 
  where phone = trim(p_phone);

  if v_user_id is null then
    insert into public.users (name, phone) 
    values (trim(p_name), trim(p_phone)) 
    on conflict (phone) do nothing
    returning id into v_user_id;

    if v_user_id is null then
      select id into v_user_id 
      from public.users 
      where phone = trim(p_phone);
    end if;
  end if;

  if exists (
    select 1 from public.open_play_players 
    where session_id = p_session_id 
      and user_id = v_user_id 
      and status != 'cancelled'
  ) then
    return json_build_object('success', false, 'message', '您已經報名過此場次了！');
  end IF;

  begin
    insert into public.open_play_players (
      session_id, 
      user_id, 
      status, 
      payment_method, 
      payment_status, 
      notes, 
      need_paddle,
      created_at,
      updated_at
    ) values (
      p_session_id, 
      v_user_id, 
      v_status, 
      'onsite', 
      'unpaid', 
      trim(p_notes), 
      p_need_paddle,
      now(),
      now()
    ) returning id into v_player_id;
  exception when unique_violation then
    return json_build_object('success', false, 'message', '您已經報名過此場次或有未清理的紀錄！');
  end;

  return json_build_object('success', true, 'player_id', v_player_id, 'status', v_status, 'message', case when v_status = 'registered' then '報名成功！' else '已加入候補！' end);
end;
$$;


ALTER FUNCTION "public"."register_open_play"("p_session_id" "uuid", "p_name" "text", "p_phone" "text", "p_notes" "text", "p_need_paddle" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."secure_book_court"("p_court_id" "uuid", "p_booking_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_name" "text", "p_phone" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_user_id uuid;
    v_day_type text;
    v_current_time time without time zone;
    v_slot_price numeric;
    v_total_price numeric := 0;
    v_inserted_id uuid;                    -- 🔴 修正為 uuid
    v_booking_ids uuid[] := '{}';          -- 🔴 修正為 uuid[]
    v_court_exists boolean;
BEGIN
    -- 1. 時間合理性驗證
    IF p_start_time >= p_end_time THEN
        RETURN jsonb_build_object('success', false, 'message', '開始時間必須早於結束時間');
    END IF;

    -- 2. 排他鎖定 (FOR UPDATE)
    SELECT EXISTS (
        SELECT 1 FROM public.courts 
        WHERE id = p_court_id 
          AND status = 'active' 
        FOR UPDATE
    ) INTO v_court_exists;

    IF NOT v_court_exists THEN
        RETURN jsonb_build_object('success', false, 'message', '該球場目前不存在或維護中');
    END IF;

    -- 3. 時段重疊防禦
    IF EXISTS (
        SELECT 1 FROM public.court_bookings
        WHERE court_id = p_court_id
          AND booking_date = p_booking_date
          AND status = 'booked'
          AND start_time < p_end_time
          AND end_time > p_start_time
    ) THEN
        RETURN jsonb_build_object('success', false, 'message', '您選擇的時段已被其他人預約，請重新選擇');
    END IF;

    -- 4. 會員身分對應
    SELECT id INTO v_user_id FROM public.users WHERE phone = p_phone LIMIT 1;
    IF v_user_id IS NULL THEN
        INSERT INTO public.users (name, phone)
        VALUES (p_name, p_phone)
        RETURNING id INTO v_user_id;
    END IF;

    -- 5. 判斷平日或假日
    IF EXISTS (SELECT 1 FROM public.special_dates WHERE date = p_booking_date) THEN
        v_day_type := 'weekend';
    ELSIF EXTRACT(DOW FROM p_booking_date) IN (0, 6) THEN
        v_day_type := 'weekend';
    ELSE
        v_day_type := 'weekday';
    END IF;

    -- 6. 伺服器端授權定價與 30 分鐘切分迴圈
    v_current_time := p_start_time;
    WHILE v_current_time < p_end_time LOOP
        
        SELECT price INTO v_slot_price
        FROM public.pricing_rules
        WHERE day_type = v_day_type
          AND start_time <= v_current_time
          AND end_time > v_current_time
        LIMIT 1;

        IF v_slot_price IS NULL THEN
            v_slot_price := 250;
        END IF;

        -- 寫入預約資料
        INSERT INTO public.court_bookings (
            user_id, 
            court_id, 
            booking_date, 
            start_time, 
            end_time, 
            price, 
            status, 
            payment_status, 
            payment_method
        ) VALUES (
            v_user_id, 
            p_court_id, 
            p_booking_date, 
            v_current_time, 
            v_current_time + interval '30 minutes', 
            v_slot_price, 
            'booked', 
            'unpaid', 
            'onsite'
        ) RETURNING id INTO v_inserted_id;

        v_booking_ids := array_append(v_booking_ids, v_inserted_id);
        v_total_price := v_total_price + v_slot_price;

        v_current_time := v_current_time + interval '30 minutes';
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'message', '預約成功',
        'booking_ids', v_booking_ids,
        'price', v_total_price
    );
END;
$$;


ALTER FUNCTION "public"."secure_book_court"("p_court_id" "uuid", "p_booking_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_name" "text", "p_phone" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."secure_book_court_v2"("p_court_id" "uuid", "p_booking_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_name" "text", "p_phone" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_user_id uuid;
    v_day_type text;
    v_current_time time without time zone;
    v_slot_price numeric;
    v_total_price numeric := 0;
    v_inserted_id bigint; 
    v_booking_ids bigint[] := '{}';
    v_court_exists boolean;
BEGIN
    -- 1. 時間合理性驗證
    IF p_start_time >= p_end_time THEN
        RETURN jsonb_build_object('success', false, 'message', '開始時間必須早於結束時間');
    END IF;

    -- 2. 排他鎖定 (FOR UPDATE) 確保高併發下不超賣
    SELECT EXISTS (
        SELECT 1 FROM public.courts 
        WHERE id = p_court_id 
          AND status = 'active' 
        FOR UPDATE
    ) INTO v_court_exists;

    IF NOT v_court_exists THEN
        RETURN jsonb_build_object('success', false, 'message', '該球場目前不存在或維護中');
    END IF;

    -- 3. 時段重疊防禦
    IF EXISTS (
        SELECT 1 FROM public.court_bookings
        WHERE court_id = p_court_id
          AND booking_date = p_booking_date
          AND status = 'booked'
          AND start_time < p_end_time
          AND end_time > p_start_time
    ) THEN
        RETURN jsonb_build_object('success', false, 'message', '您選擇的時段已被其他人預約，請重新選擇');
    END IF;

    -- 4. 會員身分對應 (Phone-only MVP)
    SELECT id INTO v_user_id FROM public.users WHERE phone = p_phone LIMIT 1;
    IF v_user_id IS NULL THEN
        INSERT INTO public.users (name, phone)
        VALUES (p_name, p_phone)
        RETURNING id INTO v_user_id;
    END IF;

    -- 5. 判斷平日或假日
    IF EXISTS (SELECT 1 FROM public.special_dates WHERE date = p_booking_date) THEN
        v_day_type := 'weekend';
    ELSIF EXTRACT(DOW FROM p_booking_date) IN (0, 6) THEN
        v_day_type := 'weekend';
    ELSE
        v_day_type := 'weekday';
    END IF;

    -- 6. 伺服器端授權定價與 30 分鐘切分迴圈
    v_current_time := p_start_time;
    WHILE v_current_time < p_end_time LOOP
        
        SELECT price INTO v_slot_price
        FROM public.pricing_rules
        WHERE day_type = v_day_type
          AND start_time <= v_current_time
          AND end_time > v_current_time
        LIMIT 1;

        IF v_slot_price IS NULL THEN
            v_slot_price := 250;
        END IF;

        INSERT INTO public.court_bookings (
            user_id, 
            court_id, 
            booking_date, 
            start_time, 
            end_time, 
            price, 
            status, 
            payment_status, 
            payment_method
        ) VALUES (
            v_user_id, 
            p_court_id, 
            p_booking_date, 
            v_current_time, 
            v_current_time + interval '30 minutes', 
            v_slot_price, 
            'booked', 
            'unpaid', 
            'onsite'
        ) RETURNING id INTO v_inserted_id;

        v_booking_ids := array_append(v_booking_ids, v_inserted_id);
        v_total_price := v_total_price + v_slot_price;

        v_current_time := v_current_time + interval '30 minutes';
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'message', '預約成功',
        'booking_ids', v_booking_ids,
        'price', v_total_price
    );
END;
$$;


ALTER FUNCTION "public"."secure_book_court_v2"("p_court_id" "uuid", "p_booking_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_name" "text", "p_phone" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."toggle_check_in"("p_table_name" "text", "p_booking_id" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_current_status boolean;
  v_new_status boolean;
begin
  -- 🛡️ 1. 嚴格驗證管理員身分 (基於 Supabase Auth JWT)
  IF (SELECT auth.uid()) IS NULL THEN
      RAISE EXCEPTION 'Unauthorized: authentication required.';
  END IF;

  IF NOT EXISTS (
      SELECT 1
      FROM public.admins
      WHERE auth_user_id = (SELECT auth.uid())
  ) THEN
      RAISE EXCEPTION 'Unauthorized: administrator access required.';
  END IF;

  -- 🛡️ 2. 驗證資料表白名單
  IF p_table_name NOT IN ('open_play_players', 'class_bookings', 'court_bookings') THEN
      RETURN jsonb_build_object('success', false, 'message', '無效的資料表');
  END IF;

  -- 🛡️ 3. 處理簽到邏輯 (徹底移除 Dynamic SQL，改用靜態安全分支與存在性檢查)
  IF p_table_name = 'open_play_players' THEN
      SELECT is_checked_in INTO v_current_status 
      FROM public.open_play_players 
      WHERE id::text = p_booking_id;
      
      IF NOT FOUND THEN
          RETURN jsonb_build_object('success', false, 'message', '找不到指定的預約紀錄');
      END IF;
      
      v_new_status := NOT coalesce(v_current_status, false);
      
      UPDATE public.open_play_players
      SET is_checked_in = v_new_status, updated_at = now()
      WHERE id::text = p_booking_id;

  ELSIF p_table_name = 'class_bookings' THEN
      SELECT is_checked_in INTO v_current_status 
      FROM public.class_bookings 
      WHERE id::text = p_booking_id;
      
      IF NOT FOUND THEN
          RETURN jsonb_build_object('success', false, 'message', '找不到指定的預約紀錄');
      END IF;
      
      v_new_status := NOT coalesce(v_current_status, false);
      
      UPDATE public.class_bookings
      SET is_checked_in = v_new_status, updated_at = now()
      WHERE id::text = p_booking_id;

  ELSIF p_table_name = 'court_bookings' THEN
      SELECT is_checked_in INTO v_current_status 
      FROM public.court_bookings 
      WHERE id::text = p_booking_id;
      
      IF NOT FOUND THEN
          RETURN jsonb_build_object('success', false, 'message', '找不到指定的預約紀錄');
      END IF;
      
      v_new_status := NOT coalesce(v_current_status, false);
      
      UPDATE public.court_bookings
      SET is_checked_in = v_new_status, updated_at = now()
      WHERE id::text = p_booking_id;
  END IF;

  RETURN jsonb_build_object(
      'success', true, 
      'message', '簽到狀態已更新',
      'is_checked_in', v_new_status
  );
end;
$$;


ALTER FUNCTION "public"."toggle_check_in"("p_table_name" "text", "p_booking_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_class"("p_class_id" "uuid", "p_title" "text", "p_coach" "text", "p_class_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_price" numeric, "p_max_players" integer, "p_court_id" "uuid", "p_notes" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_conflict text;
BEGIN
    v_conflict := public.check_court_has_conflict(ARRAY[p_court_id], p_class_date, p_start_time, p_end_time, 'class', p_class_id);
    IF v_conflict IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'message', v_conflict);
    END IF;

    UPDATE public.classes SET
        title = p_title,
        coach = p_coach,
        class_date = p_class_date,
        start_time = p_start_time,
        end_time = p_end_time,
        price = p_price,
        max_players = p_max_players,
        court_id = p_court_id,
        notes = p_notes
    WHERE id = p_class_id;

    RETURN jsonb_build_object('success', true, 'message', '課程修改成功');
END;
$$;


ALTER FUNCTION "public"."update_class"("p_class_id" "uuid", "p_title" "text", "p_coach" "text", "p_class_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_price" numeric, "p_max_players" integer, "p_court_id" "uuid", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_open_play_session"("p_session_id" "uuid", "p_title" "text", "p_level" "text", "p_session_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_price" numeric, "p_max_players" integer, "p_max_waitlist" integer, "p_court_ids" "uuid"[], "p_notes" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_conflict text;
BEGIN
    v_conflict := public.check_court_has_conflict(p_court_ids, p_session_date, p_start_time, p_end_time, 'open_play', p_session_id);
    IF v_conflict IS NOT NULL THEN
        RETURN jsonb_build_object('success', false, 'message', v_conflict);
    END IF;

    UPDATE public.open_play_sessions SET
        title = p_title,
        level = p_level,
        session_date = p_session_date,
        start_time = p_start_time,
        end_time = p_end_time,
        price = p_price,
        max_players = p_max_players,
        max_waitlist = p_max_waitlist,
        court_ids = p_court_ids,
        court_id = p_court_ids[1],
        notes = p_notes
    WHERE id = p_session_id;

    RETURN jsonb_build_object('success', true, 'message', '臨打場次修改成功');
END;
$$;


ALTER FUNCTION "public"."update_open_play_session"("p_session_id" "uuid", "p_title" "text", "p_level" "text", "p_session_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_price" numeric, "p_max_players" integer, "p_max_waitlist" integer, "p_court_ids" "uuid"[], "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_cancel_booking"("p_phone" "text", "p_table" "text", "p_target_ids" "text"[]) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $_$
DECLARE
    v_user_id uuid;
    v_session_id uuid;
    v_player_status text;
    v_next_id uuid;
    v_cancel_limit_hours integer := 0;
    v_setting_val text;
    v_event_date date;
    v_event_time time without time zone;
    v_event_ts timestamp without time zone;
BEGIN
    SELECT id INTO v_user_id FROM public.users WHERE phone = trim(p_phone) LIMIT 1;
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', '驗證失敗：手機號碼不存在');
    END IF;

    SELECT value INTO v_setting_val FROM public.settings WHERE key = 'cancel_limit_hours';
    IF v_setting_val ~ '^[0-9]+$' THEN
        v_cancel_limit_hours := v_setting_val::integer;
    END IF;

    IF p_table = 'open_play_players' THEN
        SELECT op.session_id, op.status, ops.session_date, ops.start_time
        INTO v_session_id, v_player_status, v_event_date, v_event_time
        FROM public.open_play_players op
        JOIN public.open_play_sessions ops ON op.session_id = ops.id
        WHERE op.id = p_target_ids[1]::uuid AND op.user_id = v_user_id;

        IF v_session_id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'message', '找不到此報名紀錄或您無權取消');
        END IF;

        IF v_cancel_limit_hours > 0 AND v_event_date IS NOT NULL AND v_event_time IS NOT NULL THEN
            v_event_ts := (v_event_date || ' ' || v_event_time)::timestamp;
            IF v_event_ts - clock_timestamp() < (v_cancel_limit_hours || ' hours')::interval THEN
                RETURN jsonb_build_object('success', false, 'message', '已逾最後取消期限 (開打前 ' || v_cancel_limit_hours || ' 小時內禁止取消)');
            END IF;
        END IF;

        UPDATE public.open_play_players
        SET status = 'cancelled'
        WHERE id = p_target_ids[1]::uuid;

        IF v_player_status = 'registered' THEN
            SELECT id INTO v_next_id
            FROM public.open_play_players
            WHERE session_id = v_session_id AND status = 'waitlisted'
            ORDER BY created_at ASC LIMIT 1;

            IF v_next_id IS NOT NULL THEN
                UPDATE public.open_play_players
                SET status = 'registered', created_at = clock_timestamp()
                WHERE id = v_next_id;
            END IF;
        END IF;

    ELSIF p_table = 'court_bookings' THEN
        SELECT cb.booking_date, cb.start_time
        INTO v_event_date, v_event_time
        FROM public.court_bookings cb
        WHERE cb.id::text = p_target_ids[1] AND cb.user_id = v_user_id;

        IF v_event_date IS NULL THEN
            RETURN jsonb_build_object('success', false, 'message', '找不到此預約或您無權取消');
        END IF;

        IF v_cancel_limit_hours > 0 AND v_event_date IS NOT NULL AND v_event_time IS NOT NULL THEN
            v_event_ts := (v_event_date || ' ' || v_event_time)::timestamp;
            IF v_event_ts - clock_timestamp() < (v_cancel_limit_hours || ' hours')::interval THEN
                RETURN jsonb_build_object('success', false, 'message', '已逾最後取消期限 (開打前 ' || v_cancel_limit_hours || ' 小時內禁止取消)');
            END IF;
        END IF;

        UPDATE public.court_bookings
        SET status = 'cancelled'
        WHERE id::text = ANY(p_target_ids) AND user_id = v_user_id;

    ELSIF p_table = 'class_bookings' THEN
        SELECT cls.class_date, cls.start_time
        INTO v_event_date, v_event_time
        FROM public.class_bookings clb
        JOIN public.classes cls ON clb.class_id = cls.id
        WHERE clb.id = p_target_ids[1]::uuid AND clb.user_id = v_user_id;

        IF v_event_date IS NULL THEN
            RETURN jsonb_build_object('success', false, 'message', '找不到此報名或您無權取消');
        END IF;

        IF v_cancel_limit_hours > 0 AND v_event_date IS NOT NULL AND v_event_time IS NOT NULL THEN
            v_event_ts := (v_event_date || ' ' || v_event_time)::timestamp;
            IF v_event_ts - clock_timestamp() < (v_cancel_limit_hours || ' hours')::interval THEN
                RETURN jsonb_build_object('success', false, 'message', '已逾最後取消期限 (開打前 ' || v_cancel_limit_hours || ' 小時內禁止取消)');
            END IF;
        END IF;

        UPDATE public.class_bookings
        SET status = 'cancelled'
        WHERE id = p_target_ids[1]::uuid AND user_id = v_user_id;
    END IF;

    RETURN jsonb_build_object('success', true, 'message', '預約已成功取消');
END;
$_$;


ALTER FUNCTION "public"."user_cancel_booking"("p_phone" "text", "p_table" "text", "p_target_ids" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_update_player_note"("p_phone" "text", "p_player_id" "uuid", "p_notes" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
DECLARE
    v_user_id uuid;
BEGIN
    SELECT id INTO v_user_id FROM public.users WHERE phone = trim(p_phone) LIMIT 1;
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', '驗證失敗：手機號碼不存在');
    END IF;

    UPDATE public.open_play_players
    SET player_notes = p_notes
    WHERE id = p_player_id AND user_id = v_user_id;

    RETURN jsonb_build_object('success', true, 'message', '備註更新成功');
END;
$$;


ALTER FUNCTION "public"."user_update_player_note"("p_phone" "text", "p_player_id" "uuid", "p_notes" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."admins" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "username" "text" NOT NULL,
    "password_hash" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "auth_user_id" "uuid"
);


ALTER TABLE "public"."admins" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."class_bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "class_id" "uuid",
    "user_id" "uuid",
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "need_paddle" boolean DEFAULT false,
    "notes" "text",
    "payment_method" "text" DEFAULT 'onsite'::"text",
    "payment_status" "text" DEFAULT 'unpaid'::"text",
    "is_checked_in" boolean DEFAULT false,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."class_bookings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."classes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "coach" "text" NOT NULL,
    "class_date" "date" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "description" "text",
    "price" integer NOT NULL,
    "max_players" integer NOT NULL,
    "registration_deadline" timestamp with time zone,
    "status" "text" DEFAULT 'open'::"text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "court_id" "uuid",
    "notes" "text"
);


ALTER TABLE "public"."classes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."court_bookings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "court_id" "uuid",
    "user_id" "uuid",
    "booking_date" "date" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "price" integer NOT NULL,
    "status" "text" DEFAULT 'booked'::"text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "cancelled_at" timestamp with time zone,
    "payment_method" "text" DEFAULT 'onsite'::"text",
    "payment_status" "text" DEFAULT 'unpaid'::"text",
    "is_checked_in" boolean DEFAULT false,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."court_bookings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."court_prices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "court_id" "uuid",
    "day_type" "text" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "price" integer NOT NULL
);


ALTER TABLE "public"."court_prices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."courts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "venue_id" "uuid",
    "name" "text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text"
);


ALTER TABLE "public"."courts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"())
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."open_play_players" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_id" "uuid",
    "user_id" "uuid",
    "status" "text" DEFAULT 'active'::"text",
    "queue_number" integer,
    "registered_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "cancelled_at" timestamp with time zone,
    "promoted_at" timestamp with time zone,
    "player_notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "payment_method" "text" DEFAULT 'onsite'::"text",
    "payment_status" "text" DEFAULT 'unpaid'::"text",
    "is_checked_in" boolean DEFAULT false,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."open_play_players" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."open_play_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "court_id" "uuid",
    "session_date" "date" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "title" "text" NOT NULL,
    "level" "text" NOT NULL,
    "dupr_min" numeric,
    "price" integer NOT NULL,
    "max_players" integer DEFAULT 8,
    "max_waitlist" integer DEFAULT 2,
    "registration_deadline" timestamp with time zone,
    "status" "text" DEFAULT 'open'::"text",
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "notes" "text",
    "court_ids" "uuid"[] DEFAULT '{}'::"uuid"[]
);


ALTER TABLE "public"."open_play_sessions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pricing_rules" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "day_type" "text" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "price" integer DEFAULT 250 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."pricing_rules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."settings" (
    "key" "text" NOT NULL,
    "value" "text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."special_dates" (
    "date" "date" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."special_dates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "phone" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"())
);


ALTER TABLE "public"."users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."venues" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "notice" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"())
);


ALTER TABLE "public"."venues" OWNER TO "postgres";


ALTER TABLE ONLY "public"."admins"
    ADD CONSTRAINT "admins_auth_user_id_key" UNIQUE ("auth_user_id");



ALTER TABLE ONLY "public"."admins"
    ADD CONSTRAINT "admins_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admins"
    ADD CONSTRAINT "admins_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."class_bookings"
    ADD CONSTRAINT "class_bookings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."classes"
    ADD CONSTRAINT "classes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."court_bookings"
    ADD CONSTRAINT "court_bookings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."court_prices"
    ADD CONSTRAINT "court_prices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."courts"
    ADD CONSTRAINT "courts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."open_play_players"
    ADD CONSTRAINT "open_play_players_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."open_play_players"
    ADD CONSTRAINT "open_play_players_session_id_user_id_key" UNIQUE ("session_id", "user_id");



ALTER TABLE ONLY "public"."open_play_sessions"
    ADD CONSTRAINT "open_play_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pricing_rules"
    ADD CONSTRAINT "pricing_rules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."settings"
    ADD CONSTRAINT "settings_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."special_dates"
    ADD CONSTRAINT "special_dates_pkey" PRIMARY KEY ("date");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_phone_key" UNIQUE ("phone");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."venues"
    ADD CONSTRAINT "venues_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admins"
    ADD CONSTRAINT "admins_auth_user_id_fkey" FOREIGN KEY ("auth_user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."class_bookings"
    ADD CONSTRAINT "class_bookings_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "public"."classes"("id");



ALTER TABLE ONLY "public"."class_bookings"
    ADD CONSTRAINT "class_bookings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."classes"
    ADD CONSTRAINT "classes_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "public"."courts"("id");



ALTER TABLE ONLY "public"."court_bookings"
    ADD CONSTRAINT "court_bookings_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "public"."courts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."court_bookings"
    ADD CONSTRAINT "court_bookings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."court_prices"
    ADD CONSTRAINT "court_prices_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "public"."courts"("id");



ALTER TABLE ONLY "public"."courts"
    ADD CONSTRAINT "courts_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "public"."venues"("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."open_play_players"
    ADD CONSTRAINT "open_play_players_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."open_play_sessions"("id");



ALTER TABLE ONLY "public"."open_play_players"
    ADD CONSTRAINT "open_play_players_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."open_play_sessions"
    ADD CONSTRAINT "open_play_sessions_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "public"."courts"("id");



CREATE POLICY "Admin delete class_bookings" ON "public"."class_bookings" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Admin delete open_play_players" ON "public"."open_play_players" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "Admin manage class_bookings" ON "public"."class_bookings" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Admin manage classes" ON "public"."classes" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Admin manage open_play_players" ON "public"."open_play_players" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Admin manage open_play_sessions" ON "public"."open_play_sessions" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Admin manage pricing_rules" ON "public"."pricing_rules" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Admin manage special_dates" ON "public"."special_dates" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Admin select class_bookings" ON "public"."class_bookings" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Admin select court_bookings" ON "public"."court_bookings" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Admin select open_play_players" ON "public"."open_play_players" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Admin select users" ON "public"."users" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Admin update court_bookings" ON "public"."court_bookings" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Allow public all access on settings" ON "public"."settings" USING (true) WITH CHECK (true);



CREATE POLICY "Allow public read class_bookings" ON "public"."class_bookings" FOR SELECT USING (true);



CREATE POLICY "Allow public read classes" ON "public"."classes" FOR SELECT USING (true);



CREATE POLICY "Allow public read court_bookings" ON "public"."court_bookings" FOR SELECT USING (true);



CREATE POLICY "Allow public read courts" ON "public"."courts" FOR SELECT USING (true);



CREATE POLICY "Allow public read on pricing_rules" ON "public"."pricing_rules" FOR SELECT USING (true);



CREATE POLICY "Allow public read open_play_players" ON "public"."open_play_players" FOR SELECT USING (true);



CREATE POLICY "Allow public read open_play_sessions" ON "public"."open_play_sessions" FOR SELECT USING (true);



CREATE POLICY "Allow public read venues" ON "public"."venues" FOR SELECT USING (true);



CREATE POLICY "Allow public read-only access on settings" ON "public"."settings" FOR SELECT USING (true);



CREATE POLICY "Public read classes" ON "public"."classes" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Public read courts" ON "public"."courts" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Public read pricing_rules" ON "public"."pricing_rules" FOR SELECT TO "authenticated", "anon" USING (true);



CREATE POLICY "Public read special_dates" ON "public"."special_dates" FOR SELECT TO "authenticated", "anon" USING (true);



ALTER TABLE "public"."admins" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."class_bookings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."classes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."court_bookings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."court_prices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."courts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."open_play_players" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."open_play_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pricing_rules" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."special_dates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."venues" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."admin_register_open_play"("p_session_id" "uuid", "p_name" "text", "p_phone" "text", "p_status" "text", "p_payment_method" "text", "p_payment_status" "text", "p_player_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."admin_register_open_play"("p_session_id" "uuid", "p_name" "text", "p_phone" "text", "p_status" "text", "p_payment_method" "text", "p_payment_status" "text", "p_player_notes" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."book_court"("p_court_id" bigint, "p_booking_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_name" "text", "p_phone" "text", "p_price" integer, "p_payment_method" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."book_court"("p_court_id" bigint, "p_booking_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_name" "text", "p_phone" "text", "p_price" integer, "p_payment_method" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."book_court_batch"("p_court_id" "uuid", "p_booking_date" "date", "p_slots" "text"[], "p_name" "text", "p_phone" "text", "p_price_per_slot" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."book_court_batch"("p_court_id" "uuid", "p_booking_date" "date", "p_slots" "text"[], "p_name" "text", "p_phone" "text", "p_price_per_slot" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."book_court_batch"("p_court_id" "uuid", "p_booking_date" "date", "p_slots" "text"[], "p_name" "text", "p_phone" "text", "p_price_per_slot" integer) TO "service_role";



REVOKE ALL ON FUNCTION "public"."book_court_batch_dynamic"("p_name" "text", "p_phone" "text", "p_court_id" "uuid", "p_booking_date" "date", "p_slots_data" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."book_court_batch_dynamic"("p_name" "text", "p_phone" "text", "p_court_id" "uuid", "p_booking_date" "date", "p_slots_data" "jsonb") TO "service_role";



REVOKE ALL ON FUNCTION "public"."cancel_open_play_booking"("p_booking_id" bigint, "p_phone" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."cancel_open_play_booking"("p_booking_id" bigint, "p_phone" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_open_play_session"("p_title" "text", "p_level" "text", "p_session_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_price" integer, "p_max_players" integer, "p_max_waitlist" integer, "p_court_ids" "uuid"[], "p_notes" "text", "p_admin_username" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_open_play_session"("p_title" "text", "p_level" "text", "p_session_date" "date", "p_start_time" time without time zone, "p_end_time" time without time zone, "p_price" integer, "p_max_players" integer, "p_max_waitlist" integer, "p_court_ids" "uuid"[], "p_notes" "text", "p_admin_username" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."register_class"("p_class_id" "uuid", "p_name" "text", "p_phone" "text", "p_notes" "text", "p_need_paddle" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."register_class"("p_class_id" "uuid", "p_name" "text", "p_phone" "text", "p_notes" "text", "p_need_paddle" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."register_class"("p_class_id" "uuid", "p_name" "text", "p_phone" "text", "p_notes" "text", "p_need_paddle" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."register_class_booking"("p_class_id" bigint, "p_name" "text", "p_phone" "text", "p_need_paddle" boolean, "p_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."register_class_booking"("p_class_id" bigint, "p_name" "text", "p_phone" "text", "p_need_paddle" boolean, "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."register_open_play"("p_session_id" "uuid", "p_name" "text", "p_phone" "text", "p_player_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."register_open_play"("p_session_id" "uuid", "p_name" "text", "p_phone" "text", "p_player_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."register_open_play"("p_session_id" "uuid", "p_name" "text", "p_phone" "text", "p_player_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."register_open_play"("p_session_id" "uuid", "p_name" "text", "p_phone" "text", "p_notes" "text", "p_need_paddle" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."register_open_play"("p_session_id" "uuid", "p_name" "text", "p_phone" "text", "p_notes" "text", "p_need_paddle" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."register_open_play"("p_session_id" "uuid", "p_name" "text", "p_phone" "text", "p_notes" "text", "p_need_paddle" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."toggle_check_in"("p_table_name" "text", "p_booking_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."toggle_check_in"("p_table_name" "text", "p_booking_id" "text") TO "service_role";



GRANT ALL ON TABLE "public"."admins" TO "anon";
GRANT ALL ON TABLE "public"."admins" TO "authenticated";
GRANT ALL ON TABLE "public"."admins" TO "service_role";



GRANT ALL ON TABLE "public"."class_bookings" TO "anon";
GRANT ALL ON TABLE "public"."class_bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."class_bookings" TO "service_role";



GRANT ALL ON TABLE "public"."classes" TO "anon";
GRANT ALL ON TABLE "public"."classes" TO "authenticated";
GRANT ALL ON TABLE "public"."classes" TO "service_role";



GRANT ALL ON TABLE "public"."court_bookings" TO "anon";
GRANT ALL ON TABLE "public"."court_bookings" TO "authenticated";
GRANT ALL ON TABLE "public"."court_bookings" TO "service_role";



GRANT ALL ON TABLE "public"."court_prices" TO "anon";
GRANT ALL ON TABLE "public"."court_prices" TO "authenticated";
GRANT ALL ON TABLE "public"."court_prices" TO "service_role";



GRANT ALL ON TABLE "public"."courts" TO "anon";
GRANT ALL ON TABLE "public"."courts" TO "authenticated";
GRANT ALL ON TABLE "public"."courts" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."open_play_players" TO "anon";
GRANT ALL ON TABLE "public"."open_play_players" TO "authenticated";
GRANT ALL ON TABLE "public"."open_play_players" TO "service_role";



GRANT ALL ON TABLE "public"."open_play_sessions" TO "anon";
GRANT ALL ON TABLE "public"."open_play_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."open_play_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."pricing_rules" TO "anon";
GRANT ALL ON TABLE "public"."pricing_rules" TO "authenticated";
GRANT ALL ON TABLE "public"."pricing_rules" TO "service_role";



GRANT ALL ON TABLE "public"."settings" TO "anon";
GRANT ALL ON TABLE "public"."settings" TO "authenticated";
GRANT ALL ON TABLE "public"."settings" TO "service_role";



GRANT ALL ON TABLE "public"."special_dates" TO "anon";
GRANT ALL ON TABLE "public"."special_dates" TO "authenticated";
GRANT ALL ON TABLE "public"."special_dates" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."venues" TO "anon";
GRANT ALL ON TABLE "public"."venues" TO "authenticated";
GRANT ALL ON TABLE "public"."venues" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";








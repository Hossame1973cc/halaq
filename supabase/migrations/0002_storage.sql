-- =============================================================================
-- Halaq — تخزين صور الصالونات (Supabase Storage)
-- الصور بتتحفظ في bucket اسمه shop-media جوه فولدر باسم الـ shop id
-- =============================================================================

insert into storage.buckets (id, name, public)
values ('shop-media', 'shop-media', true)
on conflict (id) do nothing;

drop policy if exists "shop media public read" on storage.objects;
create policy "shop media public read" on storage.objects for select
  using (bucket_id = 'shop-media');

drop policy if exists "shop media admin insert" on storage.objects;
create policy "shop media admin insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'shop-media'
              and public.is_shop_admin(((storage.foldername(name))[1])::uuid));

drop policy if exists "shop media admin update" on storage.objects;
create policy "shop media admin update" on storage.objects for update to authenticated
  using (bucket_id = 'shop-media'
         and public.is_shop_admin(((storage.foldername(name))[1])::uuid));

drop policy if exists "shop media admin delete" on storage.objects;
create policy "shop media admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'shop-media'
         and public.is_shop_admin(((storage.foldername(name))[1])::uuid));

-- Upserts (upload with replace, used by "Optimise all images") need a SELECT policy as well as INSERT/UPDATE.
create policy "product-images: admin select" on storage.objects for select to authenticated
  using (bucket_id = 'product-images' and public.is_admin());

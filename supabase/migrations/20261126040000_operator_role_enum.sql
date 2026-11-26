-- New staff role: operator (can only add members and add products; never delete). Separate migration:
-- a new enum value cannot be used in the transaction that adds it.
alter type public.user_role add value if not exists 'operator';

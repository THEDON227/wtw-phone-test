# WTW Supabase RLS Policy Notes

## Guiding principle
- Public users should be able to create requests.
- Only published discovery content should be readable publicly.
- Admin edits should remain protected.
- Never expose the service role key in the browser.

## Suggested table access model

### users
- `SELECT` and `UPDATE` own row using `auth.uid()`.
- `INSERT` should happen through auth-triggered onboarding or an admin workflow.

### events / venues
- `SELECT` public rows where `status = 'published'`.
- `INSERT`, `UPDATE`, `DELETE` restricted to admin/service role.

### reservation_requests / ticket_requests / guest_list_requests / partner_applications / wave_pass_requests
- `INSERT` allowed for anon and authenticated users if the form is public.
- `SELECT` only for admins or staff.
- `UPDATE` only for admins or staff.

## Example policy patterns
- `create policy "public can read published events" on public.events for select using (status = 'published');`
- `create policy "public can create reservation requests" on public.reservation_requests for insert with check (true);`
- `create policy "admins can read reservation requests" on public.reservation_requests for select using (auth.role() = 'authenticated');` or a dedicated admin helper function.

## Admin access recommendation
- Create a dedicated helper function such as `is_admin()` that checks a claim or the `users.role` field.
- Use that helper in update/read policies for the admin dashboard.
- Keep admin reads separate from public content reads.

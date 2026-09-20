# Shared Supabase setup

The admin and PWA apps already read the same Supabase project URL and
publishable key from their local environment files. Before enabling production
admin data, add the database migrations here and create the first admin user.

The Supabase secret key belongs only in `apps/admin/.env.local` and Vercel's
server environment. It must not be committed or used by the PWA.

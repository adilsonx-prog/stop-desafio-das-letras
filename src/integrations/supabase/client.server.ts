
import { createServerClient, parseCookieHeader, serializeCookieHeader } from '@supabase/ssr';
import type { Database } from './types';

export function createSupabaseServerClient(request: Request) {
  const headers = new Headers();

  const SUPABASE_URL = 'https://xtskxkzkbuvwxkbeszlm.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_CSqU9pWxQUJNxUfPEhAYDg_XEKVoT_t';

  const supabase = createServerClient<Database>(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return parseCookieHeader(request.headers.get('Cookie') ?? '');
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            headers.append('Set-Cookie', serializeCookieHeader(name, value, options))
          );
        },
      },
    }
  );

  return { supabase, headers };
}

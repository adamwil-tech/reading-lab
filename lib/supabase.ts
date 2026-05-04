import { createBrowserClient } from '@supabase/ssr'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// ============================================================
// TYPES
// These match the tables in your word_study_schema.sql exactly.
// Add more as you build out the app.
// ============================================================

export type AccountType = 'teacher' | 'tutor' | 'parent'
export type AppId = 'word_study' | 'cico' | 'writing_tool'
export type AttemptType = 'read' | 'spell'
export type MasteryType = 'read' | 'spell'
export type SubscriptionStatus = 'active' | 'inactive' | 'trial'

export type Account = {
  id: string
  email: string
  full_name: string | null
  account_type: AccountType
  created_at: string
  updated_at: string
}

export type Student = {
  id: string
  account_id: string
  username: string
  pin_hash: string
  display_name: string | null
  avatar_id: string | null
  created_at: string
  updated_at: string
}

export type Word = {
  id: string
  word_list_id: string
  word: string
  tier: string | null
  position: number | null
  is_high_frequency: boolean
  is_irregular_orthography: boolean
  has_both_tags: boolean
  notes: string | null
  audio_hint: string | null
  sheet_row: number | null
  imported_at: string | null
  created_at: string
  updated_at: string
}

export type Attempt = {
  id: string
  student_id: string
  word_id: string
  attempt_type: AttemptType
  is_correct: boolean
  session_date: string
  attempted_at: string
}

export type Mastery = {
  id: string
  student_id: string
  word_id: string
  mastery_type: MasteryType
  achieved_at: string
}

export type Subscription = {
  id: string
  account_id: string
  app_id: AppId
  status: SubscriptionStatus
  started_at: string
  expires_at: string | null
  created_at: string
}

// ============================================================
// DATABASE TYPE MAP
// Tells TypeScript the shape of every table so you get
// autocomplete and type checking on all Supabase queries.
// ============================================================

export type Database = {
  public: {
    Tables: {
      accounts: {
        Row: Account
        Insert: Omit<Account, 'created_at' | 'updated_at'>
        Update: Partial<Omit<Account, 'id' | 'created_at'>>
      }
      students: {
        Row: Student
        Insert: Omit<Student, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Student, 'id' | 'account_id' | 'created_at'>>
      }
      words: {
        Row: Word
        Insert: Omit<Word, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Word, 'id' | 'created_at'>>
      }
      attempts: {
        Row: Attempt
        Insert: Omit<Attempt, 'id' | 'attempted_at'>
        Update: never // attempts are immutable once written
      }
      mastery: {
        Row: Mastery
        Insert: Omit<Mastery, 'id' | 'achieved_at'>
        Update: never // mastery records are immutable
      }
      subscriptions: {
        Row: Subscription
        Insert: Omit<Subscription, 'id' | 'started_at' | 'created_at'>
        Update: Partial<Pick<Subscription, 'status' | 'expires_at'>>
      }
    }
    Functions: {
      check_and_award_mastery: {
        Args: {
          p_student_id: string
          p_word_id: string
          p_type: MasteryType
        }
        Returns: boolean
      }
      get_next_word: {
        Args: {
          p_student_id: string
          p_type: AttemptType
        }
        Returns: {
          word_id: string
          word: string
          tier: string | null
          notes: string | null
          audio_hint: string | null
        }[]
      }
    }
  }
}

// ============================================================
// BROWSER CLIENT
// Use this in Client Components (files with 'use client').
// Creates one shared instance — safe to call multiple times.
// ============================================================

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// ============================================================
// SERVER CLIENT
// Use this in Server Components, Server Actions, and Route
// Handlers. Reads and writes cookies for session management.
//
// Usage in a Server Component:
//   const supabase = await createServerSupabaseClient()
//   const { data } = await supabase.from('accounts').select()
// ============================================================

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll called from a Server Component — cookies can't
            // be set here, but the session will still be readable.
          }
        },
      },
    }
  )
}

// ============================================================
// MIDDLEWARE CLIENT
// Use this only in middleware.ts at the project root.
// Keeps the user session alive across page navigations.
//
// Usage in middleware.ts:
//   import { createMiddlewareSupabaseClient } from '@/lib/supabase'
// ============================================================

export function createMiddlewareSupabaseClient(
  request: Request,
  response: Response
) {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return Object.entries(
            Object.fromEntries(
              new Headers(request.headers).get('cookie')
                ?.split(';')
                .map(c => c.trim().split('=').map(decodeURIComponent))
                .filter(([k]) => k) ?? []
            )
          ).map(([name, value]) => ({ name, value }))
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            new Headers(response.headers).append(
              'Set-Cookie',
              `${name}=${value}; Path=${options?.path ?? '/'}; SameSite=Lax`
            )
          })
        },
      },
    }
  )
}

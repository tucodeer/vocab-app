'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/utils/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import { Toaster, toast } from 'sonner'
import {
  BookOpen, Layers, BarChart3, Users, Plus, Shuffle, Trash2, LogOut, CheckCircle2,
  RotateCcw, Volume2, Sparkles, Moon, Sun, HelpCircle, Keyboard, Flame, Mic,
  Headphones, AlertTriangle, MessageSquare, Search, X, Loader2, Eye, ArrowRight,
} from 'lucide-react'

/* ───────────────────────────── Types ───────────────────────────── */

interface Vocab {
  id: string
  user_id?: string
  word: string
  meaning: string
  part_of_speech?: string
  example?: string
  collocations?: string
  next_review_at?: string
  interval_days?: number
  wrong_count?: number
  review_count?: number
  created_at: string
}

interface DraftItem {
  word: string
  meaning: string
  pos: string
  example: string
  collocations: string
}

interface StudentAccount {
  id: string
  email: string
}

type Page = 'words' | 'study' | 'progress' | 'class'
type StudyMode = 'flashcard' | 'quiz' | 'spelling' | 'dictation' | 'speaking'
type TimeFilter = 'srs' | 'leech' | 'today' | 'week' | 'all'
type Rating = 'hard' | 'good' | 'easy' | 'wrong'
type AnswerStatus = 'idle' | 'correct' | 'wrong' | 'revealed'

/* ───────────────────────────── Constants & helpers ───────────────────────────── */

// LƯU Ý: Đây chỉ dùng để ẩn/hiện giao diện. Quyền thật phải được chặn bằng RLS trên Supabase.
const TEACHER_EMAIL = 'tujhoang1202@gmail.com'
const INTERNAL_DOMAIN = '@vocab.local'

const toAuthId = (input: string) => {
  const clean = input.trim().toLowerCase().replace(/\s+/g, '')
  return clean.includes('@') ? clean : `${clean}${INTERNAL_DOMAIN}`
}
const displayName = (email?: string) => (email ?? '').replace(INTERNAL_DOMAIN, '')

const dayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const shuffle = <T,>(arr: T[]) => [...arr].sort(() => Math.random() - 0.5)
const isDue = (v: Vocab) => !v.next_review_at || new Date(v.next_review_at) <= new Date()
const isMastered = (v: Vocab) => (v.interval_days || 0) >= 4

const STUDY_MODES: { id: StudyMode; label: string; desc: string; icon: typeof Layers }[] = [
  { id: 'flashcard', label: 'Flashcard', desc: 'Lật thẻ & tự đánh giá', icon: Layers },
  { id: 'quiz', label: 'Trắc nghiệm', desc: 'Chọn nghĩa đúng', icon: HelpCircle },
  { id: 'spelling', label: 'Chính tả', desc: 'Xem nghĩa, gõ từ', icon: Keyboard },
  { id: 'dictation', label: 'Nghe chép', desc: 'Nghe và gõ lại', icon: Headphones },
  { id: 'speaking', label: 'Phát âm', desc: 'Đọc to bằng micro', icon: Mic },
]

const TIME_FILTERS: { id: TimeFilter; label: string }[] = [
  { id: 'srs', label: 'Đến hạn ôn' },
  { id: 'leech', label: 'Hay sai' },
  { id: 'today', label: 'Hôm nay' },
  { id: 'week', label: '7 ngày' },
  { id: 'all', label: 'Tất cả' },
]

/* ───────────────────────────── Design tokens ───────────────────────────── */

const ui = {
  field:
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500',
  card: 'rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900',
  label: 'text-xs font-medium text-slate-500 dark:text-slate-400',
  muted: 'text-slate-500 dark:text-slate-400',
}

/* ───────────────────────────── UI primitives ───────────────────────────── */

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

function Button({
  variant = 'primary', loading, icon: Icon, className = '', children, ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant
  loading?: boolean
  icon?: typeof Plus
}) {
  const styles: Record<BtnVariant, string> = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm',
    secondary:
      'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800',
    ghost: 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
    danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
  }
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon ? <Icon className="h-4 w-4" /> : null}
      {children}
    </button>
  )
}

function Card({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <div className={`${ui.card} ${className}`}>{children}</div>
}

function Badge({
  tone = 'slate', children,
}: { tone?: 'slate' | 'indigo' | 'emerald' | 'amber' | 'red'; children: React.ReactNode }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    indigo: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300',
    emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    red: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  }
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  )
}

function StatCard({
  label, value, hint, icon: Icon, tone = 'indigo',
}: {
  label: string
  value: React.ReactNode
  hint?: string
  icon: typeof Flame
  tone?: 'indigo' | 'emerald' | 'amber' | 'red'
}) {
  const tones = {
    indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
    red: 'bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300',
  }
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className={ui.label}>{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
          {hint && <p className={`mt-1 text-xs ${ui.muted}`}>{hint}</p>}
        </div>
        <div className={`rounded-lg p-2 ${tones[tone]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </Card>
  )
}

function EmptyState({
  icon: Icon, title, description, action,
}: { icon: typeof BookOpen; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 rounded-full bg-slate-100 p-3 text-slate-400 dark:bg-slate-800">
        <Icon className="h-6 w-6" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      {description && <p className={`mt-1 max-w-sm text-sm ${ui.muted}`}>{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

function PageHeader({
  title, description, actions,
}: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className={`mt-1 text-sm ${ui.muted}`}>{description}</p>}
      </div>
      {actions}
    </div>
  )
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-slate-200 dark:bg-slate-800 ${className}`} />
}

function ConfirmDialog({
  open, title, description, confirmLabel = 'Xoá', onConfirm, onCancel,
}: {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
          onClick={onCancel}
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            initial={{ scale: 0.96, y: 8 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.96, y: 8 }}
            onClick={e => e.stopPropagation()}
            className={`${ui.card} w-full max-w-sm p-6 shadow-xl`}
          >
            <h3 className="text-base font-semibold">{title}</h3>
            <p className={`mt-2 text-sm ${ui.muted}`}>{description}</p>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={onCancel}>Huỷ</Button>
              <Button variant="danger" onClick={onConfirm}>{confirmLabel}</Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function Segmented<T extends string>({
  value, options, onChange,
}: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
      {options.map(o => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 ${
            value === o.id
              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white'
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function Logo({ small }: { small?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className={`flex items-center justify-center rounded-lg bg-indigo-600 text-white ${small ? 'h-8 w-8' : 'h-9 w-9'}`}>
        <BookOpen className="h-4 w-4" />
      </div>
      <span className="text-base font-semibold tracking-tight">VocabDaily</span>
    </div>
  )
}

/* ───────────────────────────── Main component ───────────────────────────── */

function VocabAppInner() {
  /* Auth */
  const [user, setUser] = useState<any>(null)
  const [authReady, setAuthReady] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const isTeacher = user?.email === TEACHER_EMAIL

  /* Data */
  const [vocabs, setVocabs] = useState<Vocab[]>([])
  const [classVocabs, setClassVocabs] = useState<Vocab[]>([])
  const [accounts, setAccounts] = useState<Record<string, string>>({})
  const [loadingData, setLoadingData] = useState(true)
  const [page, setPage] = useState<Page>('words')

  /* Add words */
  const [wordsInput, setWordsInput] = useState('')
  const [draftItems, setDraftItems] = useState<DraftItem[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Vocab | null>(null)

  /* Study */
  const [studyMode, setStudyMode] = useState<StudyMode>('flashcard')
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('srs')
  const [studyQueue, setStudyQueue] = useState<Vocab[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [quizOptions, setQuizOptions] = useState<string[]>([])
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [textInput, setTextInput] = useState('')
  const [answerStatus, setAnswerStatus] = useState<AnswerStatus>('idle')
  const [score, setScore] = useState(0)
  const [isListening, setIsListening] = useState(false)
  const [spokenText, setSpokenText] = useState('')
  const [speechResult, setSpeechResult] = useState<'idle' | 'pass' | 'fail'>('idle')
  const [answered, setAnswered] = useState(false)

  /* Gamification & story */
  const [streak, setStreak] = useState(0)
  const [todayReviewed, setTodayReviewed] = useState(0)
  const [storyData, setStoryData] = useState<{ storyEn: string; storyVi: string } | null>(null)
  const [isGeneratingStory, setIsGeneratingStory] = useState(false)

  /* Class view */
  const [studentSearch, setStudentSearch] = useState('')

  /* ───── Effects ───── */

  useEffect(() => {
    const saved = localStorage.getItem('vocab-dark-mode')
    if (saved === 'true') setDarkMode(true)

    const today = dayKey()
    const last = localStorage.getItem('vocab-last-study')
    const savedStreak = Number(localStorage.getItem('vocab-streak') || '0')
    setTodayReviewed(Number(localStorage.getItem(`vocab-count-${today}`) || '0'))
    if (last) {
      const diff = Math.round((new Date(today).getTime() - new Date(last).getTime()) / 86400000)
      setStreak(diff <= 1 ? savedStreak : 0)
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setAuthReady(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  const fetchVocabs = useCallback(async () => {
    if (!user) return
    setLoadingData(true)
    const { data, error } = await supabase
      .from('vocabularies')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    if (error) toast.error('Không tải được sổ từ vựng')
    else setVocabs(data ?? [])

    if (user.email === TEACHER_EMAIL) {
      const [{ data: all }, { data: accs }] = await Promise.all([
        supabase.from('vocabularies').select('*').order('created_at', { ascending: false }),
        supabase.from('student_accounts').select('id,email'),
      ])
      setClassVocabs(all ?? [])
      const map: Record<string, string> = {}
      ;(accs as StudentAccount[] | null)?.forEach(a => { map[a.id] = a.email })
      setAccounts(map)
    }
    setLoadingData(false)
  }, [user])

  useEffect(() => {
    if (user) fetchVocabs()
    else {
      setVocabs([])
      setClassVocabs([])
    }
  }, [user, fetchVocabs])

  /* ───── Derived ───── */

  const dueCount = useMemo(() => vocabs.filter(isDue).length, [vocabs])
  const masteredCount = useMemo(() => vocabs.filter(isMastered).length, [vocabs])
  const leechWords = useMemo(
    () => vocabs.filter(v => (v.wrong_count || 0) > 0).sort((a, b) => (b.wrong_count || 0) - (a.wrong_count || 0)),
    [vocabs]
  )

  const filteredStudy = useMemo(() => {
    const now = new Date()
    return vocabs.filter(v => {
      if (timeFilter === 'srs') return isDue(v)
      if (timeFilter === 'leech') return (v.wrong_count || 0) > 0
      if (timeFilter === 'all') return true
      const created = new Date(v.created_at)
      if (timeFilter === 'today') return created.toDateString() === now.toDateString()
      return (now.getTime() - created.getTime()) / 86400000 <= 7
    })
  }, [vocabs, timeFilter])

  const searchedVocabs = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return vocabs
    return vocabs.filter(v => v.word.toLowerCase().includes(q) || v.meaning.toLowerCase().includes(q))
  }, [vocabs, search])

  const groupedByDate = useMemo(() => {
    return searchedVocabs.reduce((acc: Record<string, Vocab[]>, item) => {
      const key = new Date(item.created_at).toLocaleDateString('vi-VN', {
        weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
      })
      ;(acc[key] ||= []).push(item)
      return acc
    }, {})
  }, [searchedVocabs])

  const last7Days = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (6 - i))
      return { key: dayKey(d), label: d.toLocaleDateString('vi-VN', { weekday: 'short' }), count: 0 }
    })
    vocabs.forEach(v => {
      const k = dayKey(new Date(v.created_at))
      const slot = days.find(d => d.key === k)
      if (slot) slot.count += 1
    })
    return days
  }, [vocabs])

  const students = useMemo(() => {
    const byUser: Record<string, Vocab[]> = {}
    classVocabs.forEach(v => {
      if (!v.user_id || v.user_id === user?.id) return
      ;(byUser[v.user_id] ||= []).push(v)
    })
    return Object.entries(byUser)
      .map(([id, list]) => ({
        id,
        name: displayName(accounts[id]) || `Học sinh ${id.slice(0, 6)}`,
        total: list.length,
        mastered: list.filter(isMastered).length,
        reviews: list.reduce((s, v) => s + (v.review_count || 0), 0),
        leech: list.filter(v => (v.wrong_count || 0) > 0).length,
        topWrong: [...list].filter(v => (v.wrong_count || 0) > 0).sort((a, b) => (b.wrong_count || 0) - (a.wrong_count || 0)).slice(0, 3),
        last: list.reduce((m, v) => (v.created_at > m ? v.created_at : m), list[0].created_at),
      }))
      .filter(s => s.name.toLowerCase().includes(studentSearch.trim().toLowerCase()))
      .sort((a, b) => b.reviews - a.reviews)
  }, [classVocabs, accounts, user, studentSearch])

  /* ───── Actions ───── */

  const toggleDarkMode = () => {
    const next = !darkMode
    setDarkMode(next)
    localStorage.setItem('vocab-dark-mode', String(next))
  }

  const speakText = (text: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(text)
      u.lang = 'en-US'
      u.rate = 0.9
      window.speechSynthesis.speak(u)
    }
  }

  const recordStudyActivity = () => {
    const today = dayKey()
    const last = localStorage.getItem('vocab-last-study')
    const saved = Number(localStorage.getItem('vocab-streak') || '0')
    let next = saved
    if (last !== today) {
      const diff = last ? Math.round((new Date(today).getTime() - new Date(last).getTime()) / 86400000) : 99
      next = diff === 1 ? saved + 1 : 1
      localStorage.setItem('vocab-streak', String(next))
      localStorage.setItem('vocab-last-study', today)
      setStreak(next)
    }
    const count = todayReviewed + 1
    setTodayReviewed(count)
    localStorage.setItem(`vocab-count-${today}`, String(count))
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthLoading(true)
    const authId = toAuthId(username)

    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({ email: authId, password })
      if (error) {
        toast.error(error.message.includes('already registered') ? 'Tên đăng nhập đã được sử dụng' : `Không thể tạo tài khoản: ${error.message}`)
      } else {
        if (data.user) {
          // Chỉ lưu tên hiển thị. KHÔNG lưu mật khẩu ở bất kỳ đâu.
          await supabase.from('student_accounts').upsert({ id: data.user.id, email: displayName(authId) })
        }
        if (!data.session) await supabase.auth.signInWithPassword({ email: authId, password })
        toast.success('Tạo tài khoản thành công')
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: authId, password })
      if (error) toast.error('Sai tên đăng nhập hoặc mật khẩu')
    }
    setAuthLoading(false)
  }

  const handleAnalyzeWords = async () => {
    const lines = wordsInput.split('\n').map(w => w.trim()).filter(Boolean)
    if (lines.length === 0) return toast.error('Hãy nhập ít nhất 1 từ tiếng Anh')

    setIsAnalyzing(true)
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words: lines }),
      })
      const data = await res.json()
      if (data.results) {
        setDraftItems(
          lines.map((w, i) => ({
            word: w,
            meaning: data.results[i]?.meaning || '',
            pos: data.results[i]?.pos || '',
            example: data.results[i]?.example || '',
            collocations: data.results[i]?.collocations || '',
          }))
        )
      } else toast.error('Không nhận được kết quả phân tích')
    } catch {
      toast.error('Lỗi kết nối, vui lòng thử lại')
    }
    setIsAnalyzing(false)
  }

  const updateDraft = (index: number, field: keyof DraftItem, value: string) =>
    setDraftItems(items => items.map((it, i) => (i === index ? { ...it, [field]: value } : it)))

  const handleSaveVocabs = async () => {
    const valid = draftItems.filter(i => i.word.trim() && i.meaning.trim())
    if (valid.length === 0) return toast.error('Hãy điền đầy đủ nghĩa trước khi lưu')

    setIsSaving(true)
    const records = valid.map(i => ({
      user_id: user.id,
      word: i.word.trim(),
      meaning: i.meaning.trim(),
      part_of_speech: i.pos.trim(),
      example: i.example.trim(),
      collocations: i.collocations.trim(),
      next_review_at: new Date().toISOString(),
      interval_days: 0,
      wrong_count: 0,
      review_count: 0,
    }))
    const { error } = await supabase.from('vocabularies').insert(records)
    if (error) toast.error(`Không thể lưu: ${error.message}`)
    else {
      toast.success(`Đã lưu ${records.length} từ vào sổ`)
      setWordsInput('')
      setDraftItems([])
      fetchVocabs()
      confetti({ particleCount: 40, spread: 55, origin: { y: 0.7 } })
    }
    setIsSaving(false)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    const { error } = await supabase.from('vocabularies').delete().eq('id', deleteTarget.id)
    if (error) toast.error('Không thể xoá từ này')
    else {
      setVocabs(v => v.filter(x => x.id !== deleteTarget.id))
      toast.success(`Đã xoá "${deleteTarget.word}"`)
    }
    setDeleteTarget(null)
  }

  const updateVocabProgress = async (vocab: Vocab, rating: Rating) => {
    recordStudyActivity()
    const now = new Date()
    let nextDate = new Date()
    let interval = vocab.interval_days || 0
    let wrong = vocab.wrong_count || 0
    const reviews = (vocab.review_count || 0) + 1

    if (rating === 'hard' || rating === 'wrong') {
      nextDate = new Date(now.getTime() + 10 * 60 * 1000)
      interval = 0
      if (rating === 'wrong') wrong += 1
    } else if (rating === 'good') {
      interval = Math.max(1, interval === 0 ? 1 : interval * 2)
      nextDate = new Date(now.getTime() + interval * 86400000)
    } else {
      interval = Math.max(4, interval === 0 ? 5 : interval * 3)
      nextDate = new Date(now.getTime() + interval * 86400000)
    }

    const patch = {
      next_review_at: nextDate.toISOString(),
      interval_days: interval,
      wrong_count: wrong,
      review_count: reviews,
    }
    setVocabs(prev => prev.map(v => (v.id === vocab.id ? { ...v, ...patch } : v)))
    const { error } = await supabase.from('vocabularies').update(patch).eq('id', vocab.id)
    if (error) toast.error('Không thể lưu tiến độ')
  }

  /* ───── Study logic ───── */

  const makeQuizOptions = (current: Vocab, pool: Vocab[]) => {
    const others = Array.from(new Set(pool.filter(v => v.id !== current.id).map(v => v.meaning)))
    const distractors = shuffle(others).slice(0, 3)
    const fallbacks = ['sự kiên trì', 'tình huống', 'khám phá', 'phát triển', 'tự tin', 'cơ hội']
    for (const f of fallbacks) {
      if (distractors.length >= 3) break
      if (f !== current.meaning && !distractors.includes(f)) distractors.push(f)
    }
    return shuffle([...distractors, current.meaning])
  }

  const resetCardState = () => {
    setIsFlipped(false)
    setSelectedOption(null)
    setTextInput('')
    setAnswerStatus('idle')
    setSpokenText('')
    setSpeechResult('idle')
    setAnswered(false)
  }

  const prepareCard = (card: Vocab) => {
    if (studyMode === 'quiz') setQuizOptions(makeQuizOptions(card, vocabs))
    else if (studyMode === 'spelling' || studyMode === 'dictation') speakText(card.word)
  }

  const startStudySession = (customQueue?: Vocab[]) => {
    const pool = customQueue ?? filteredStudy
    if (pool.length === 0) return toast.error('Không có từ nào phù hợp với bộ lọc này')
    if (studyMode === 'quiz' && vocabs.length < 2) return toast.error('Cần ít nhất 2 từ để tạo câu hỏi trắc nghiệm')
    const queue = shuffle(pool)
    setStudyQueue(queue)
    setCurrentIndex(0)
    setScore(0)
    resetCardState()
    prepareCard(queue[0])
  }

  const advance = () => {
    const next = currentIndex + 1
    resetCardState()
    setTimeout(() => {
      setCurrentIndex(next)
      if (next < studyQueue.length) prepareCard(studyQueue[next])
      else confetti({ particleCount: 100, spread: 75, origin: { y: 0.6 } })
    }, 120)
  }

  const rateFlashcard = (rating: Rating) => {
    updateVocabProgress(studyQueue[currentIndex], rating)
    advance()
  }

  const handleSelectQuiz = (option: string) => {
    if (selectedOption) return
    const current = studyQueue[currentIndex]
    setSelectedOption(option)
    if (option === current.meaning) {
      setScore(s => s + 1)
      speakText(current.word)
      updateVocabProgress(current, 'good')
    } else updateVocabProgress(current, 'wrong')
  }

  const handleCheckText = (e: React.FormEvent) => {
    e.preventDefault()
    if (!textInput.trim() || answered) return
    const current = studyQueue[currentIndex]
    if (textInput.trim().toLowerCase() === current.word.trim().toLowerCase()) {
      setAnswerStatus('correct')
      setAnswered(true)
      setScore(s => s + 1)
      speakText(current.word)
      updateVocabProgress(current, 'good')
    } else {
      setAnswerStatus('wrong')
      updateVocabProgress(current, 'wrong')
    }
  }

  const revealAnswer = () => {
    if (answered) return
    setAnswered(true)
    setAnswerStatus('revealed')
    setTextInput(studyQueue[currentIndex].word)
    updateVocabProgress(studyQueue[currentIndex], 'wrong')
  }

  const startSpeech = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return toast.error('Trình duyệt chưa hỗ trợ nhận diện giọng nói. Hãy dùng Chrome hoặc Edge.')
    const rec = new SR()
    rec.lang = 'en-US'
    rec.interimResults = false
    rec.maxAlternatives = 1
    setIsListening(true)
    setSpeechResult('idle')
    setSpokenText('')

    rec.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript.trim().toLowerCase()
      const current = studyQueue[currentIndex]
      setSpokenText(transcript)
      setIsListening(false)
      if (transcript.includes(current.word.trim().toLowerCase())) {
        setSpeechResult('pass')
        setScore(s => s + 1)
        updateVocabProgress(current, 'good')
      } else {
        setSpeechResult('fail')
        updateVocabProgress(current, 'wrong')
      }
    }
    rec.onerror = () => {
      setIsListening(false)
      toast.error('Không nghe rõ. Hãy kiểm tra quyền micro và thử lại')
    }
    rec.start()
  }

  const handleGenerateStory = async () => {
    if (vocabs.length === 0) return toast.error('Hãy thêm ít nhất 1 từ vào sổ trước')
    setIsGeneratingStory(true)
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'story', words: vocabs.slice(0, 5).map(v => v.word) }),
      })
      const data = await res.json()
      if (data.storyEn) setStoryData(data)
      else toast.error('Không thể tạo hội thoại lúc này')
    } catch {
      toast.error('Không thể tạo hội thoại lúc này')
    }
    setIsGeneratingStory(false)
  }

  const inSession = page === 'study' && studyQueue.length > 0 && currentIndex < studyQueue.length

  // Phím tắt: Space lật thẻ · 1/2/3 chấm độ nhớ
  useEffect(() => {
    if (!inSession || studyMode !== 'flashcard') return
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.code === 'Space') { e.preventDefault(); setIsFlipped(f => !f) }
      if (isFlipped) {
        if (e.key === '1') rateFlashcard('hard')
        if (e.key === '2') rateFlashcard('good')
        if (e.key === '3') rateFlashcard('easy')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inSession, studyMode, isFlipped, currentIndex, studyQueue])

  const changePage = (p: Page) => {
    setPage(p)
    setStudyQueue([])
  }

  /* ───────────────────────────── Render: loading ───────────────────────────── */

  const shell = 'min-h-screen bg-slate-50 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100'

  if (!authReady) {
    return (
      <div className={`${shell} flex items-center justify-center`}>
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    )
  }

  /* ───────────────────────────── Render: auth ───────────────────────────── */

  if (!user) {
    return (
      <div className={`${shell} flex`}>
        <Toaster position="top-center" richColors theme={darkMode ? 'dark' : 'light'} />

        <div className="relative hidden flex-col justify-between overflow-hidden bg-slate-950 p-12 text-white lg:flex lg:w-1/2">
          <div className="pointer-events-none absolute -left-24 -top-24 h-96 w-96 rounded-full bg-indigo-600/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 right-0 h-96 w-96 rounded-full bg-sky-600/15 blur-3xl" />

          <div className="relative z-10 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600">
              <BookOpen className="h-4 w-4" />
            </div>
            <span className="text-lg font-semibold tracking-tight">VocabDaily</span>
          </div>

          <div className="relative z-10 max-w-lg">
            <h2 className="text-4xl font-semibold leading-tight tracking-tight">
              Ghi nhớ từ vựng tiếng Anh theo phương pháp lặp lại ngắt quãng.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-400">
              Tự động phân tích nghĩa và cụm từ đi kèm, luyện phát âm, và theo dõi tiến độ học tập mỗi ngày.
            </p>
            <div className="mt-10 grid grid-cols-3 gap-3">
              {[
                { v: '5', l: 'Chế độ luyện tập' },
                { v: 'SRS', l: 'Lịch ôn thông minh' },
                { v: 'AI', l: 'Phân tích ngữ cảnh' },
              ].map(s => (
                <div key={s.l} className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <div className="text-xl font-semibold">{s.v}</div>
                  <div className="mt-1 text-xs text-slate-400">{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          <p className="relative z-10 text-xs text-slate-500">© {new Date().getFullYear()} VocabDaily</p>
        </div>

        <div className="relative flex w-full flex-col items-center justify-center p-6 sm:p-12 lg:w-1/2">
          <button
            onClick={toggleDarkMode}
            aria-label="Đổi giao diện sáng/tối"
            className="absolute right-6 top-6 rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100 dark:border-slate-800 dark:hover:bg-slate-900"
          >
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
            <div className="mb-8 lg:hidden"><Logo /></div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {isSignUp ? 'Tạo tài khoản' : 'Đăng nhập'}
            </h1>
            <p className={`mt-2 text-sm ${ui.muted}`}>
              {isSignUp ? 'Bắt đầu xây dựng sổ từ vựng của riêng bạn.' : 'Tiếp tục lộ trình ôn tập của bạn.'}
            </p>

            <form onSubmit={handleAuth} className="mt-8 space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="username" className={ui.label}>Tên đăng nhập</label>
                <input
                  id="username"
                  type="text"
                  required
                  minLength={3}
                  autoComplete="username"
                  placeholder="VD: minhanh01"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className={ui.field}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="password" className={ui.label}>Mật khẩu</label>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  placeholder="Tối thiểu 6 ký tự"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className={ui.field}
                />
              </div>
              <Button type="submit" loading={authLoading} className="w-full py-2.5">
                {isSignUp ? 'Tạo tài khoản' : 'Đăng nhập'}
              </Button>
            </form>

            <p className={`mt-6 text-center text-sm ${ui.muted}`}>
              {isSignUp ? 'Đã có tài khoản? ' : 'Chưa có tài khoản? '}
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
              >
                {isSignUp ? 'Đăng nhập' : 'Đăng ký'}
              </button>
            </p>
          </motion.div>
        </div>
      </div>
    )
  }

  /* ───────────────────────────── Render: app ───────────────────────────── */

  const navItems: { id: Page; label: string; icon: typeof BookOpen; badge?: number }[] = [
    { id: 'words', label: 'Sổ từ vựng', icon: BookOpen },
    { id: 'study', label: 'Luyện tập', icon: Layers, badge: dueCount },
    { id: 'progress', label: 'Tiến độ', icon: BarChart3 },
    ...(isTeacher ? [{ id: 'class' as Page, label: 'Quản lý lớp', icon: Users }] : []),
  ]

  const current = studyQueue[currentIndex]
  const maxBar = Math.max(1, ...last7Days.map(d => d.count))

  return (
    <div className={shell}>
      <Toaster position="top-center" richColors theme={darkMode ? 'dark' : 'light'} />

      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:flex">
        <div className="flex h-16 items-center px-6"><Logo /></div>

        <nav className="flex-1 space-y-1 px-3 py-2">
          {navItems.map(item => {
            const Icon = item.icon
            const active = page === item.id
            return (
              <button
                key={item.id}
                onClick={() => changePage(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 ${
                  active
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="flex-1 text-left">{item.label}</span>
                {!!item.badge && (
                  <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[11px] font-semibold text-white">
                    {item.badge}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        <div className="space-y-3 border-t border-slate-200 p-4 dark:border-slate-800">
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
            <Flame className="h-4 w-4" />
            {streak} ngày liên tiếp
          </div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold uppercase text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
              {displayName(user.email).slice(0, 2)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{displayName(user.email)}</p>
              <p className={`text-xs ${ui.muted}`}>{isTeacher ? 'Giáo viên' : 'Học viên'}</p>
            </div>
            <button
              onClick={toggleDarkMode}
              aria-label="Đổi giao diện sáng/tối"
              className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button
              onClick={() => supabase.auth.signOut()}
              aria-label="Đăng xuất"
              className="rounded-lg p-2 text-slate-500 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Top bar (mobile) */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 lg:hidden">
        <Logo small />
        <div className="flex items-center gap-1">
          <span className="mr-1 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
            <Flame className="h-3.5 w-3.5" /> {streak}
          </span>
          <button onClick={toggleDarkMode} aria-label="Đổi giao diện" className="rounded-lg p-2 text-slate-500">
            {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button onClick={() => supabase.auth.signOut()} aria-label="Đăng xuất" className="rounded-lg p-2 text-slate-500">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Bottom nav (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 grid border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 lg:hidden"
        style={{ gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))` }}>
        {navItems.map(item => {
          const Icon = item.icon
          const active = page === item.id
          return (
            <button
              key={item.id}
              onClick={() => changePage(item.id)}
              className={`relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
                active ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-500'
              }`}
            >
              <Icon className="h-5 w-5" />
              {item.label}
              {!!item.badge && (
                <span className="absolute right-1/4 top-1.5 rounded-full bg-indigo-600 px-1.5 text-[10px] font-semibold text-white">
                  {item.badge}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Main */}
      <main className="px-4 pb-28 pt-6 sm:px-8 lg:ml-64 lg:pb-12 lg:pt-10">
        <div className="mx-auto max-w-4xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={page}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {/* ═════════════ PAGE: WORDS ═════════════ */}
              {page === 'words' && (
                <div className="space-y-8">
                  <PageHeader
                    title="Sổ từ vựng"
                    description={`${vocabs.length} từ trong sổ của bạn`}
                  />

                  <Card className="p-5 sm:p-6">
                    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="text-sm font-semibold">Thêm từ mới</h2>
                        <p className={`mt-1 text-sm ${ui.muted}`}>
                          Nhập mỗi từ một dòng, hệ thống sẽ gợi ý nghĩa, từ loại, collocation và câu ví dụ.
                        </p>
                      </div>
                      <Button onClick={handleAnalyzeWords} loading={isAnalyzing} icon={Sparkles}>
                        {isAnalyzing ? 'Đang phân tích' : 'Phân tích tự động'}
                      </Button>
                    </div>

                    <textarea
                      rows={4}
                      placeholder={'ambitious\nbreakthrough\nnegotiate'}
                      value={wordsInput}
                      onChange={e => setWordsInput(e.target.value)}
                      className={`${ui.field} font-mono`}
                    />

                    {draftItems.length > 0 && (
                      <div className="mt-6 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className={ui.label}>Kiểm tra và chỉnh sửa trước khi lưu</p>
                          <button
                            onClick={() => setDraftItems([])}
                            className="text-xs font-medium text-slate-500 hover:text-red-600"
                          >
                            Xoá bản nháp
                          </button>
                        </div>
                        {draftItems.map((item, idx) => (
                          <div key={idx} className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/40">
                            <div className="grid grid-cols-1 items-center gap-2 md:grid-cols-12">
                              <div className="flex items-center gap-1 md:col-span-3">
                                <button
                                  onClick={() => speakText(item.word)}
                                  aria-label={`Nghe phát âm ${item.word}`}
                                  className="rounded-md p-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
                                >
                                  <Volume2 className="h-4 w-4" />
                                </button>
                                <span className="text-sm font-semibold">{item.word}</span>
                              </div>
                              <input className={`${ui.field} md:col-span-2`} placeholder="Từ loại" value={item.pos} onChange={e => updateDraft(idx, 'pos', e.target.value)} />
                              <input className={`${ui.field} md:col-span-3`} placeholder="Nghĩa tiếng Việt" value={item.meaning} onChange={e => updateDraft(idx, 'meaning', e.target.value)} />
                              <input className={`${ui.field} md:col-span-4`} placeholder="Collocations" value={item.collocations} onChange={e => updateDraft(idx, 'collocations', e.target.value)} />
                            </div>
                            <input className={ui.field} placeholder="Câu ví dụ" value={item.example} onChange={e => updateDraft(idx, 'example', e.target.value)} />
                          </div>
                        ))}
                        <Button onClick={handleSaveVocabs} loading={isSaving} icon={Plus} className="w-full py-2.5">
                          Lưu {draftItems.length} từ vào sổ
                        </Button>
                      </div>
                    )}
                  </Card>

                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h2 className="text-sm font-semibold">Lịch sử theo ngày</h2>
                      <div className="relative w-full sm:w-64">
                        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <input
                          value={search}
                          onChange={e => setSearch(e.target.value)}
                          placeholder="Tìm từ hoặc nghĩa"
                          className={`${ui.field} pl-9`}
                        />
                      </div>
                    </div>

                    {loadingData ? (
                      <Card className="space-y-4 p-5">
                        {[0, 1, 2].map(i => <Skeleton key={i} className="h-10 w-full" />)}
                      </Card>
                    ) : vocabs.length === 0 ? (
                      <Card>
                        <EmptyState
                          icon={BookOpen}
                          title="Chưa có từ vựng nào"
                          description="Nhập vài từ tiếng Anh ở phía trên và bấm “Phân tích tự động” để bắt đầu."
                        />
                      </Card>
                    ) : searchedVocabs.length === 0 ? (
                      <Card><EmptyState icon={Search} title="Không tìm thấy kết quả" description={`Không có từ nào khớp với “${search}”.`} /></Card>
                    ) : (
                      Object.entries(groupedByDate).map(([date, items]) => (
                        <Card key={date} className="overflow-hidden">
                          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-2.5 dark:border-slate-800 dark:bg-slate-900">
                            <span className="text-sm font-medium capitalize">{date}</span>
                            <Badge tone="indigo">{items.length} từ</Badge>
                          </div>
                          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                            {items.map(item => (
                              <li key={item.id} className="group flex items-start justify-between gap-4 px-5 py-3.5">
                                <div className="min-w-0 flex-1 space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <button
                                      onClick={() => speakText(item.word)}
                                      aria-label={`Nghe phát âm ${item.word}`}
                                      className="rounded-md p-1 text-slate-400 hover:text-indigo-600"
                                    >
                                      <Volume2 className="h-4 w-4" />
                                    </button>
                                    <span className="text-sm font-semibold">{item.word}</span>
                                    {item.part_of_speech && <Badge>{item.part_of_speech}</Badge>}
                                    <span className="text-sm text-slate-600 dark:text-slate-300">{item.meaning}</span>
                                    {(item.wrong_count || 0) > 0 && <Badge tone="red">Sai {item.wrong_count}</Badge>}
                                    {isMastered(item) && <Badge tone="emerald">Đã thuộc</Badge>}
                                  </div>
                                  {item.collocations && <p className="pl-8 text-xs text-emerald-600 dark:text-emerald-400">{item.collocations}</p>}
                                  {item.example && <p className={`pl-8 text-xs italic ${ui.muted}`}>“{item.example}”</p>}
                                </div>
                                <button
                                  onClick={() => setDeleteTarget(item)}
                                  aria-label={`Xoá ${item.word}`}
                                  className="rounded-md p-1.5 text-slate-400 opacity-100 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </li>
                            ))}
                          </ul>
                        </Card>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* ═════════════ PAGE: STUDY ═════════════ */}
              {page === 'study' && (
                <div>
                  <PageHeader
                    title="Luyện tập"
                    description={dueCount > 0 ? `${dueCount} từ đang đến hạn ôn tập` : 'Bạn đã ôn hết các từ đến hạn'}
                  />

                  {studyQueue.length === 0 ? (
                    <div className="space-y-6">
                      <div>
                        <p className={`${ui.label} mb-3`}>Chế độ luyện tập</p>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                          {STUDY_MODES.map(m => {
                            const Icon = m.icon
                            const active = studyMode === m.id
                            return (
                              <button
                                key={m.id}
                                onClick={() => setStudyMode(m.id)}
                                className={`flex items-start gap-3 rounded-xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/40 ${
                                  active
                                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10'
                                    : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700'
                                }`}
                              >
                                <div className={`rounded-lg p-2 ${active ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>
                                  <Icon className="h-4 w-4" />
                                </div>
                                <div>
                                  <p className="text-sm font-semibold">{m.label}</p>
                                  <p className={`mt-0.5 text-xs ${ui.muted}`}>{m.desc}</p>
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      <div>
                        <p className={`${ui.label} mb-3`}>Nguồn từ vựng</p>
                        <Segmented value={timeFilter} onChange={setTimeFilter} options={TIME_FILTERS} />
                      </div>

                      <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
                        <div>
                          <p className="text-2xl font-semibold tracking-tight">{filteredStudy.length}</p>
                          <p className={`text-sm ${ui.muted}`}>từ sẵn sàng cho phiên học này</p>
                        </div>
                        <Button onClick={() => startStudySession()} icon={Shuffle} disabled={filteredStudy.length === 0}>
                          Bắt đầu phiên học
                        </Button>
                      </Card>
                    </div>
                  ) : currentIndex < studyQueue.length ? (
                    <div className="mx-auto max-w-xl">
                      <div className="mb-6">
                        <div className="mb-2 flex items-center justify-between text-xs font-medium text-slate-500">
                          <span>{currentIndex + 1} / {studyQueue.length}</span>
                          <div className="flex items-center gap-3">
                            {studyMode !== 'flashcard' && <span className="text-emerald-600 dark:text-emerald-400">Điểm {score}</span>}
                            <button onClick={() => setStudyQueue([])} className="inline-flex items-center gap-1 hover:text-slate-800 dark:hover:text-slate-200">
                              <X className="h-3.5 w-3.5" /> Kết thúc
                            </button>
                          </div>
                        </div>
                        <div className="h-1 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                          <div
                            className="h-full rounded-full bg-indigo-600 transition-all"
                            style={{ width: `${((currentIndex + 1) / studyQueue.length) * 100}%` }}
                          />
                        </div>
                      </div>

                      {/* Flashcard */}
                      {studyMode === 'flashcard' && (
                        <>
                          <div className="relative h-72 w-full [perspective:1200px]">
                            <motion.div
                              onClick={() => setIsFlipped(f => !f)}
                              animate={{ rotateY: isFlipped ? 180 : 0 }}
                              transition={{ duration: 0.4 }}
                              style={{ transformStyle: 'preserve-3d' }}
                              className="relative h-full w-full cursor-pointer"
                            >
                              <div
                                style={{ backfaceVisibility: 'hidden' }}
                                className={`${ui.card} absolute inset-0 flex flex-col items-center justify-center p-8 shadow-sm`}
                              >
                                <button
                                  onClick={e => speakText(current.word, e)}
                                  aria-label="Nghe phát âm"
                                  className="absolute right-4 top-4 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 dark:hover:bg-slate-800"
                                >
                                  <Volume2 className="h-5 w-5" />
                                </button>
                                {current.part_of_speech && <Badge tone="indigo">{current.part_of_speech}</Badge>}
                                <p className="mt-3 text-center text-4xl font-semibold tracking-tight">{current.word}</p>
                                <p className={`mt-8 text-xs ${ui.muted}`}>Nhấn Space hoặc chạm để lật thẻ</p>
                              </div>

                              <div
                                style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                                className="absolute inset-0 flex flex-col items-center justify-center space-y-3 rounded-xl bg-indigo-600 p-6 text-center text-white shadow-sm"
                              >
                                <p className="text-3xl font-semibold tracking-tight">{current.meaning}</p>
                                {current.collocations && <p className="text-xs text-indigo-200">{current.collocations}</p>}
                                {current.example && (
                                  <p className="rounded-lg bg-white/10 px-3 py-2 text-xs italic text-indigo-50">“{current.example}”</p>
                                )}
                              </div>
                            </motion.div>
                          </div>

                          <div className="mt-6">
                            {isFlipped ? (
                              <div className="grid grid-cols-3 gap-2">
                                <button onClick={() => rateFlashcard('hard')} className="rounded-lg border border-red-200 bg-red-50 py-3 text-sm font-medium text-red-700 transition hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
                                  Chưa nhớ<span className="block text-[11px] font-normal opacity-70">10 phút · phím 1</span>
                                </button>
                                <button onClick={() => rateFlashcard('good')} className="rounded-lg border border-amber-200 bg-amber-50 py-3 text-sm font-medium text-amber-700 transition hover:bg-amber-100 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
                                  Tạm nhớ<span className="block text-[11px] font-normal opacity-70">1 ngày · phím 2</span>
                                </button>
                                <button onClick={() => rateFlashcard('easy')} className="rounded-lg border border-emerald-200 bg-emerald-50 py-3 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                                  Đã thuộc<span className="block text-[11px] font-normal opacity-70">5 ngày · phím 3</span>
                                </button>
                              </div>
                            ) : (
                              <Button variant="secondary" onClick={() => setIsFlipped(true)} icon={Eye} className="w-full py-3">
                                Hiện đáp án
                              </Button>
                            )}
                          </div>
                        </>
                      )}

                      {/* Quiz */}
                      {studyMode === 'quiz' && (
                        <div className="space-y-4">
                          <Card className="relative p-8 text-center">
                            <button
                              onClick={() => speakText(current.word)}
                              aria-label="Nghe phát âm"
                              className="absolute right-4 top-4 rounded-lg p-2 text-slate-400 hover:text-indigo-600"
                            >
                              <Volume2 className="h-5 w-5" />
                            </button>
                            <p className={`mb-2 text-xs ${ui.muted}`}>Chọn nghĩa đúng của từ</p>
                            <h3 className="text-3xl font-semibold tracking-tight">{current.word}</h3>
                          </Card>
                          <div className="grid gap-2.5">
                            {quizOptions.map((opt, idx) => {
                              const correct = opt === current.meaning
                              const picked = selectedOption === opt
                              let style = 'border-slate-200 bg-white hover:border-indigo-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-500/50'
                              if (selectedOption) {
                                if (correct) style = 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300'
                                else if (picked) style = 'border-red-500 bg-red-50 text-red-800 dark:bg-red-500/10 dark:text-red-300'
                                else style = 'border-slate-200 bg-white opacity-60 dark:border-slate-800 dark:bg-slate-900'
                              }
                              return (
                                <button
                                  key={idx}
                                  onClick={() => handleSelectQuiz(opt)}
                                  disabled={!!selectedOption}
                                  className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium transition ${style}`}
                                >
                                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-100 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                    {['A', 'B', 'C', 'D'][idx]}
                                  </span>
                                  {opt}
                                </button>
                              )
                            })}
                          </div>
                          {selectedOption && (
                            <Button onClick={advance} className="w-full py-2.5">
                              Câu tiếp theo <ArrowRight className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      )}

                      {/* Spelling & Dictation */}
                      {(studyMode === 'spelling' || studyMode === 'dictation') && (
                        <div className="space-y-5">
                          <Card className="p-8 text-center">
                            <Button variant="secondary" icon={Volume2} onClick={() => speakText(current.word)} className="mx-auto">
                              Nghe phát âm
                            </Button>
                            {studyMode === 'spelling' ? (
                              <p className="mt-5 text-2xl font-semibold tracking-tight text-indigo-600 dark:text-indigo-300">{current.meaning}</p>
                            ) : (
                              <p className={`mt-5 text-sm ${ui.muted}`}>Nghe âm thanh và gõ chính xác từ tiếng Anh.</p>
                            )}
                          </Card>

                          <form onSubmit={handleCheckText} className="space-y-3">
                            <input
                              type="text"
                              autoFocus
                              autoComplete="off"
                              spellCheck={false}
                              disabled={answered}
                              placeholder="Gõ từ tiếng Anh"
                              value={textInput}
                              onChange={e => {
                                setTextInput(e.target.value)
                                if (answerStatus === 'wrong') setAnswerStatus('idle')
                              }}
                              className={`w-full rounded-xl border-2 px-4 py-3.5 text-center text-xl font-semibold focus:outline-none ${
                                answerStatus === 'correct'
                                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                                  : answerStatus === 'wrong'
                                  ? 'border-red-500 bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300'
                                  : answerStatus === 'revealed'
                                  ? 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
                                  : 'border-slate-300 bg-white focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900'
                              }`}
                            />
                            {answerStatus === 'wrong' && (
                              <p className="text-center text-sm text-red-600 dark:text-red-400">
                                Chưa đúng. Gợi ý: từ bắt đầu bằng “{current.word[0]}”
                              </p>
                            )}
                            {answered ? (
                              <div className="space-y-3 text-center">
                                <p className={`text-sm ${ui.muted}`}>Nghĩa: <span className="font-medium text-slate-900 dark:text-slate-100">{current.meaning}</span></p>
                                <Button type="button" onClick={advance} className="w-full py-2.5">
                                  Từ tiếp theo <ArrowRight className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <Button type="button" variant="secondary" onClick={revealAnswer}>Hiện đáp án</Button>
                                <Button type="submit" className="flex-1">Kiểm tra</Button>
                              </div>
                            )}
                          </form>
                        </div>
                      )}

                      {/* Speaking */}
                      {studyMode === 'speaking' && (
                        <div className="space-y-6 text-center">
                          <Card className="space-y-3 p-8">
                            <button
                              onClick={() => speakText(current.word)}
                              className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-300"
                            >
                              <Volume2 className="h-4 w-4" /> Nghe mẫu
                            </button>
                            <h3 className="text-4xl font-semibold tracking-tight">{current.word}</h3>
                            <p className={ui.muted}>{current.meaning}</p>
                          </Card>

                          <button
                            onClick={startSpeech}
                            disabled={isListening}
                            aria-label="Bắt đầu ghi âm"
                            className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full text-white shadow-lg transition ${
                              isListening ? 'animate-pulse bg-red-500' : 'bg-indigo-600 hover:bg-indigo-700'
                            }`}
                          >
                            <Mic className="h-8 w-8" />
                          </button>
                          <p className={`text-xs ${ui.muted}`}>
                            {isListening ? 'Đang nghe, hãy đọc to từ trên' : 'Nhấn micro và đọc to từ trên'}
                          </p>

                          {spokenText && (
                            <div
                              className={`rounded-xl border p-4 text-sm ${
                                speechResult === 'pass'
                                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
                                  : 'border-red-300 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300'
                              }`}
                            >
                              <p className="text-xs opacity-80">Hệ thống nghe được: “{spokenText}”</p>
                              <p className="mt-1 font-semibold">
                                {speechResult === 'pass' ? 'Phát âm chuẩn xác' : 'Chưa khớp, hãy thử lại'}
                              </p>
                            </div>
                          )}

                          <Button variant="secondary" onClick={advance} className="w-full py-2.5">
                            {speechResult === 'idle' ? 'Bỏ qua' : 'Từ tiếp theo'} <ArrowRight className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <Card>
                      <div className="flex flex-col items-center px-6 py-14 text-center">
                        <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                        <h3 className="mt-4 text-xl font-semibold">Hoàn thành phiên luyện tập</h3>
                        {studyMode !== 'flashcard' && (
                          <p className={`mt-1 text-sm ${ui.muted}`}>Bạn đạt {score} / {studyQueue.length} điểm.</p>
                        )}
                        <div className="mt-6 flex gap-2">
                          <Button variant="secondary" onClick={() => setStudyQueue([])}>Quay lại</Button>
                          <Button icon={RotateCcw} onClick={() => startStudySession()}>Luyện lượt mới</Button>
                        </div>
                      </div>
                    </Card>
                  )}
                </div>
              )}

              {/* ═════════════ PAGE: PROGRESS ═════════════ */}
              {page === 'progress' && (
                <div className="space-y-8">
                  <PageHeader title="Tiến độ học tập" description="Theo dõi thói quen học và những từ cần chú ý." />

                  <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                    <StatCard label="Chuỗi ngày học" value={streak} hint="ngày liên tiếp" icon={Flame} tone="amber" />
                    <StatCard label="Ôn hôm nay" value={todayReviewed} hint="lượt" icon={Layers} tone="indigo" />
                    <StatCard label="Đã thuộc" value={`${masteredCount}/${vocabs.length}`} hint="từ trong sổ" icon={CheckCircle2} tone="emerald" />
                    <StatCard label="Cần ôn" value={dueCount} hint="từ đến hạn" icon={AlertTriangle} tone="red" />
                  </div>

                  <Card className="p-5 sm:p-6">
                    <h3 className="text-sm font-semibold">Từ mới thêm trong 7 ngày qua</h3>
                    <div className="mt-6 flex h-40 items-end gap-3">
                      {last7Days.map(d => (
                        <div key={d.key} className="flex flex-1 flex-col items-center gap-2">
                          <span className={`text-xs ${ui.muted}`}>{d.count || ''}</span>
                          <div className="flex w-full flex-1 items-end">
                            <div
                              className="w-full rounded-t-md bg-indigo-500/80 transition-all"
                              style={{ height: `${Math.max(d.count ? 8 : 3, (d.count / maxBar) * 100)}%`, opacity: d.count ? 1 : 0.25 }}
                            />
                          </div>
                          <span className="text-[11px] capitalize text-slate-500">{d.label}</span>
                        </div>
                      ))}
                    </div>
                  </Card>

                  <Card className="p-5 sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="flex items-center gap-2 text-sm font-semibold">
                          <MessageSquare className="h-4 w-4 text-indigo-600" /> Hội thoại từ từ vựng của bạn
                        </h3>
                        <p className={`mt-1 text-sm ${ui.muted}`}>Ghép 5 từ mới nhất thành đoạn hội thoại ngắn để luyện ngữ cảnh.</p>
                      </div>
                      <Button onClick={handleGenerateStory} loading={isGeneratingStory} icon={Sparkles}>
                        Tạo hội thoại
                      </Button>
                    </div>

                    {storyData && (
                      <div className="mt-5 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
                        <div className="flex items-center justify-between">
                          <span className={ui.label}>Đoạn hội thoại mẫu</span>
                          <Button variant="secondary" icon={Volume2} onClick={() => speakText(storyData.storyEn)} className="px-2.5 py-1 text-xs">
                            Nghe
                          </Button>
                        </div>
                        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{storyData.storyEn}</pre>
                        <pre className={`whitespace-pre-wrap border-t border-slate-200 pt-3 font-sans text-xs leading-relaxed dark:border-slate-800 ${ui.muted}`}>
                          {storyData.storyVi}
                        </pre>
                      </div>
                    )}
                  </Card>

                  <Card className="p-5 sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="flex items-center gap-2 text-sm font-semibold">
                          <AlertTriangle className="h-4 w-4 text-red-500" /> Từ hay làm sai
                        </h3>
                        <p className={`mt-1 text-sm ${ui.muted}`}>Những từ bạn từng chọn nhầm hoặc gõ sai.</p>
                      </div>
                      {leechWords.length > 0 && (
                        <Button
                          variant="danger"
                          onClick={() => {
                            setPage('study')
                            setTimeFilter('leech')
                            startStudySession(leechWords)
                          }}
                        >
                          Ôn {leechWords.length} từ này
                        </Button>
                      )}
                    </div>

                    {leechWords.length === 0 ? (
                      <EmptyState icon={CheckCircle2} title="Chưa có từ nào hay sai" description="Tiếp tục phát huy nhé." />
                    ) : (
                      <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
                        {leechWords.slice(0, 10).map(w => (
                          <li key={w.id} className="flex items-center justify-between py-3">
                            <div>
                              <span className="text-sm font-semibold">{w.word}</span>
                              <span className={`ml-2 text-sm ${ui.muted}`}>{w.meaning}</span>
                            </div>
                            <Badge tone="red">Sai {w.wrong_count} lần</Badge>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>
                </div>
              )}

              {/* ═════════════ PAGE: CLASS (teacher) ═════════════ */}
              {page === 'class' && isTeacher && (
                <div className="space-y-6">
                  <PageHeader
                    title="Quản lý lớp"
                    description={`${students.length} học sinh đang theo dõi`}
                    actions={<Button variant="secondary" onClick={fetchVocabs} icon={RotateCcw}>Làm mới</Button>}
                  />

                  <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                    <StatCard label="Học sinh" value={students.length} icon={Users} tone="indigo" />
                    <StatCard label="Tổng từ đã lưu" value={students.reduce((s, x) => s + x.total, 0)} icon={BookOpen} tone="indigo" />
                    <StatCard label="Đã thuộc" value={students.reduce((s, x) => s + x.mastered, 0)} icon={CheckCircle2} tone="emerald" />
                    <StatCard label="Từ hay sai" value={students.reduce((s, x) => s + x.leech, 0)} icon={AlertTriangle} tone="red" />
                  </div>

                  <Card className="overflow-hidden">
                    <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4 dark:border-slate-800">
                      <h3 className="text-sm font-semibold">Danh sách học sinh</h3>
                      <div className="relative w-full max-w-xs">
                        <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <input
                          value={studentSearch}
                          onChange={e => setStudentSearch(e.target.value)}
                          placeholder="Tìm học sinh"
                          className={`${ui.field} pl-9`}
                        />
                      </div>
                    </div>

                    {loadingData ? (
                      <div className="space-y-3 p-4">{[0, 1, 2].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
                    ) : students.length === 0 ? (
                      <EmptyState icon={Users} title="Chưa có dữ liệu học sinh" description="Học sinh sẽ xuất hiện ở đây sau khi họ lưu từ vựng đầu tiên." />
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[640px] text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 text-left text-xs font-medium text-slate-500 dark:border-slate-800">
                              <th className="px-4 py-3">Học sinh</th>
                              <th className="px-4 py-3 text-right">Tổng từ</th>
                              <th className="px-4 py-3 text-right">Đã thuộc</th>
                              <th className="px-4 py-3 text-right">Lượt ôn</th>
                              <th className="px-4 py-3 text-right">Hay sai</th>
                              <th className="px-4 py-3">Từ sai nhiều nhất</th>
                              <th className="px-4 py-3 text-right">Gần nhất</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {students.map(s => (
                              <tr key={s.id} className="transition hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                <td className="px-4 py-3 font-medium">{s.name}</td>
                                <td className="px-4 py-3 text-right tabular-nums">{s.total}</td>
                                <td className="px-4 py-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400">{s.mastered}</td>
                                <td className="px-4 py-3 text-right tabular-nums">{s.reviews}</td>
                                <td className="px-4 py-3 text-right tabular-nums">
                                  {s.leech > 0 ? <Badge tone="red">{s.leech}</Badge> : <span className="text-slate-400">0</span>}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex flex-wrap gap-1">
                                    {s.topWrong.length === 0 ? <span className="text-slate-400">—</span> : s.topWrong.map(w => (
                                      <Badge key={w.id} tone="red">{w.word} ×{w.wrong_count}</Badge>
                                    ))}
                                  </div>
                                </td>
                                <td className={`px-4 py-3 text-right text-xs ${ui.muted}`}>
                                  {new Date(s.last).toLocaleDateString('vi-VN')}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Card>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Xoá từ vựng?"
        description={`Từ “${deleteTarget?.word ?? ''}” sẽ bị xoá khỏi sổ và không thể khôi phục.`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

/**
 * Wrapper chỉ render app sau khi đã chạy trên trình duyệt.
 * Tránh lỗi prerender trên Vercel vì app dùng new Date(), localStorage, speechSynthesis...
 */
export default function VocabApp() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    )
  }
  return <VocabAppInner />
}
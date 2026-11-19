'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/utils/supabase'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import {
  Plus, Shuffle, Trash2, LogOut, BookOpen, CheckCircle2, RotateCcw,
  Volume2, Sparkles, Calendar, ArrowRight, Moon, Sun, HelpCircle,
  Keyboard, Layers, Flame, Mic, Headphones, BarChart3, AlertTriangle, MessageSquare
} from 'lucide-react'

interface Vocab {
  id: string
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

export default function VocabApp() {
  const [user, setUser] = useState<any>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const isTeacher = user?.email === 'tujhoang1202@gmail.com'

  // State nhập từ
  const [wordsInput, setWordsInput] = useState('')
  const [draftItems, setDraftItems] = useState<DraftItem[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // State dữ liệu & điều hướng
  const [vocabs, setVocabs] = useState<Vocab[]>([])
  const [activeTab, setActiveTab] = useState<'add' | 'study' | 'dashboard'>('add')
  const [timeFilter, setTimeFilter] = useState<'srs' | 'today' | 'week' | 'month' | 'all' | 'leech'>('srs')

  // State chế độ ôn tập (5 chế độ)
  const [studyMode, setStudyMode] = useState<'flashcard' | 'quiz' | 'spelling' | 'dictation' | 'speaking'>('flashcard')
  const [studyQueue, setStudyQueue] = useState<Vocab[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)

  // State Quiz / Spelling / Dictation / Speaking
  const [quizOptions, setQuizOptions] = useState<string[]>([])
  const [selectedOption, setSelectedOption] = useState<string | null>(null)
  const [textInput, setTextInput] = useState('')
  const [answerStatus, setAnswerStatus] = useState<'idle' | 'correct' | 'wrong'>('idle')
  const [score, setScore] = useState(0)

  // State chấm điểm phát âm Micro
  const [isListening, setIsListening] = useState(false)
  const [spokenText, setSpokenText] = useState('')
  const [speechResult, setSpeechResult] = useState<'idle' | 'pass' | 'fail'>('idle')

  // State Gamification & Mini-Story
  const [streak, setStreak] = useState(1)
  const [todayReviewed, setTodayReviewed] = useState(0)
  const [storyData, setStoryData] = useState<{ storyEn: string; storyVi: string; highlightedWords: string[] } | null>(null)
  const [isGeneratingStory, setIsGeneratingStory] = useState(false)

  useEffect(() => {
    const savedTheme = localStorage.getItem('vocab-dark-mode')
    if (savedTheme === 'true') setDarkMode(true)

    // Tính chuỗi ngày học (Daily Streak)
    const todayStr = new Date().toDateString()
    const lastStudy = localStorage.getItem('vocab-last-study')
    const savedStreak = Number(localStorage.getItem('vocab-streak') || '1')
    const savedCount = Number(localStorage.getItem(`vocab-count-${todayStr}`) || '0')
    setTodayReviewed(savedCount)

    if (lastStudy) {
      const diff = (new Date(todayStr).getTime() - new Date(lastStudy).getTime()) / (1000 * 3600 * 24)
      if (diff === 1) {
        setStreak(savedStreak + 1)
      } else if (diff === 0) {
        setStreak(savedStreak)
      } else {
        setStreak(1)
      }
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchVocabs(session.user.id, session.user.email)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchVocabs(session.user.id, session.user.email)
    })

    return () => subscription.unsubscribe()
  }, [])

  const recordStudyActivity = () => {
    const todayStr = new Date().toDateString()
    localStorage.setItem('vocab-last-study', todayStr)
    localStorage.setItem('vocab-streak', String(streak))
    const nextCount = todayReviewed + 1
    setTodayReviewed(nextCount)
    localStorage.setItem(`vocab-count-${todayStr}`, String(nextCount))
  }

  const toggleDarkMode = () => {
    const next = !darkMode
    setDarkMode(next)
    localStorage.setItem('vocab-dark-mode', String(next))
  }

  const fetchVocabs = async (userId: string, userEmail?: string) => {
    let query = supabase
      .from('vocabularies')
      .select('*')
      .order('created_at', { ascending: false })

    // Nếu không phải giáo viên thì chỉ lọc đúng từ của học sinh đó
    if (userEmail !== 'tujhoang1202@gmail.com') {
      query = query.eq('user_id', userId)
    }

    const { data, error } = await query
    if (!error && data) setVocabs(data)
  }

  const speakText = (text: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = 'en-US'
      utterance.rate = 0.9
      window.speechSynthesis.speak(utterance)
    }
  }
  // Hàm biến đổi biệt danh/ID thành định dạng định danh nội bộ cho Supabase
  const formatUsernameToAuthId = (input: string) => {
    const clean = input.trim().toLowerCase().replace(/\s+/g, '')
    // Nếu người dùng vẫn nhập email đầy đủ (như tài khoản admin của bạn) thì giữ nguyên
    if (clean.includes('@')) return clean
    // Nếu chỉ nhập tên/biệt danh/ID thì tự động gắn đuôi nội bộ
    return `${clean}@vocab.local`
  }

  // Hàm hiển thị tên gọn gàng (cắt bỏ đuôi @vocab.local khi hiện lên màn hình)
  const displayUsername = (authEmail: string) => {
    return authEmail.replace('@vocab.local', '')
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthLoading(true)

    const rawUsername = email.trim() // Dùng chung biến state email hiện có để khỏi sửa nhiều chỗ
    const authIdentifier = formatUsernameToAuthId(rawUsername)

    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({
        email: authIdentifier,
        password,
      })

      if (error) {
        if (error.message.includes('already registered')) {
          alert('Tên đăng nhập này đã có người dùng, hãy chọn tên khác!')
        } else {
          alert('Lỗi tạo tài khoản: ' + error.message)
        }
      } else {
        // Lưu tên đăng nhập gốc (không đuôi) vào bảng gợi ý
        if (data.user) {
          await supabase.from('student_accounts').upsert({
            id: data.user.id,
            email: displayUsername(authIdentifier),
            password_hint: password,
          })
        }

        if (rememberMe) {
          localStorage.setItem('vocab_saved_email', displayUsername(authIdentifier))
          localStorage.setItem('vocab_saved_pass', password)
        }

        if (!data.session) {
          await supabase.auth.signInWithPassword({ email: authIdentifier, password })
        }
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: authIdentifier,
        password,
      })

      if (error) {
        alert('Sai tên đăng nhập hoặc mật khẩu!')
      } else if (rememberMe) {
        localStorage.setItem('vocab_saved_email', displayUsername(authIdentifier))
        localStorage.setItem('vocab_saved_pass', password)
      }
    }

    setAuthLoading(false)
  }

  // Phân tích từ vựng tự động
  const handleAnalyzeWords = async () => {
    const wordLines = wordsInput.split('\n').map(w => w.trim()).filter(Boolean)
    if (wordLines.length === 0) return alert('Hãy nhập ít nhất 1 từ tiếng Anh!')

    setIsAnalyzing(true)
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words: wordLines }),
      })
      const data = await res.json()
      if (data.results) {
        setDraftItems(
          wordLines.map((w, idx) => ({
            word: w,
            meaning: data.results[idx]?.meaning || '',
            pos: data.results[idx]?.pos || '',
            example: data.results[idx]?.example || '',
            collocations: data.results[idx]?.collocations || '',
          }))
        )
      }
    } catch {
      alert('Lỗi kết nối khi phân tích từ, thử lại sau nhé.')
    }
    setIsAnalyzing(false)
  }

  const updateDraftItem = (index: number, field: keyof DraftItem, value: string) => {
    const updated = [...draftItems]
    updated[index][field] = value
    setDraftItems(updated)
  }

  const handleSaveVocabs = async () => {
    const validItems = draftItems.filter(item => item.word.trim() && item.meaning.trim())
    if (validItems.length === 0) return alert('Hãy phân tích và điền đầy đủ nghĩa trước khi lưu!')

    setIsSaving(true)
    const records = validItems.map(item => ({
      user_id: user.id,
      word: item.word.trim(),
      meaning: item.meaning.trim(),
      part_of_speech: item.pos.trim(),
      example: item.example.trim(),
      collocations: item.collocations.trim(),
      next_review_at: new Date().toISOString(),
      interval_days: 0,
      wrong_count: 0,
      review_count: 0,
    }))

    const { error } = await supabase.from('vocabularies').insert(records)
    if (error) {
      alert('Lỗi khi lưu: ' + error.message)
    } else {
      setWordsInput('')
      setDraftItems([])
      fetchVocabs(user.id)
      confetti({ particleCount: 45, spread: 55, origin: { y: 0.7 } })
    }
    setIsSaving(false)
  }

  const handleDelete = async (id: string) => {
    await supabase.from('vocabularies').delete().eq('id', id)
    setVocabs(vocabs.filter(v => v.id !== id))
  }

  // Cập nhật thuật toán Spaced Repetition (SRS) & thống kê lỗi lên Supabase
  const updateVocabProgress = async (vocab: Vocab, rating: 'hard' | 'good' | 'easy' | 'wrong') => {
    recordStudyActivity()
    const now = new Date()
    let nextDate = new Date()
    let nextInterval = vocab.interval_days || 0
    let wrongCount = vocab.wrong_count || 0
    const reviewCount = (vocab.review_count || 0) + 1

    if (rating === 'hard' || rating === 'wrong') {
      nextDate = new Date(now.getTime() + 10 * 60 * 1000) // Ôn lại sau 10 phút
      nextInterval = 0
      if (rating === 'wrong') wrongCount += 1
    } else if (rating === 'good') {
      nextInterval = Math.max(1, nextInterval === 0 ? 1 : nextInterval * 2)
      nextDate = new Date(now.getTime() + nextInterval * 24 * 3600 * 1000)
    } else if (rating === 'easy') {
      nextInterval = Math.max(4, nextInterval === 0 ? 5 : nextInterval * 3)
      nextDate = new Date(now.getTime() + nextInterval * 24 * 3600 * 1000)
    }

    await supabase
      .from('vocabularies')
      .update({
        next_review_at: nextDate.toISOString(),
        interval_days: nextInterval,
        wrong_count: wrongCount,
        review_count: reviewCount,
      })
      .eq('id', vocab.id)

    setVocabs(prev =>
      prev.map(v =>
        v.id === vocab.id
          ? { ...v, next_review_at: nextDate.toISOString(), interval_days: nextInterval, wrong_count: wrongCount, review_count: reviewCount }
          : v
      )
    )
  }

  const getFilteredVocabs = () => {
    const now = new Date()
    return vocabs.filter(v => {
      if (timeFilter === 'srs') {
        if (!v.next_review_at) return true
        return new Date(v.next_review_at) <= now
      }
      if (timeFilter === 'leech') {
        return (v.wrong_count || 0) > 0
      }
      const created = new Date(v.created_at)
      const diffDays = (now.getTime() - created.getTime()) / (1000 * 3600 * 24)
      if (timeFilter === 'today') return created.toDateString() === now.toDateString()
      if (timeFilter === 'week') return diffDays <= 7
      if (timeFilter === 'month') return diffDays <= 30
      return true
    })
  }

  const generateQuizOptions = (currentVocab: Vocab, allPool: Vocab[]) => {
    const otherMeanings = Array.from(new Set(allPool.filter(v => v.id !== currentVocab.id).map(v => v.meaning)))
    const distractors = otherMeanings.sort(() => Math.random() - 0.5).slice(0, 3)
    const fallbacks = ['sự kiên trì', 'tình huống', 'khám phá', 'phát triển', 'tự tin']
    while (distractors.length < 3) {
      const pick = fallbacks[distractors.length]
      if (pick !== currentVocab.meaning && !distractors.includes(pick)) distractors.push(pick)
      else distractors.push(`nghĩa khác #${distractors.length + 1}`)
    }
    return [...distractors, currentVocab.meaning].sort(() => Math.random() - 0.5)
  }

  const startStudySession = (customQueue?: Vocab[]) => {
    const pool = customQueue || getFilteredVocabs()
    if (pool.length === 0) return alert('Không có từ vựng nào phù hợp trong mục này!')
    if (studyMode === 'quiz' && vocabs.length < 2) {
      return alert('Cần ít nhất 2 từ trong kho để tạo câu hỏi Trắc nghiệm!')
    }

    const shuffled = [...pool].sort(() => Math.random() - 0.5)
    setStudyQueue(shuffled)
    setCurrentIndex(0)
    setScore(0)
    setIsFlipped(false)
    setSelectedOption(null)
    setTextInput('')
    setAnswerStatus('idle')
    setSpokenText('')
    setSpeechResult('idle')

    if (studyMode === 'quiz') {
      setQuizOptions(generateQuizOptions(shuffled[0], vocabs))
    } else if (studyMode === 'spelling' || studyMode === 'dictation') {
      speakText(shuffled[0].word)
    }
  }

  const advanceToNextCard = () => {
    const nextIdx = currentIndex + 1
    setIsFlipped(false)
    setSelectedOption(null)
    setTextInput('')
    setAnswerStatus('idle')
    setSpokenText('')
    setSpeechResult('idle')

    setTimeout(() => {
      setCurrentIndex(nextIdx)
      if (nextIdx < studyQueue.length) {
        if (studyMode === 'quiz') {
          setQuizOptions(generateQuizOptions(studyQueue[nextIdx], vocabs))
        } else if (studyMode === 'spelling' || studyMode === 'dictation') {
          speakText(studyQueue[nextIdx].word)
        }
      } else {
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } })
      }
    }, 150)
  }

  // Xử lý chọn đáp án Trắc nghiệm
  const handleSelectQuiz = (option: string) => {
    if (selectedOption) return
    setSelectedOption(option)
    const current = studyQueue[currentIndex]
    if (option === current.meaning) {
      setScore(s => s + 1)
      speakText(current.word)
      updateVocabProgress(current, 'good')
    } else {
      updateVocabProgress(current, 'wrong')
    }
  }

  // Xử lý kiểm tra Spelling & Dictation
  const handleCheckTextAnswer = (e: React.FormEvent) => {
    e.preventDefault()
    if (!textInput.trim() || answerStatus !== 'idle') return
    const current = studyQueue[currentIndex]
    const isCorrect = textInput.trim().toLowerCase() === current.word.trim().toLowerCase()
    if (isCorrect) {
      setAnswerStatus('correct')
      setScore(s => s + 1)
      speakText(current.word)
      updateVocabProgress(current, 'good')
    } else {
      setAnswerStatus('wrong')
      updateVocabProgress(current, 'wrong')
    }
  }

  // Chấm điểm phát âm bằng Micro (Web Speech API)
  const handleStartSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      return alert('Trình duyệt của bạn chưa hỗ trợ nhận diện giọng nói. Hãy dùng Google Chrome hoặc Edge nhé!')
    }

    const recognition = new SpeechRecognition()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    setIsListening(true)
    setSpeechResult('idle')
    setSpokenText('')

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript.trim().toLowerCase()
      const target = studyQueue[currentIndex].word.trim().toLowerCase()
      setSpokenText(transcript)
      setIsListening(false)

      if (transcript.includes(target) || target === transcript) {
        setSpeechResult('pass')
        setScore(s => s + 1)
        updateVocabProgress(studyQueue[currentIndex], 'good')
      } else {
        setSpeechResult('fail')
        updateVocabProgress(studyQueue[currentIndex], 'wrong')
      }
    }

    recognition.onerror = () => {
      setIsListening(false)
      alert('Không nghe rõ giọng nói, hãy kiểm tra quyền Micro trên trình duyệt và thử lại!')
    }

    recognition.start()
  }

  // Tạo đoạn hội thoại ngắn từ từ vựng
  const handleGenerateMiniStory = async () => {
    if (vocabs.length === 0) return alert('Hãy thêm ít nhất 1 từ vựng vào sổ trước!')
    setIsGeneratingStory(true)
    try {
      const recentWords = vocabs.slice(0, 5).map(v => v.word)
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'story', words: recentWords }),
      })
      const data = await res.json()
      if (data.storyEn) setStoryData(data)
    } catch {
      alert('Không thể tạo đoạn hội thoại lúc này.')
    }
    setIsGeneratingStory(false)
  }

  const bgMain = darkMode ? 'bg-slate-950 text-slate-100' : 'bg-gradient-to-b from-slate-50 to-slate-100/80 text-slate-800'
  const cardBg = darkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200/80'
  const inputBg = darkMode
    ? 'bg-slate-800/80 border-slate-700 text-slate-100 focus:bg-slate-800'
    : 'bg-slate-50 border-slate-200 text-slate-800 focus:bg-white'

  
    if (!user) {
    return (
      <div className={`min-h-screen flex transition-colors ${darkMode ? 'bg-slate-950 text-white' : 'bg-white text-slate-900'}`}>
        {/* CỘT TRÁI: BRAND SHOWCASE (Ẩn trên điện thoại, hiện đẹp trên máy tính) */}
        <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-slate-900 text-white p-12 flex-col justify-between">
          {/* Hiệu ứng ánh sáng nền thương mại */}
          <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-600/30 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-indigo-600/25 rounded-full blur-3xl pointer-events-none" />

          {/* Header Logo */}
          <div className="relative z-10 flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-tr from-blue-500 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-bold text-xl tracking-tight">VocabDaily</span>
              <span className="ml-2 text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                Enterprise
              </span>
            </div>
          </div>

          {/* Nội dung giá trị cốt lõi */}
          <div className="relative z-10 max-w-lg space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-xs text-blue-200">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Hệ thống ghi nhớ từ vựng chuẩn Spaced Repetition
            </div>
            <h2 className="text-4xl font-bold leading-tight tracking-tight">
              Làm chủ từ vựng tiếng Anh theo phương pháp khoa học.
            </h2>
            <p className="text-slate-300 text-base leading-relaxed">
              Tích hợp phân tích ngữ cảnh thông minh, luyện phát âm chuẩn bản xứ và hệ thống theo dõi tiến độ trực quan dành cho học viên và giảng viên.
            </p>

            {/* 3 Thẻ chỉ số tính năng */}
            <div className="grid grid-cols-3 gap-4 pt-4">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
                <div className="text-2xl font-bold text-white">5+</div>
                <div className="text-xs text-slate-400 mt-1">Chế độ luyện tập chuyên sâu</div>
              </div>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
                <div className="text-2xl font-bold text-blue-400">AI</div>
                <div className="text-xs text-slate-400 mt-1">Phân tích ngữ cảnh & Collocation</div>
              </div>
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
                <div className="text-2xl font-bold text-emerald-400">SRS</div>
                <div className="text-xs text-slate-400 mt-1">Lặp lại ngắt quãng thông minh</div>
              </div>
            </div>
          </div>

          {/* Footer Testimonial */}
          <div className="relative z-10 pt-6 border-t border-white/10 flex items-center justify-between text-xs text-slate-400">
            <span>© 2026 VocabDaily Learning Platform</span>
            <span>Bảo mật dữ liệu chuẩn Cloud RLS</span>
          </div>
        </div>

        {/* CỘT PHẢI: FORM ĐĂNG NHẬP / ĐĂNG KÝ */}
        <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-6 sm:p-12 relative">
          <button
            onClick={toggleDarkMode}
            className={`absolute top-6 right-6 p-2.5 rounded-xl border transition ${
              darkMode ? 'border-slate-800 bg-slate-900 text-slate-300 hover:text-white' : 'border-slate-200 bg-slate-50 text-slate-600 hover:text-slate-900'
            }`}
            title="Chuyển giao diện Sáng/Tối"
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md space-y-8"
          >
            {/* Logo mobile */}
            <div className="lg:hidden flex items-center gap-2.5">
              <div className="w-9 h-9 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center text-white">
                <BookOpen className="w-5 h-5" />
              </div>
              <span className="font-bold text-xl">VocabDaily Pro</span>
            </div>

            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
                {isSignUp ? 'Tạo tài khoản học viên' : 'Chào mừng trở lại'}
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">
                {isSignUp
                  ? 'Khởi tạo không gian học từ vựng cá nhân hóa miễn phí.'
                  : 'Đăng nhập để tiếp tục lộ trình ôn tập hôm nay của bạn.'}
              </p>
            </div>

            <form onSubmit={handleAuth} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Địa chỉ Email
                </label>
                <input
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className={`w-full px-4 py-3 border rounded-xl text-sm transition focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 ${inputBg}`}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Tên đăng nhập / Biệt danh / ID
                </label>
                <input
                  type="text"
                  required
                  minLength={3}
                  placeholder="VD: minhanh01 hoặc bietdanh"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className={`w-full px-4 py-3 border rounded-xl text-sm transition focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 ${inputBg}`}
                />
              </div>

              <button
                disabled={authLoading}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold py-3.5 rounded-xl shadow-lg shadow-blue-600/20 transition-all active:scale-[0.99]"
              >
                {authLoading
                  ? 'Đang xác thực...'
                  : isSignUp
                  ? 'Tạo tài khoản & Bắt đầu học'
                  : 'Đăng nhập vào hệ thống'}
              </button>
            </form>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 text-center text-sm text-slate-500">
              {isSignUp ? 'Đã có tài khoản trên hệ thống? ' : 'Chưa có tài khoản học tập? '}
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
              >
                {isSignUp ? 'Đăng nhập ngay' : 'Đăng ký miễn phí'}
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  const leechWords = vocabs.filter(v => (v.wrong_count || 0) > 0).sort((a, b) => (b.wrong_count || 0) - (a.wrong_count || 0)).slice(0, 10)
  const dueSrsCount = vocabs.filter(v => !v.next_review_at || new Date(v.next_review_at) <= new Date()).length
  const masteredCount = vocabs.filter(v => (v.interval_days || 0) >= 4).length

  const groupedByDate = vocabs.reduce((acc: Record<string, Vocab[]>, item) => {
    const dateKey = new Date(item.created_at).toLocaleDateString('vi-VN', {
      weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit'
    })
    if (!acc[dateKey]) acc[dateKey] = []
    acc[dateKey].push(item)
    return acc
  }, {})

  return (
    <div className={`min-h-screen transition-colors duration-300 ${bgMain}`}>
      {/* Header kèm Daily Streak */}
      <header className={`backdrop-blur-md border-b sticky top-0 z-20 ${darkMode ? 'bg-slate-900/80 border-slate-800' : 'bg-white/80 border-slate-200/80'}`}>
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5 font-bold text-xl bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent">
            <div className="p-1.5 bg-blue-600 rounded-xl text-white">
              <BookOpen className="w-5 h-5" />
            </div>
            <span>VocabDaily</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Ngọn lửa Daily Streak */}
            <div className="flex items-center gap-1.5 bg-orange-500/15 text-orange-500 px-3 py-1.5 rounded-full text-xs font-bold" title="Chuỗi ngày học liên tiếp">
              <Flame className="w-4 h-4 fill-orange-500" />
              <span>{streak} ngày</span>
            </div>

            <button
              onClick={toggleDarkMode}
              className={`p-2 rounded-xl border transition ${darkMode ? 'bg-slate-800 border-slate-700 text-amber-400' : 'bg-slate-100 border-slate-200 text-slate-600'}`}
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              onClick={() => supabase.auth.signOut()}
              className="text-sm text-slate-400 hover:text-red-500 flex items-center gap-1 transition"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {isTeacher && (
        <div className="max-w-5xl mx-auto px-4 pt-6">
          <div className={`p-6 rounded-3xl border-2 border-indigo-500/40 shadow-sm ${darkMode ? 'bg-indigo-950/30' : 'bg-indigo-50/70'}`}>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-indigo-600 text-white">
                  Chế độ Giáo viên theo dõi
                </span>
                <h2 className="text-lg font-bold mt-2">Báo cáo tiến độ học tập của học sinh</h2>
              </div>
              <button
                onClick={() => fetchVocabs(user.id, user.email)}
                className="text-xs font-semibold bg-indigo-600 text-white px-3.5 py-2 rounded-xl hover:bg-indigo-700 transition"
              >
                Làm mới dữ liệu
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className={`p-4 rounded-2xl border ${cardBg}`}>
                <p className="text-xs text-slate-400">Tổng từ đã lưu</p>
                <p className="text-2xl font-extrabold text-blue-500">{vocabs.length}</p>
              </div>
              <div className={`p-4 rounded-2xl border ${cardBg}`}>
                <p className="text-xs text-slate-400">Đã thuộc lòng</p>
                <p className="text-2xl font-extrabold text-emerald-500">
                  {vocabs.filter(v => (v.interval_days || 0) >= 4).length}
                </p>
              </div>
              <div className={`p-4 rounded-2xl border ${cardBg}`}>
                <p className="text-xs text-slate-400">Tổng lượt đã ôn</p>
                <p className="text-2xl font-extrabold text-indigo-500">
                  {vocabs.reduce((sum, v) => sum + (v.review_count || 0), 0)}
                </p>
              </div>
              <div className={`p-4 rounded-2xl border ${cardBg}`}>
                <p className="text-xs text-slate-400">Từ cần lưu ý (hay sai)</p>
                <p className="text-2xl font-extrabold text-red-500">
                  {vocabs.filter(v => (v.wrong_count || 0) > 0).length}
                </p>
              </div>
            </div>

            {vocabs.filter(v => (v.wrong_count || 0) > 0).length > 0 && (
              <div className={`p-4 rounded-2xl border ${cardBg}`}>
                <p className="text-xs font-bold text-red-500 uppercase mb-2">Các từ học sinh hay làm sai:</p>
                <div className="flex flex-wrap gap-2">
                  {vocabs
                    .filter(v => (v.wrong_count || 0) > 0)
                    .sort((a, b) => (b.wrong_count || 0) - (a.wrong_count || 0))
                    .map(v => (
                      <span key={v.id} className="text-xs px-3 py-1.5 rounded-xl bg-red-500/10 text-red-500 font-medium">
                        <strong>{v.word}</strong> ({v.meaning}) — sai {v.wrong_count} lần
                      </span>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* 3 Tab chính */}
        <div className={`flex flex-wrap gap-2 mb-8 p-1.5 rounded-2xl w-fit ${darkMode ? 'bg-slate-900 border border-slate-800' : 'bg-slate-200/70'}`}>
          {[
            { id: 'add', label: `+ Sổ từ vựng (${vocabs.length})` },
            { id: 'study', label: `⚡ Luyện tập (${dueSrsCount} cần ôn)` },
            { id: 'dashboard', label: '📊 Tiến độ & Hội thoại' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id as any); setStudyQueue([]) }}
              className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition ${
                activeTab === tab.id
                  ? (darkMode ? 'bg-blue-600 text-white shadow' : 'bg-white text-blue-600 shadow-sm')
                  : 'text-slate-500 hover:text-slate-400'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB 1: NHẬP TỪ VỰNG & COLLOCATIONS */}
        {activeTab === 'add' && (
          <div className="space-y-8">
            <div className={`p-6 rounded-3xl shadow-sm border ${cardBg}`}>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="font-bold text-lg">Thêm từ vựng mới (Tự phân tích ngữ cảnh)</h2>
                  <p className="text-xs text-slate-400">Hệ thống tự động tìm nghĩa, từ loại, cụm từ đi kèm (Collocations) và câu ví dụ</p>
                </div>
                <button
                  onClick={handleAnalyzeWords}
                  disabled={isAnalyzing}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 shadow-md"
                >
                  <Sparkles className="w-4 h-4" />
                  {isAnalyzing ? 'Đang phân tích...' : 'Phân tích tự động'}
                </button>
              </div>

              <textarea
                rows={4}
                placeholder={"Nhập mỗi từ tiếng Anh một dòng...\nVí dụ:\nambitious\nbreakthrough\nnegotiate"}
                value={wordsInput}
                onChange={e => setWordsInput(e.target.value)}
                className={`w-full p-4 border rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm ${inputBg}`}
              />

              {draftItems.length > 0 && (
                <div className="mt-6 space-y-3">
                  {draftItems.map((item, idx) => (
                    <div
                      key={idx}
                      className={`p-4 rounded-2xl border space-y-2 ${darkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
                    >
                      <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                        <div className="md:col-span-3 flex items-center gap-2">
                          <button onClick={() => speakText(item.word)} className="p-1.5 text-blue-500 rounded-lg">
                            <Volume2 className="w-4 h-4" />
                          </button>
                          <span className="font-bold">{item.word}</span>
                        </div>
                        <div className="md:col-span-2">
                          <input
                            value={item.pos}
                            onChange={e => updateDraftItem(idx, 'pos', e.target.value)}
                            placeholder="Từ loại..."
                            className={`w-full px-2.5 py-1.5 text-xs italic rounded-lg border ${inputBg}`}
                          />
                        </div>
                        <div className="md:col-span-3">
                          <input
                            value={item.meaning}
                            onChange={e => updateDraftItem(idx, 'meaning', e.target.value)}
                            placeholder="Nghĩa tiếng Việt..."
                            className={`w-full px-2.5 py-1.5 text-sm font-medium rounded-lg border ${inputBg}`}
                          />
                        </div>
                        <div className="md:col-span-4">
                          <input
                            value={item.collocations}
                            onChange={e => updateDraftItem(idx, 'collocations', e.target.value)}
                            placeholder="Collocations / Từ liên quan..."
                            className={`w-full px-2.5 py-1.5 text-xs rounded-lg border ${inputBg}`}
                          />
                        </div>
                      </div>
                      <input
                        value={item.example}
                        onChange={e => updateDraftItem(idx, 'example', e.target.value)}
                        placeholder="Câu ví dụ hội thoại..."
                        className={`w-full px-3 py-1.5 text-xs italic rounded-lg border ${inputBg}`}
                      />
                    </div>
                  ))}

                  <button
                    onClick={handleSaveVocabs}
                    disabled={isSaving}
                    className="mt-4 w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold py-3.5 rounded-2xl shadow-lg flex items-center justify-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    {isSaving ? 'Đang lưu...' : `Lưu ${draftItems.length} từ vào sổ từ vựng`}
                  </button>
                </div>
              )}
            </div>

            {/* Lịch sử từ vựng */}
            <div className="space-y-5">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-500" /> Sổ tay từ vựng theo ngày
              </h3>
              {Object.entries(groupedByDate).map(([date, items]) => (
                <div key={date} className={`rounded-3xl border shadow-sm overflow-hidden ${cardBg}`}>
                  <div className={`px-6 py-3 border-b flex justify-between items-center ${darkMode ? 'bg-slate-800/50 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                    <span className="font-semibold text-sm capitalize">{date}</span>
                    <span className="text-xs bg-blue-500/15 text-blue-500 px-3 py-1 rounded-full font-bold">{items.length} từ</span>
                  </div>
                  <div className={`divide-y ${darkMode ? 'divide-slate-800' : 'divide-slate-100'}`}>
                    {items.map(item => (
                      <div key={item.id} className="px-6 py-4 flex items-start justify-between gap-4 group">
                        <div className="space-y-1 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <button onClick={() => speakText(item.word)} className="p-1 text-slate-400 hover:text-blue-500">
                              <Volume2 className="w-4 h-4" />
                            </button>
                            <span className="font-bold text-base">{item.word}</span>
                            {item.part_of_speech && (
                              <span className="text-xs px-2 py-0.5 rounded-md bg-indigo-500/15 text-indigo-400 italic">
                                {item.part_of_speech}
                              </span>
                            )}
                            <span className="text-slate-400">—</span>
                            <span className="font-medium text-blue-500">{item.meaning}</span>
                          </div>
                          {item.collocations && (
                            <p className="pl-7 text-xs text-emerald-500 font-medium">{item.collocations}</p>
                          )}
                          {item.example && (
                            <div className="pl-7 flex items-center gap-2 text-xs text-slate-400">
                              <button onClick={() => speakText(item.example!)} className="hover:text-blue-500">
                                <Volume2 className="w-3.5 h-3.5" />
                              </button>
                              <span className="italic">"{item.example}"</span>
                            </div>
                          )}
                        </div>
                        <button onClick={() => handleDelete(item.id)} className="text-slate-400 hover:text-red-500 p-1.5 opacity-0 group-hover:opacity-100 transition">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 2: LUYỆN TẬP 5 CHẾ ĐỘ + SRS */}
        {activeTab === 'study' && (
          <div className={`p-6 sm:p-8 rounded-3xl shadow-sm border ${cardBg}`}>
            <div className="space-y-4 pb-6 border-b border-slate-500/20">
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'flashcard', label: 'Flashcard SRS', icon: Layers },
                  { id: 'quiz', label: 'Trắc nghiệm 4 đáp án', icon: HelpCircle },
                  { id: 'spelling', label: 'Gõ chính tả', icon: Keyboard },
                  { id: 'dictation', label: 'Nghe chép (Dictation)', icon: Headphones },
                  { id: 'speaking', label: 'Luyện phát âm (Micro)', icon: Mic },
                ].map(mode => {
                  const Icon = mode.icon
                  return (
                    <button
                      key={mode.id}
                      onClick={() => { setStudyMode(mode.id as any); setStudyQueue([]) }}
                      className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 border transition ${
                        studyMode === mode.id
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow'
                          : (darkMode ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600')
                      }`}
                    >
                      <Icon className="w-4 h-4" /> {mode.label}
                    </button>
                  )
                })}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <span className="text-xs font-bold uppercase text-slate-400">Bộ lọc từ vựng:</span>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { id: 'srs', label: `Đến hạn ôn SRS (${dueSrsCount})` },
                    { id: 'leech', label: `Từ hay sai (${leechWords.length})` },
                    { id: 'today', label: 'Hôm nay' },
                    { id: 'week', label: '7 ngày' },
                    { id: 'all', label: 'Tất cả' },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => { setTimeFilter(tab.id as any); setStudyQueue([]) }}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold border transition ${
                        timeFilter === tab.id
                          ? 'bg-blue-600 text-white border-blue-600'
                          : (darkMode ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-white border-slate-200 text-slate-600')
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {studyQueue.length === 0 ? (
              <div className="text-center py-14">
                <p className="mb-6 text-lg">
                  Có <strong className="text-blue-500 text-2xl">{getFilteredVocabs().length}</strong> từ sẵn sàng luyện tập
                </p>
                <button
                  onClick={() => startStudySession()}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold px-8 py-3.5 rounded-2xl shadow-lg inline-flex items-center gap-2"
                >
                  <Shuffle className="w-5 h-5" /> Bắt đầu phiên học
                </button>
              </div>
            ) : currentIndex < studyQueue.length ? (
              <div className="py-6 max-w-lg mx-auto">
                <div className="flex justify-between text-xs font-bold text-slate-400 mb-2">
                  <span>THẺ {currentIndex + 1} / {studyQueue.length}</span>
                  {studyMode !== 'flashcard' && <span className="text-emerald-500">ĐIỂM: {score}</span>}
                </div>
                <div className="w-full h-2 bg-slate-500/20 rounded-full overflow-hidden mb-8">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all"
                    style={{ width: `${((currentIndex + 1) / studyQueue.length) * 100}%` }}
                  />
                </div>

                {/* 1. FLASHCARD SRS */}
                {studyMode === 'flashcard' && (
                  <>
                    <div className="relative h-72 w-full [perspective:1000px]">
                      <motion.div
                        onClick={() => setIsFlipped(!isFlipped)}
                        animate={{ rotateY: isFlipped ? 180 : 0 }}
                        transition={{ duration: 0.45 }}
                        style={{ transformStyle: 'preserve-3d' }}
                        className="w-full h-full relative cursor-pointer"
                      >
                        <div
                          style={{ backfaceVisibility: 'hidden' }}
                          className={`absolute inset-0 border-2 rounded-3xl shadow-md flex flex-col items-center justify-center p-8 ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-50 border-slate-200'}`}
                        >
                          <button
                            onClick={(e) => speakText(studyQueue[currentIndex].word, e)}
                            className="absolute top-4 right-4 p-2.5 bg-blue-500/15 text-blue-500 rounded-full"
                          >
                            <Volume2 className="w-5 h-5" />
                          </button>
                          {studyQueue[currentIndex].part_of_speech && (
                            <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-500/15 text-indigo-400 italic mb-2">
                              {studyQueue[currentIndex].part_of_speech}
                            </span>
                          )}
                          <p className="text-4xl font-extrabold text-center">{studyQueue[currentIndex].word}</p>
                          <span className="text-xs text-slate-400 mt-6">Chạm vào thẻ để xem nghĩa & đánh giá độ nhớ</span>
                        </div>

                        <div
                          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
                          className="absolute inset-0 bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-3xl shadow-lg flex flex-col items-center justify-center p-6 text-center space-y-2"
                        >
                          <p className="text-3xl font-bold">{studyQueue[currentIndex].meaning}</p>
                          {studyQueue[currentIndex].collocations && (
                            <p className="text-xs text-amber-200 font-medium">{studyQueue[currentIndex].collocations}</p>
                          )}
                          {studyQueue[currentIndex].example && (
                            <p className="text-xs text-blue-100 italic bg-white/10 px-3 py-2 rounded-xl">
                              "{studyQueue[currentIndex].example}"
                            </p>
                          )}
                        </div>
                      </motion.div>
                    </div>

                    {/* 3 Nút đánh giá Spaced Repetition */}
                    <div className="mt-6">
                      <p className="text-center text-xs text-slate-400 mb-2">Đánh giá mức độ ghi nhớ (Tự động xếp lịch ôn):</p>
                      <div className="grid grid-cols-3 gap-2">
                        <button
                          onClick={() => { updateVocabProgress(studyQueue[currentIndex], 'hard'); advanceToNextCard() }}
                          className="py-3 rounded-2xl bg-red-500/15 text-red-500 hover:bg-red-500/25 font-semibold text-xs sm:text-sm"
                        >
                          Khó (10 phút)
                        </button>
                        <button
                          onClick={() => { updateVocabProgress(studyQueue[currentIndex], 'good'); advanceToNextCard() }}
                          className="py-3 rounded-2xl bg-amber-500/15 text-amber-500 hover:bg-amber-500/25 font-semibold text-xs sm:text-sm"
                        >
                          Tạm nhớ (1 ngày)
                        </button>
                        <button
                          onClick={() => { updateVocabProgress(studyQueue[currentIndex], 'easy'); advanceToNextCard() }}
                          className="py-3 rounded-2xl bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/25 font-semibold text-xs sm:text-sm"
                        >
                          Đã thuộc (5 ngày)
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* 2. TRẮC NGHIỆM 4 ĐÁP ÁN */}
                {studyMode === 'quiz' && (
                  <div className="space-y-5">
                    <div className={`p-8 rounded-3xl border text-center relative ${darkMode ? 'bg-slate-800/70 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                      <button onClick={() => speakText(studyQueue[currentIndex].word)} className="absolute top-4 right-4 p-2 text-blue-500">
                        <Volume2 className="w-5 h-5" />
                      </button>
                      <h3 className="text-3xl font-extrabold">{studyQueue[currentIndex].word}</h3>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      {quizOptions.map((opt, idx) => {
                        const isCorrect = opt === studyQueue[currentIndex].meaning
                        const isSelected = selectedOption === opt
                        let style = darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
                        if (selectedOption) {
                          if (isCorrect) style = 'bg-emerald-500/20 border-emerald-500 text-emerald-500 font-bold'
                          else if (isSelected) style = 'bg-red-500/20 border-red-500 text-red-500'
                        }
                        return (
                          <button
                            key={idx}
                            onClick={() => handleSelectQuiz(opt)}
                            className={`p-4 rounded-2xl border-2 text-left transition ${style}`}
                          >
                            <span className="font-bold mr-2">{['A.', 'B.', 'C.', 'D.'][idx]}</span> {opt}
                          </button>
                        )
                      })}
                    </div>
                    {selectedOption && (
                      <button onClick={advanceToNextCard} className="w-full py-3.5 bg-blue-600 text-white rounded-2xl font-semibold">
                        Câu tiếp theo →
                      </button>
                    )}
                  </div>
                )}

                {/* 3 & 4. GÕ CHÍNH TẢ & NGHE CHÉP DICTATION */}
                {(studyMode === 'spelling' || studyMode === 'dictation') && (
                  <div className="space-y-6">
                    <div className={`p-8 rounded-3xl border text-center ${darkMode ? 'bg-slate-800/70 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                      <button
                        onClick={() => speakText(studyQueue[currentIndex].word)}
                        className="mx-auto mb-3 px-5 py-3 bg-blue-600 text-white rounded-2xl shadow inline-flex items-center gap-2 font-semibold"
                      >
                        <Volume2 className="w-5 h-5" /> Nghe phát âm
                      </button>
                      {studyMode === 'spelling' ? (
                        <p className="text-2xl font-bold text-blue-500">{studyQueue[currentIndex].meaning}</p>
                      ) : (
                        <p className="text-sm text-slate-400">Chế độ Dictation: Nghe âm thanh và gõ chính xác từ tiếng Anh (đã ẩn nghĩa)</p>
                      )}
                    </div>

                    <form onSubmit={handleCheckTextAnswer} className="space-y-4">
                      <input
                        type="text"
                        autoFocus
                        placeholder="Gõ từ tiếng Anh tại đây..."
                        value={textInput}
                        onChange={e => {
                          setTextInput(e.target.value)
                          if (answerStatus === 'wrong') setAnswerStatus('idle')
                        }}
                        className={`w-full p-4 text-center text-xl font-bold rounded-2xl border-2 focus:outline-none ${
                          answerStatus === 'correct'
                            ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500'
                            : answerStatus === 'wrong'
                            ? 'border-red-500 bg-red-500/10 text-red-500'
                            : inputBg
                        }`}
                      />
                      {answerStatus === 'wrong' && (
                        <p className="text-center text-sm text-red-500">
                          Sai mất rồi! Gợi ý chữ đầu: <strong>{studyQueue[currentIndex].word[0]}...</strong>
                        </p>
                      )}
                      {answerStatus !== 'correct' ? (
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setTextInput(studyQueue[currentIndex].word)
                              setAnswerStatus('correct')
                            }}
                            className="px-4 py-3.5 rounded-2xl border border-slate-500/30 text-sm text-slate-400"
                          >
                            Hiện đáp án
                          </button>
                          <button type="submit" className="flex-1 py-3.5 bg-blue-600 text-white rounded-2xl font-semibold">
                            Kiểm tra
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2 text-center">
                          <p className="text-sm text-slate-400">Nghĩa: <strong>{studyQueue[currentIndex].meaning}</strong></p>
                          <button type="button" onClick={advanceToNextCard} className="w-full py-3.5 bg-emerald-600 text-white rounded-2xl font-semibold">
                            Từ tiếp theo →
                          </button>
                        </div>
                      )}
                    </form>
                  </div>
                )}

                {/* 5. LUYỆN PHÁT ÂM BẰNG MICRO */}
                {studyMode === 'speaking' && (
                  <div className="space-y-6 text-center">
                    <div className={`p-8 rounded-3xl border space-y-3 ${darkMode ? 'bg-slate-800/70 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
                      <button onClick={() => speakText(studyQueue[currentIndex].word)} className="text-blue-500 inline-flex items-center gap-1 text-xs font-semibold">
                        <Volume2 className="w-4 h-4" /> Nghe mẫu
                      </button>
                      <h3 className="text-4xl font-extrabold">{studyQueue[currentIndex].word}</h3>
                      <p className="text-blue-500 font-medium">{studyQueue[currentIndex].meaning}</p>
                    </div>

                    <button
                      onClick={handleStartSpeechRecognition}
                      disabled={isListening}
                      className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center text-white shadow-xl transition ${
                        isListening ? 'bg-red-500 animate-pulse' : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                    >
                      <Mic className="w-9 h-9" />
                    </button>
                    <p className="text-xs text-slate-400">
                      {isListening ? 'Đang nghe... Hãy đọc to từ tiếng Anh!' : 'Bấm vào Micro và đọc to từ trên'}
                    </p>

                    {spokenText && (
                      <div className={`p-4 rounded-2xl border ${speechResult === 'pass' ? 'bg-emerald-500/15 border-emerald-500 text-emerald-500' : 'bg-red-500/15 border-red-500 text-red-500'}`}>
                        <p className="text-xs">Hệ thống nghe được: <strong>"{spokenText}"</strong></p>
                        <p className="font-bold mt-1">
                          {speechResult === 'pass' ? 'Phát âm chuẩn xác!' : 'Chưa khớp, hãy bấm Micro thử đọc lại nhé!'}
                        </p>
                      </div>
                    )}

                    <button onClick={advanceToNextCard} className="w-full py-3.5 bg-slate-700 text-white rounded-2xl font-semibold">
                      Chuyển sang từ tiếp theo →
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12 space-y-4">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                <h3 className="text-2xl font-bold">Hoàn thành phiên luyện tập!</h3>
                <button onClick={() => startStudySession()} className="bg-blue-600 text-white font-semibold px-6 py-3 rounded-2xl inline-flex items-center gap-2">
                  <RotateCcw className="w-4 h-4" /> Luyện tập lượt mới
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: DASHBOARD TIẾN ĐỘ, LEECH WORDS & MINI-STORY */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8">
            {/* 4 Thẻ chỉ số học tập */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className={`p-5 rounded-3xl border ${cardBg}`}>
                <p className="text-xs text-slate-400 font-bold">CHUỖI NGÀY HỌC</p>
                <p className="text-3xl font-extrabold text-orange-500 mt-1 flex items-center gap-1">
                  <Flame className="w-7 h-7 fill-orange-500" /> {streak}
                </p>
              </div>
              <div className={`p-5 rounded-3xl border ${cardBg}`}>
                <p className="text-xs text-slate-400 font-bold">ĐÃ ÔN HÔM NAY</p>
                <p className="text-3xl font-extrabold text-blue-500 mt-1">{todayReviewed} <span className="text-sm font-normal text-slate-400">lượt</span></p>
              </div>
              <div className={`p-5 rounded-3xl border ${cardBg}`}>
                <p className="text-xs text-slate-400 font-bold">ĐÃ THUỘC LÒNG</p>
                <p className="text-3xl font-extrabold text-emerald-500 mt-1">{masteredCount} / {vocabs.length}</p>
              </div>
              <div className={`p-5 rounded-3xl border ${cardBg}`}>
                <p className="text-xs text-slate-400 font-bold">CẦN ÔN HÔM NAY</p>
                <p className="text-3xl font-extrabold text-indigo-500 mt-1">{dueSrsCount}</p>
              </div>
            </div>

            {/* Tạo đoạn hội thoại ngắn từ từ vựng mới lưu */}
            <div className={`p-6 rounded-3xl border space-y-4 ${cardBg}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-indigo-500" /> Hội thoại thực tế từ từ vựng của bạn
                  </h3>
                  <p className="text-xs text-slate-400">Ghép 5 từ mới nhất thành đoạn hội thoại ngắn để luyện đọc hiểu ngữ cảnh</p>
                </div>
                <button
                  onClick={handleGenerateMiniStory}
                  disabled={isGeneratingStory}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold"
                >
                  {isGeneratingStory ? 'Đang tạo hội thoại...' : 'Tạo đoạn hội thoại ngay'}
                </button>
              </div>

              {storyData && (
                <div className={`p-5 rounded-2xl border space-y-3 ${darkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-indigo-50/50 border-indigo-100'}`}>
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-indigo-500 uppercase">Đoạn hội thoại mẫu</span>
                    <button onClick={() => speakText(storyData.storyEn)} className="text-xs bg-indigo-600 text-white px-3 py-1 rounded-lg inline-flex items-center gap-1">
                      <Volume2 className="w-3.5 h-3.5" /> Nghe cả đoạn
                    </button>
                  </div>
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed font-medium">
                    {storyData.storyEn}
                  </pre>
                  <div className="pt-2 border-t border-slate-500/20">
                    <pre className="whitespace-pre-wrap font-sans text-xs text-slate-400 leading-relaxed">
                      {storyData.storyVi}
                    </pre>
                  </div>
                </div>
              )}
            </div>

            {/* Danh sách Từ hay sai (Leech Words) */}
            <div className={`p-6 rounded-3xl border space-y-4 ${cardBg}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-lg flex items-center gap-2 text-red-500">
                    <AlertTriangle className="w-5 h-5" /> Top từ hay làm sai (Leech Words)
                  </h3>
                  <p className="text-xs text-slate-400">Hệ thống tự động ghi nhận những từ học sinh hay chọn nhầm hoặc gõ sai</p>
                </div>
                {leechWords.length > 0 && (
                  <button
                    onClick={() => {
                      setActiveTab('study')
                      setTimeFilter('leech')
                      startStudySession(leechWords)
                    }}
                    className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-semibold"
                  >
                    Ôn cấp cứu {leechWords.length} từ này
                  </button>
                )}
              </div>

              {leechWords.length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">Tuyệt vời! Chưa có từ nào bị đánh dấu hay sai.</p>
              ) : (
                <div className="divide-y divide-slate-500/15">
                  {leechWords.map(w => (
                    <div key={w.id} className="py-3 flex items-center justify-between">
                      <div>
                        <span className="font-bold mr-2">{w.word}</span>
                        <span className="text-sm text-slate-400">— {w.meaning}</span>
                      </div>
                      <span className="text-xs bg-red-500/15 text-red-500 px-2.5 py-1 rounded-full font-bold">
                        Sai {w.wrong_count} lần
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
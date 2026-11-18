import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Chế độ 1: Tạo đoạn hội thoại ngắn từ danh sách từ vựng
    if (body.action === 'story') {
      const words: string[] = body.words || []
      if (words.length === 0) {
        return NextResponse.json({ error: 'Chưa có từ vựng' }, { status: 400 })
      }
      const selected = words.slice(0, 5)
      const dialogueLines = [
        `Alex: Hey, have you thought about "${selected[0]}" recently?`,
        selected[1]
          ? `Sam: Yes! Actually, "${selected[1]}" is something I really care about.`
          : `Sam: Yes! I use it in my work almost every day.`,
        selected[2]
          ? `Alex: That makes sense. Whenever I deal with "${selected[2]}", I feel the same way.`
          : `Alex: That's great to hear. Practice makes it much easier.`,
        selected[3]
          ? `Sam: True, especially when "${selected[3]}" becomes part of our daily routine${selected[4] ? ` alongside "${selected[4]}"` : ''}.`
          : `Sam: Let's keep practicing these new expressions together!`,
      ]
      const storyEn = dialogueLines.join('\n')

      // Dịch đoạn hội thoại sang tiếng Việt
      const transRes = await fetch(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=${encodeURIComponent(storyEn)}`
      )
      const transData = await transRes.json()
      const storyVi = transData[0]?.map((item: any) => item[0]).join('') || ''

      return NextResponse.json({ storyEn, storyVi, highlightedWords: selected })
    }

    // Chế độ 2: Phân tích chi tiết từng từ vựng
    const { words } = body
    if (!words || !Array.isArray(words)) {
      return NextResponse.json({ error: 'Danh sách từ không hợp lệ' }, { status: 400 })
    }

    const results = await Promise.all(
      words.map(async (word: string) => {
        const cleanWord = word.trim()
        if (!cleanWord) return { meaning: '', pos: '', example: '', collocations: '' }

        // Dịch nghĩa tiếng Việt
        const transRes = await fetch(
          `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=${encodeURIComponent(cleanWord)}`
        )
        const transData = await transRes.json()
        const meaning = transData[0]?.[0]?.[0] || ''

        // Lấy từ loại, ví dụ và từ liên quan từ từ điển
        let pos = ''
        let example = ''
        let collocations = ''
        try {
          const dictRes = await fetch(
            `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanWord.toLowerCase())}`
          )
          if (dictRes.ok) {
            const dictData = await dictRes.json()
            const firstEntry = dictData[0]
            if (firstEntry?.meanings?.length > 0) {
              pos = firstEntry.meanings[0].partOfSpeech || ''
              const synonyms: string[] = []
              for (const m of firstEntry.meanings) {
                if (m.synonyms?.length) synonyms.push(...m.synonyms.slice(0, 2))
                const foundEx = m.definitions?.find((d: any) => d.example)?.example
                if (!example && foundEx) example = foundEx
              }
              if (synonyms.length > 0) {
                collocations = `Gợi ý liên quan: ${Array.from(new Set(synonyms)).slice(0, 3).join(', ')}`
              }
            }
          }
        } catch {
          // Bỏ qua nếu không tìm thấy trong từ điển đơn
        }

        if (!example) {
          example = `I often use "${cleanWord}" when talking with my friends.`
        }
        if (!collocations) {
          collocations = `to ${cleanWord} / very ${cleanWord}`
        }

        return { meaning, pos, example, collocations }
      })
    )

    return NextResponse.json({ results })
  } catch (error) {
    return NextResponse.json({ error: 'Lỗi xử lý dữ liệu' }, { status: 500 })
  }
}
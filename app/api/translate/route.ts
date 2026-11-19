import { NextResponse } from 'next/server'

// Hàm tạo câu ví dụ tự nhiên theo từ loại và ngữ cảnh khi từ điển thiếu ví dụ
function generateNaturalExample(word: string, pos: string): string {
  const w = word.trim()
  switch (pos) {
    case 'adjective':
      return `She has a remarkably ${w} mindset that inspires everyone on the team.`
    case 'verb':
      return `We need to ${w} our strategy carefully before launching the next phase.`
    case 'noun':
      return `A deeper understanding of ${w} plays a crucial role in long-term success.`
    case 'adverb':
      return `He responded ${w} to the unexpected changes during the meeting.`
    default:
      // Phân loại thông minh nếu là cụm từ (nhiều hơn 1 từ)
      if (w.includes(' ')) {
        return `In professional conversations, people frequently use the expression "${w}" to make their point clearer.`
      }
      return `The concept of "${w}" often comes up in modern discussions and real-world scenarios.`
  }
}

// Hàm tạo cụm từ đi kèm (Collocations) chuẩn theo từng từ loại
function generateSmartCollocations(word: string, pos: string): string {
  const w = word.trim().toLowerCase()
  switch (pos) {
    case 'adjective':
      return `highly ${w}, deeply ${w}, ${w} person / goal`
    case 'verb':
      return `${w} effectively, try to ${w}, ${w} a problem`
    case 'noun':
      return `key ${w}, sense of ${w}, ${w} development`
    case 'adverb':
      return `act ${w}, speak ${w}, ${w} important`
    default:
      return `use "${w}" in context, common expression`
  }
}

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
        `Alex: Have you noticed how important "${selected[0]}" has become in our projects lately?`,
        selected[1]
          ? `Sam: Definitely! Combining "${selected[1]}" with our current approach makes a huge difference.`
          : `Sam: Definitely! It really changes the way we solve daily challenges.`,
        selected[2]
          ? `Alex: I agree. Whenever we focus on "${selected[2]}", the whole workflow feels smoother.`
          : `Alex: That's true. Keeping things structured always pays off.`,
        selected[3]
          ? `Sam: Exactly, especially when "${selected[3]}" aligns well${selected[4] ? ` with "${selected[4]}"` : ''}.`
          : `Sam: Let's keep applying these ideas in our upcoming tasks!`,
      ]
      const storyEn = dialogueLines.join('\n')

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

        // 1. Dịch nghĩa tiếng Việt
        const transRes = await fetch(
          `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&q=${encodeURIComponent(cleanWord)}`
        )
        const transData = await transRes.json()
        const meaning = transData[0]?.[0]?.[0] || ''

        // 2. Lấy từ loại, ví dụ thực tế & từ liên quan từ 2 nguồn từ điển
        let pos = ''
        let example = ''
        let collocations = ''

        try {
          const dictRes = await fetch(
            `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(cleanWord.toLowerCase())}`
          )
          if (dictRes.ok) {
            const dictData = await dictRes.json()
            const synonyms: string[] = []

            for (const entry of dictData) {
              for (const m of entry.meanings || []) {
                if (!pos && m.partOfSpeech) pos = m.partOfSpeech
                if (m.synonyms?.length) synonyms.push(...m.synonyms)

                for (const def of m.definitions || []) {
                  if (!example && def.example) {
                    example = def.example
                  }
                  if (def.synonyms?.length) {
                    synonyms.push(...def.synonyms)
                  }
                }
              }
            }

            if (synonyms.length > 0) {
              const uniqueSyns = Array.from(new Set(synonyms)).slice(0, 3)
              collocations = `Từ đồng nghĩa / liên quan: ${uniqueSyns.join(', ')}`
            }
          }
        } catch {
          // Bỏ qua nếu từ điển không có mục từ này
        }

        // 3. Nếu nguồn 1 không có câu ví dụ, tra thêm từ nguồn Wiktionary/Datamuse để lấy cụm từ thực tế
        if (!collocations) {
          try {
            const dmRes = await fetch(
              `https://api.datamuse.com/words?rel_trg=${encodeURIComponent(cleanWord.toLowerCase())}&max=3`
            )
            if (dmRes.ok) {
              const dmData = await dmRes.json()
              if (dmData?.length > 0) {
                const related = dmData.map((item: any) => item.word).join(', ')
                collocations = `Ngữ cảnh thường gặp: ${related}`
              }
            }
          } catch {
            // Dự phòng bên dưới
          }
        }

        // 4. Áp dụng câu ví dụ và cụm từ tùy biến theo từ loại nếu cả 2 nguồn đều thiếu
        if (!example) {
          example = generateNaturalExample(cleanWord, pos)
        }
        if (!collocations) {
          collocations = generateSmartCollocations(cleanWord, pos)
        }

        return { meaning, pos, example, collocations }
      })
    )

    return NextResponse.json({ results })
  } catch (error) {
    return NextResponse.json({ error: 'Lỗi xử lý dữ liệu' }, { status: 500 })
  }
}
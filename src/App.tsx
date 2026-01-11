import { useEffect, useRef, useState } from 'react'
import './App.css'

type Card = {
  id: number
  animal: string
  isFlipped: boolean
  isMatched: boolean
}

type SoundType = 'flip' | 'match' | 'mismatch' | 'win'

const animals = ['🐶', '🐱', '🐼', '🦊', '🐸', '🐵', '🦁', '🐰']

const createShuffledCards = (): Card[] => {
  const duplicated = animals.flatMap((animal) => [animal, animal])
  const shuffled = [...duplicated]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1))
    ;[shuffled[index], shuffled[randomIndex]] = [
      shuffled[randomIndex],
      shuffled[index],
    ]
  }

  return shuffled.map((animal, index) => ({
    id: index + 1,
    animal,
    isFlipped: true,
    isMatched: false,
  }))
}

const App = () => {
  const [cards, setCards] = useState<Card[]>([])
  const [selected, setSelected] = useState<number[]>([])
  const [lockBoard, setLockBoard] = useState(false)
  const [isRevealing, setIsRevealing] = useState(false)
  const [matchedPairsCount, setMatchedPairsCount] = useState(0)
  const [showWinModal, setShowWinModal] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const audioContextRef = useRef<AudioContext | null>(null)
  const mismatchTimeoutRef = useRef<number | null>(null)
  const revealTimeoutRef = useRef<number | null>(null)
  const hasInteractedRef = useRef(false)

  const remainingPairs = 8 - matchedPairsCount
  const remainingCards = 16 - matchedPairsCount * 2

  const initAudio = () => {
    if (!soundEnabled) {
      return
    }
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext()
    }
    if (audioContextRef.current.state === 'suspended') {
      void audioContextRef.current.resume()
    }
  }

  const playSound = (type: SoundType) => {
    if (!soundEnabled) {
      return
    }
    if (!audioContextRef.current) {
      return
    }

    const context = audioContextRef.current
    const oscillator = context.createOscillator()
    const gainNode = context.createGain()

    const settings = {
      flip: { frequency: 520, duration: 0.08, volume: 0.08 },
      match: { frequency: 720, duration: 0.16, volume: 0.1 },
      mismatch: { frequency: 220, duration: 0.2, volume: 0.1 },
      win: { frequency: 860, duration: 0.3, volume: 0.12 },
    }[type]

    const now = context.currentTime
    oscillator.frequency.value = settings.frequency
    oscillator.type = 'sine'
    gainNode.gain.value = settings.volume

    oscillator.connect(gainNode)
    gainNode.connect(context.destination)

    oscillator.start(now)
    oscillator.stop(now + settings.duration)
  }

  const resetTimeouts = () => {
    if (mismatchTimeoutRef.current) {
      window.clearTimeout(mismatchTimeoutRef.current)
      mismatchTimeoutRef.current = null
    }
    if (revealTimeoutRef.current) {
      window.clearTimeout(revealTimeoutRef.current)
      revealTimeoutRef.current = null
    }
  }

  const startGame = () => {
    resetTimeouts()
    setShowWinModal(false)
    setMatchedPairsCount(0)
    setSelected([])
    setLockBoard(true)
    setIsRevealing(true)

    const shuffledCards = createShuffledCards()
    setCards(shuffledCards)

    revealTimeoutRef.current = window.setTimeout(() => {
      setCards((prev) => prev.map((card) => ({ ...card, isFlipped: false })))
      setIsRevealing(false)
      setLockBoard(false)
    }, 1000)
  }

  useEffect(() => {
    startGame()
    return () => {
      resetTimeouts()
    }
  }, [])

  useEffect(() => {
    if (selected.length !== 2) {
      return
    }

    setLockBoard(true)

    const [firstId, secondId] = selected
    const firstCard = cards.find((card) => card.id === firstId)
    const secondCard = cards.find((card) => card.id === secondId)

    if (!firstCard || !secondCard) {
      setSelected([])
      setLockBoard(false)
      return
    }

    if (firstCard.animal === secondCard.animal) {
      setCards((prev) =>
        prev.map((card) =>
          card.id === firstId || card.id === secondId
            ? { ...card, isMatched: true }
            : card,
        ),
      )
      setMatchedPairsCount((prev) => prev + 1)
      setSelected([])
      setLockBoard(false)
      playSound('match')
      return
    }

    playSound('mismatch')
    mismatchTimeoutRef.current = window.setTimeout(() => {
      setCards((prev) =>
        prev.map((card) =>
          card.id === firstId || card.id === secondId
            ? { ...card, isFlipped: false }
            : card,
        ),
      )
      setSelected([])
      setLockBoard(false)
    }, 800)
  }, [selected, cards])

  useEffect(() => {
    if (matchedPairsCount === 8) {
      setShowWinModal(true)
      playSound('win')
    }
  }, [matchedPairsCount])

  const handleCardClick = (cardId: number) => {
    if (isRevealing || lockBoard) {
      return
    }
    const clickedCard = cards.find((card) => card.id === cardId)
    if (!clickedCard || clickedCard.isMatched || clickedCard.isFlipped) {
      return
    }

    if (!hasInteractedRef.current) {
      hasInteractedRef.current = true
      initAudio()
    }

    if (selected.length === 1) {
      setLockBoard(true)
    }

    setCards((prev) =>
      prev.map((card) =>
        card.id === cardId ? { ...card, isFlipped: true } : card,
      ),
    )
    setSelected((prev) => [...prev, cardId])
    playSound('flip')
  }

  const handleRestart = () => {
    if (!hasInteractedRef.current) {
      hasInteractedRef.current = true
      initAudio()
    }
    startGame()
  }

  const handleSoundToggle = () => {
    setSoundEnabled((prev) => {
      const next = !prev
      if (!hasInteractedRef.current) {
        hasInteractedRef.current = true
      }
      if (next && hasInteractedRef.current) {
        initAudio()
      }
      return next
    })
  }

  return (
    <div className="app">
      <header className="hud">
        <div className="hud__stats">
          <div className="hud__item">
            <span className="hud__label">남은 쌍</span>
            <strong>{remainingPairs}</strong>
          </div>
          <div className="hud__item">
            <span className="hud__label">남은 카드</span>
            <strong>{remainingCards}</strong>
          </div>
        </div>
        <div className="hud__actions">
          <button className="hud__button" type="button" onClick={handleSoundToggle}>
            사운드 {soundEnabled ? 'ON' : 'OFF'}
          </button>
          <button className="hud__button hud__button--primary" type="button" onClick={handleRestart}>
            다시하기
          </button>
        </div>
      </header>

      {isRevealing && <div className="reveal-banner">기억해보세요!</div>}

      <main className="board" aria-live="polite">
        {cards.map((card) => (
          <button
            key={card.id}
            type="button"
            className={`card ${card.isFlipped ? 'is-flipped' : ''} ${
              card.isMatched ? 'is-matched' : ''
            }`}
            onClick={() => handleCardClick(card.id)}
            disabled={lockBoard || isRevealing}
            aria-pressed={card.isFlipped}
            aria-label={card.isFlipped ? `카드 ${card.animal}` : '카드 뒤집기'}
          >
            <span className="card__inner">
              <span className="card__face card__face--front">❓</span>
              <span className="card__face card__face--back">{card.animal}</span>
            </span>
          </button>
        ))}
      </main>

      {showWinModal && (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="modal__content">
            <h2>성공입니다! 🎉</h2>
            <p>모든 동물 친구를 찾았어요.</p>
            <button
              className="hud__button hud__button--primary"
              type="button"
              onClick={handleRestart}
            >
              다시하기
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App

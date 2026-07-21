'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react'

const BOARD_COLS = 22
const BOARD_ROWS = 6
const TOTAL_TILES = BOARD_COLS * BOARD_ROWS
const FLIP_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!?#@$%&*'

const DEFAULT_MESSAGES = [
  'GOOD MORNING',
  'TAKE A BREAK',
  'GET BACK TO REAL WORK',
  'YOU GOT THIS',
  'HELLO WORLD',
  'SHIP IT TODAY',
  'MAKE IT AWESOME',
] as const

const PRESET_CHIPS = [
  { id: 'morning', label: 'Good morning', text: 'GOOD MORNING' },
  { id: 'focus', label: 'Deep focus', text: 'DEEP FOCUS MODE' },
  { id: 'ship', label: 'Ship it', text: 'SHIP IT TODAY' },
  { id: 'break', label: 'Break time', text: 'TAKE A BREAK' },
  { id: 'awesome', label: 'Make it awesome', text: 'MAKE IT AWESOME' },
] as const

type TileColor =
  | 'vestaboard-tile-blank'
  | 'vestaboard-tile-offwhite'
  | 'vestaboard-tile-yellow'
  | 'vestaboard-tile-orange'
  | 'vestaboard-tile-red'
  | 'vestaboard-tile-blue'
  | 'vestaboard-tile-green'
  | 'vestaboard-tile-purple'

type MessageEntry = {
  id: string
  text: string
  board: string
  timestamp: string
}

type TileMotion = {
  delayMs: number
  intensity: number
  wobble: number
}

function sanitizeCharacters(text: string) {
  return text
    .toUpperCase()
    .replace(/[^A-Z0-9 .,!?@#$%^&*()\-_+=;:'"<>/\\[\]{}|~`]/g, '')
}

function layoutMessage(text: string): string {
  const clean = sanitizeCharacters(text).trim()
  if (!clean) return ''.padEnd(TOTAL_TILES, ' ')

  const words = clean.split(/\s+/).filter(Boolean)
  const lines: string[] = Array.from({ length: BOARD_ROWS }, () => '')
  let row = 0

  for (const word of words) {
    if (row >= BOARD_ROWS) break

    if (word.length > BOARD_COLS) {
      if (lines[row]) row += 1
      let offset = 0
      while (offset < word.length && row < BOARD_ROWS) {
        lines[row] = word.slice(offset, offset + BOARD_COLS)
        offset += BOARD_COLS
        row += 1
      }
      continue
    }

    if (!lines[row]) {
      lines[row] = word
      continue
    }

    if (`${lines[row]} ${word}`.length <= BOARD_COLS) {
      lines[row] = `${lines[row]} ${word}`
      continue
    }

    row += 1
    if (row < BOARD_ROWS) lines[row] = word
  }

  const usedRows = Math.max(1, lines.filter((line) => line.length > 0).length)
  const startRow = Math.floor((BOARD_ROWS - usedRows) / 2)
  const board = Array.from({ length: BOARD_ROWS }, () => ''.padEnd(BOARD_COLS, ' '))

  for (let i = 0; i < usedRows; i += 1) {
    const line = lines[i]
    const leftPad = Math.floor((BOARD_COLS - line.length) / 2)
    board[startRow + i] = `${' '.repeat(leftPad)}${line}`.padEnd(BOARD_COLS, ' ')
  }

  return board.join('')
}

function getTileColorClass(char: string, index: number): TileColor {
  if (char === ' ') return 'vestaboard-tile-blank'

  const hash = (char.charCodeAt(0) * 31 + index * 17) % 19
  if (hash === 0 || hash === 7) return 'vestaboard-tile-yellow'
  if (hash === 1 || hash === 11) return 'vestaboard-tile-orange'
  if (hash === 2) return 'vestaboard-tile-red'
  if (hash === 3 || hash === 13) return 'vestaboard-tile-blue'
  if (hash === 4 || hash === 14) return 'vestaboard-tile-green'
  if (hash === 5) return 'vestaboard-tile-purple'
  return 'vestaboard-tile-offwhite'
}

function formatTime(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${hours}:${minutes}`
}

function createMessageId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

function randomGlyph(avoid = ' ') {
  let glyph = FLIP_ALPHABET[Math.floor(Math.random() * FLIP_ALPHABET.length)]
  let guard = 0
  while (glyph === avoid && guard < 6) {
    glyph = FLIP_ALPHABET[Math.floor(Math.random() * FLIP_ALPHABET.length)]
    guard += 1
  }
  return glyph
}

function scrambleBoard(origin: string, target: string, progress: number) {
  const source = origin.padEnd(TOTAL_TILES, ' ')
  const goal = target.padEnd(TOTAL_TILES, ' ')
  let next = ''

  for (let index = 0; index < TOTAL_TILES; index += 1) {
    const from = source[index] ?? ' '
    const to = goal[index] ?? ' '

    if (from === to) {
      next += to
      continue
    }

    // Chaotic phase: most changed tiles stay random mid-transition.
    if (progress < 0.72) {
      const lag = ((index * 17 + Math.floor(progress * 40)) % 11) / 11
      if (progress + lag * 0.18 < 0.82) {
        next += Math.random() > 0.18 ? randomGlyph(to) : from
        continue
      }
    }

    // Settle with leftover glitches so arrival feels mechanical, not perfect.
    if (progress < 0.9 && Math.random() > 0.84) {
      next += randomGlyph(to)
      continue
    }

    next += to
  }

  return next
}

function createMotionMap(changed: number[], seed: number) {
  const map = new Map<number, TileMotion>()

  for (const index of changed) {
    const row = Math.floor(index / BOARD_COLS)
    const col = index % BOARD_COLS
    const turbulence = ((index * 53 + seed * 17) % 97) / 97
    const reverseWave = ((seed + row * 13 + col * 3) % 2 === 0 ? 1 : -1)
    const delayMs = Math.floor(
      Math.abs(Math.sin((index + seed) * 0.73)) * 520 +
        Math.abs(Math.cos((col - row + seed) * 0.41)) * 360 +
        turbulence * 280 +
        reverseWave * 40 +
        Math.random() * 220,
    )

    map.set(index, {
      delayMs: Math.min(delayMs, 980),
      intensity: 0.65 + turbulence * 0.7,
      wobble: (turbulence - 0.5) * 10,
    })
  }

  return map
}

function Tile({
  char,
  index,
  isFlipping,
  motion,
}: {
  char: string
  index: number
  isFlipping: boolean
  motion?: TileMotion
}) {
  const colorClass = getTileColorClass(char, index)
  const displayChar = char === ' ' ? '\u00A0' : char
  const row = Math.floor(index / BOARD_COLS) + 1
  const col = (index % BOARD_COLS) + 1
  const style = isFlipping && motion
    ? ({
        animationDelay: `${motion.delayMs}ms`,
        animationDuration: `${720 + motion.intensity * 380}ms`,
        ['--tile-wobble' as string]: `${motion.wobble}deg`,
        ['--tile-kick' as string]: `${2 + motion.intensity * 3}px`,
      } as CSSProperties)
    : undefined

  return (
    <div
      className={`vestaboard-tile vestaboard-tile-${index} ${colorClass} ${isFlipping ? 'vestaboard-tile-flipping' : ''}`}
      style={style}
      data-builder-id={`vestaboard-tile-${row}-${col}`}
      aria-hidden="true"
    >
      <span className={`vestaboard-tile-char vestaboard-tile-char-${index}`}>{displayChar}</span>
    </div>
  )
}

export default function Home() {
  const [input, setInput] = useState('')
  const [displayMessage, setDisplayMessage] = useState(() => layoutMessage(DEFAULT_MESSAGES[0]))
  const [liveLabel, setLiveLabel] = useState<string>(DEFAULT_MESSAGES[0])
  const [flippingIndices, setFlippingIndices] = useState<Set<number>>(() => new Set())
  const [motionMap, setMotionMap] = useState<Map<number, TileMotion>>(() => new Map())
  const [messages, setMessages] = useState<MessageEntry[]>([])
  const [messageVersion, setMessageVersion] = useState(0)
  const [isBroadcasting, setIsBroadcasting] = useState(false)
  const timersRef = useRef<number[]>([])

  const displayChars = useMemo(() => displayMessage.padEnd(TOTAL_TILES, ' ').split(''), [displayMessage])
  const previewBoard = useMemo(() => layoutMessage(input), [input])
  const filledTiles = useMemo(() => displayChars.filter((char) => char !== ' ').length, [displayChars])
  const draftLength = sanitizeCharacters(input).length

  const clearTimers = useCallback(() => {
    for (const timer of timersRef.current) window.clearTimeout(timer)
    timersRef.current = []
  }, [])

  useEffect(() => () => clearTimers(), [clearTimers])

  const runChaoticTransition = useCallback(
    (fromBoard: string, toBoard: string, options?: { scrambleAll?: boolean }) => {
      clearTimers()

      const source = fromBoard.padEnd(TOTAL_TILES, ' ')
      const target = toBoard.padEnd(TOTAL_TILES, ' ')
      const changed: number[] = []

      for (let index = 0; index < TOTAL_TILES; index += 1) {
        if (options?.scrambleAll || source[index] !== target[index]) changed.push(index)
      }

      if (changed.length === 0) {
        setDisplayMessage(target)
        setFlippingIndices(new Set())
        setMotionMap(new Map())
        setIsBroadcasting(false)
        return
      }

      // Extra chaos: knock a few unchanged neighboring tiles into the scramble storm.
      if (!options?.scrambleAll) {
        const collateral = Math.min(18, Math.floor(changed.length * 0.22) + 4)
        for (let i = 0; i < collateral; i += 1) {
          const base = changed[Math.floor(Math.random() * changed.length)]
          const neighbor = Math.min(TOTAL_TILES - 1, Math.max(0, base + (Math.random() > 0.5 ? 1 : -1)))
          if (!changed.includes(neighbor)) changed.push(neighbor)
        }
      }

      const seed = Date.now() % 1000
      const motions = createMotionMap(changed, seed)
      setIsBroadcasting(true)
      setFlippingIndices(new Set(changed))
      setMotionMap(motions)
      setMessageVersion((version) => version + 1)

      // First impact: explode into disorder immediately.
      setDisplayMessage(scrambleBoard(source, target, 0.15))

      const waveCount = 7
      for (let step = 1; step <= waveCount; step += 1) {
        const progress = step / waveCount
        const timer = window.setTimeout(() => {
          setDisplayMessage(scrambleBoard(source, target, progress))
          if (step === waveCount) {
            setDisplayMessage(target)
            setFlippingIndices(new Set())
            setMotionMap(new Map())
            setIsBroadcasting(false)
          }
        }, 110 + step * 115 + Math.floor(Math.random() * 35))
        timersRef.current.push(timer)
      }
    },
    [clearTimers],
  )

  const publishBoard = useCallback(
    (rawText: string, options?: { recordHistory?: boolean }) => {
      const trimmed = rawText.trim()
      if (!trimmed || isBroadcasting) return false

      const nextBoard = layoutMessage(trimmed)
      const previousBoard = displayMessage.padEnd(TOTAL_TILES, ' ')
      const label = sanitizeCharacters(trimmed).replace(/\s+/g, ' ').trim()

      setLiveLabel(label || 'BLANK BOARD')
      runChaoticTransition(previousBoard, nextBoard)

      if (options?.recordHistory !== false) {
        const now = new Date()
        const historyText = trimmed.length > 48 ? `${trimmed.slice(0, 45)}...` : trimmed
        setMessages((previous) => [
          {
            id: createMessageId(),
            text: historyText,
            board: nextBoard,
            timestamp: formatTime(now),
          },
          ...previous.slice(0, 7),
        ])
      }

      return true
    },
    [displayMessage, isBroadcasting, runChaoticTransition],
  )

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const form = event.currentTarget
      if (!publishBoard(input)) return
      setInput('')
      form.reset()
    },
    [input, publishBoard],
  )

  const handlePreset = useCallback(
    (text: string) => {
      publishBoard(text)
      setInput('')
    },
    [publishBoard],
  )

  const handleShuffle = useCallback(() => {
    const next = DEFAULT_MESSAGES[Math.floor(Math.random() * DEFAULT_MESSAGES.length)]
    publishBoard(next)
  }, [publishBoard])

  const handleClear = useCallback(() => {
    publishBoard(' ', { recordHistory: false })
    setLiveLabel('BLANK BOARD')
    setInput('')
  }, [publishBoard])

  const handleReplay = useCallback(
    (entry: MessageEntry) => {
      if (isBroadcasting) return
      const previousBoard = displayMessage.padEnd(TOTAL_TILES, ' ')
      setLiveLabel(sanitizeCharacters(entry.text).replace(/\s+/g, ' ').trim())
      runChaoticTransition(previousBoard, entry.board, { scrambleAll: true })
    },
    [displayMessage, isBroadcasting, runChaoticTransition],
  )

  return (
    <main
      className="vestaboard-page vestaboard-home"
      data-builder-component="VestaboardHome"
      data-builder-id="vestaboard-home"
    >
      <div className="vestaboard-ambient vestaboard-ambient-glow" aria-hidden="true" />

      <header className="vestaboard-header vestaboard-topbar" data-builder-id="vestaboard-header">
        <div className="vestaboard-brand vestaboard-brand-lockup" data-builder-id="vestaboard-brand">
          <span className="vestaboard-brand-mark vestaboard-brand-orb" aria-hidden="true" />
          <div className="vestaboard-brand-copy">
            <p className="vestaboard-eyebrow vestaboard-brand-eyebrow">Split-flap studio</p>
            <h1 className="vestaboard-title vestaboard-brand-title">Vestaboard</h1>
          </div>
        </div>

        <div className="vestaboard-status vestaboard-live-status" data-builder-id="vestaboard-status">
          <span className={`vestaboard-status-dot ${isBroadcasting ? 'vestaboard-status-busy-dot' : 'vestaboard-status-live-dot'}`} aria-hidden="true" />
          <div className="vestaboard-status-copy">
            <p className="vestaboard-status-label">{isBroadcasting ? 'Scrambling' : 'Now showing'}</p>
            <p className="vestaboard-status-value" suppressHydrationWarning>
              {liveLabel}
            </p>
          </div>
        </div>
      </header>

      <section className="vestaboard-stage vestaboard-display-stage" data-builder-id="vestaboard-stage">
        <div className="vestaboard-wrapper vestaboard-display-wrapper" data-builder-id="vestaboard-wrapper">
          <div className={`vestaboard-chassis vestaboard-main-chassis ${isBroadcasting ? 'vestaboard-chassis-broadcasting' : ''}`} data-builder-id="vestaboard-chassis">
            <div className="vestaboard-chassis-rail vestaboard-chassis-rail-top" aria-hidden="true" />
            <div className="vestaboard-board vestaboard-main-board" data-builder-id="vestaboard-main-board">
              <div
                className={`vestaboard-grid vestaboard-tile-grid ${isBroadcasting ? 'vestaboard-grid-scrambling' : ''}`}
                data-builder-id="vestaboard-tile-grid"
                suppressHydrationWarning
                role="img"
                aria-label={`Vestaboard displaying ${liveLabel}`}
              >
                {displayChars.map((char, index) => (
                  <Tile
                    key={`${index}-${messageVersion}`}
                    char={char}
                    index={index}
                    isFlipping={flippingIndices.has(index)}
                    motion={motionMap.get(index)}
                  />
                ))}
              </div>
            </div>
            <div className="vestaboard-chassis-rail vestaboard-chassis-rail-bottom" aria-hidden="true">
              <span className="vestaboard-chassis-badge">22 × 6</span>
              <span className="vestaboard-chassis-badge">{filledTiles} tiles lit</span>
              <span className="vestaboard-chassis-badge">{isBroadcasting ? 'chaotic flip' : 'ready'}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="vestaboard-controls vestaboard-control-panel" data-builder-id="vestaboard-controls">
        <div className="vestaboard-presets vestaboard-preset-row" data-builder-id="vestaboard-presets">
          {PRESET_CHIPS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`vestaboard-chip vestaboard-preset-chip vestaboard-preset-${preset.id}`}
              data-builder-id={`vestaboard-preset-${preset.id}`}
              onClick={() => handlePreset(preset.text)}
              disabled={isBroadcasting}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <form
          className="vestaboard-composer vestaboard-message-composer"
          data-builder-id="vestaboard-composer"
          onSubmit={handleSubmit}
        >
          <label className="vestaboard-input-label" htmlFor="vestaboard-message-input">
            Board message
          </label>
          <div className="vestaboard-composer-row">
            <input
              id="vestaboard-message-input"
              className="vestaboard-input vestaboard-message-input"
              data-builder-id="vestaboard-message-input"
              type="text"
              placeholder="Type a message for the board"
              value={input}
              maxLength={TOTAL_TILES}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => setInput(event.target.value)}
            />
            <button
              className="vestaboard-button vestaboard-send-button"
              data-builder-id="vestaboard-send-button"
              type="submit"
              disabled={!input.trim() || isBroadcasting}
            >
              Send
            </button>
          </div>

          <div className="vestaboard-composer-meta" data-builder-id="vestaboard-composer-meta">
            <p className="vestaboard-preview vestaboard-message-preview" data-builder-id="vestaboard-message-preview">
              {input.trim()
                ? `Preview centers across the board · ${draftLength}/${TOTAL_TILES}`
                : 'Tiles scramble with random glyphs, then crash into the final word'}
            </p>
            <div className="vestaboard-actions vestaboard-secondary-actions" data-builder-id="vestaboard-secondary-actions">
              <button
                type="button"
                className="vestaboard-ghost-button vestaboard-shuffle-button"
                data-builder-id="vestaboard-shuffle-button"
                onClick={handleShuffle}
                disabled={isBroadcasting}
              >
                Shuffle
              </button>
              <button
                type="button"
                className="vestaboard-ghost-button vestaboard-clear-button"
                data-builder-id="vestaboard-clear-button"
                onClick={handleClear}
                disabled={isBroadcasting}
              >
                Clear
              </button>
            </div>
          </div>

          {input.trim() ? (
            <div className="vestaboard-mini-board vestaboard-composer-mini-board" data-builder-id="vestaboard-composer-mini-board" aria-hidden="true">
              {previewBoard.split('').map((char, index) => (
                <span
                  key={`preview-${index}`}
                  className={`vestaboard-mini-cell vestaboard-mini-cell-${index} ${char === ' ' ? 'vestaboard-mini-cell-empty' : 'vestaboard-mini-cell-filled'}`}
                >
                  {char === ' ' ? '' : char}
                </span>
              ))}
            </div>
          ) : null}
        </form>
      </section>

      <section className="vestaboard-history vestaboard-message-history" data-builder-id="vestaboard-message-history">
        <div className="vestaboard-history-header" data-builder-id="vestaboard-history-header">
          <h2 className="vestaboard-history-title" data-builder-id="vestaboard-history-title">
            Recent broadcasts
          </h2>
          <p className="vestaboard-history-subtitle">
            {messages.length > 0 ? `${messages.length} saved locally` : 'Send a message to start the log'}
          </p>
        </div>

        {messages.length > 0 ? (
          <ul className="vestaboard-history-list" data-builder-id="vestaboard-history-list">
            {messages.map((entry, index) => (
              <li
                key={entry.id}
                className={`vestaboard-history-item vestaboard-history-item-${index}`}
                data-builder-id={`vestaboard-history-item-${index}`}
              >
                <button
                  type="button"
                  className={`vestaboard-history-button vestaboard-history-button-${index}`}
                  data-builder-id={`vestaboard-history-button-${index}`}
                  onClick={() => handleReplay(entry)}
                  disabled={isBroadcasting}
                >
                  <span className={`vestaboard-history-text vestaboard-history-text-${index}`}>{entry.text}</span>
                  <time className={`vestaboard-history-time vestaboard-history-time-${index}`}>{entry.timestamp}</time>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="vestaboard-history-empty" data-builder-id="vestaboard-history-empty">
            <p className="vestaboard-history-empty-copy">
              Your next message lands here. Click any history item later to flip it back onto the board.
            </p>
          </div>
        )}
      </section>
    </main>
  )
}

'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

const BOARD_COLS = 22
const BOARD_ROWS = 6
const TOTAL_TILES = BOARD_COLS * BOARD_ROWS

const TILE_COLORS = [
  'vestaboard-tile-offwhite',
  'vestaboard-tile-yellow',
  'vestaboard-tile-orange',
  'vestaboard-tile-red',
  'vestaboard-tile-blue',
  'vestaboard-tile-green',
  'vestaboard-tile-purple',
]

const DEFAULT_MESSAGES = [
  'GOOD MORNING',
  'TAKE A BREAK',
  'GET BACK TO REAL WORK',
  'YOU GOT THIS',
  'HELLO WORLD',
]

function getTileColorClass(char: string, index: number): string {
  if (char === ' ') return 'vestaboard-tile-offwhite'
  const hash = (char.charCodeAt(0) * 31 + index * 7) % 19
  if (hash === 0) return 'vestaboard-tile-yellow'
  if (hash === 1) return 'vestaboard-tile-orange'
  if (hash === 2) return 'vestaboard-tile-red'
  if (hash === 3) return 'vestaboard-tile-blue'
  if (hash === 4) return 'vestaboard-tile-green'
  if (hash === 5) return 'vestaboard-tile-purple'
  return 'vestaboard-tile-offwhite'
}

function normalizeMessage(text: string): string {
  return text
    .toUpperCase()
    .replace(/[^A-Z0-9 .,!?@#$%^&*()\-_+=;:'"<>/\\[\]{}|~`]/g, '')
    .slice(0, TOTAL_TILES)
    .padEnd(TOTAL_TILES, ' ')
}

type MessageEntry = {
  text: string
  timestamp: string
}

function formatTime(date: Date): string {
  const h = date.getHours().toString().padStart(2, '0')
  const m = date.getMinutes().toString().padStart(2, '0')
  return `${h}:${m}`
}

function Tile({
  char,
  index,
  isFlipping,
}: {
  char: string
  index: number
  isFlipping: boolean
}) {
  const colorClass = getTileColorClass(char, index)
  const displayChar = char === ' ' ? '\u00A0' : char

  return (
    <div
      className={`vestaboard-tile vestaboard-tile-${index} ${colorClass} ${isFlipping ? 'vestaboard-tile-flipping' : ''}`}
    >
      <span className="vestaboard-tile-char">{displayChar}</span>
    </div>
  )
}

export default function Home() {
  const [input, setInput] = useState('')
  const [displayMessage, setDisplayMessage] = useState(() =>
    normalizeMessage(DEFAULT_MESSAGES[0]),
  )
  const [hydrated, setHydrated] = useState(false)
  const [flippingIndices, setFlippingIndices] = useState<Set<number>>(new Set())
  const [messages, setMessages] = useState<MessageEntry[]>([])
  const [messageVersion, setMessageVersion] = useState(0)

  useEffect(() => {
    setHydrated(true)
    const randomMessage =
      DEFAULT_MESSAGES[Math.floor(Math.random() * DEFAULT_MESSAGES.length)]
    setDisplayMessage(normalizeMessage(randomMessage))
  }, [])

  const displayChars = useMemo(() => {
    if (!displayMessage) return Array(TOTAL_TILES).fill(' ')
    const padded = displayMessage.padEnd(TOTAL_TILES, ' ')
    return padded.split('')
  }, [displayMessage])

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      const trimmed = input.trim()
      if (!trimmed) return

      const form = e.currentTarget as HTMLFormElement
      const newMessage = normalizeMessage(trimmed)
      const oldChars = displayMessage.padEnd(TOTAL_TILES, ' ').split('')

      // Find which tiles changed
      const changedIndices = new Set<number>()
      const newChars = newMessage.split('')
      for (let i = 0; i < TOTAL_TILES; i++) {
        if (oldChars[i] !== newChars[i]) {
          changedIndices.add(i)
        }
      }

      if (changedIndices.size > 0) {
        // Trigger flip animation
        setFlippingIndices(changedIndices)
        setDisplayMessage(newMessage)

        // Clear flipping after animation
        setTimeout(() => setFlippingIndices(new Set()), 700)
      }

      // Add to history
      const now = new Date()
      const historyText = trimmed.length > 50 ? trimmed.slice(0, 47) + '...' : trimmed
      setMessages((prev) => [
        { text: historyText, timestamp: formatTime(now) },
        ...prev.slice(0, 9),
      ])

      setInput('')
      setMessageVersion((v) => v + 1)

      // Reset form — capture before async
      form.reset()
    },
    [input, displayMessage],
  )

  return (
    <main
      className="vestaboard-page vestaboard-home"
      data-builder-component="VestaboardHome"
      data-builder-id="vestaboard-home"
    >
      <div
        className="vestaboard-wrapper vestaboard-display-wrapper"
        data-builder-id="vestaboard-wrapper"
      >
        <div
          className="vestaboard-board vestaboard-main-board"
          data-builder-id="vestaboard-main-board"
        >
          <div
            className="vestaboard-grid vestaboard-tile-grid"
            data-builder-id="vestaboard-tile-grid"
          >
            {displayChars.map((char, i) => (
              <Tile
                key={`${i}-${displayMessage}-${messageVersion}`}
                char={char}
                index={i}
                isFlipping={flippingIndices.has(i)}
              />
            ))}
          </div>
        </div>
      </div>

      <form
        className="vestaboard-composer"
        data-builder-id="vestaboard-composer"
        onSubmit={handleSubmit}
      >
        <div className="vestaboard-composer-row">
          <input
            className="vestaboard-input vestaboard-message-input"
            data-builder-id="vestaboard-message-input"
            type="text"
            placeholder="What should the board say?"
            value={input}
            maxLength={TOTAL_TILES}
            onChange={(e) => setInput(e.target.value)}
          />
          <button
            className="vestaboard-button vestaboard-send-button"
            data-builder-id="vestaboard-send-button"
            type="submit"
            disabled={!input.trim()}
          >
            Send message
          </button>
        </div>
        {input.trim() && (
          <p
            className="vestaboard-preview vestaboard-message-preview"
            data-builder-id="vestaboard-message-preview"
          >
            Preview: {input.toUpperCase().slice(0, TOTAL_TILES)}
            {input.length > TOTAL_TILES && '...'}
            {' '}({input.length}/{TOTAL_TILES})
          </p>
        )}
      </form>

      {messages.length > 0 && (
        <section
          className="vestaboard-history vestaboard-message-history"
          data-builder-id="vestaboard-message-history"
        >
          <h2
            className="vestaboard-history-title"
            data-builder-id="vestaboard-history-title"
          >
            Today&rsquo;s messages
          </h2>
          <ul
            className="vestaboard-history-list"
            data-builder-id="vestaboard-history-list"
          >
            {messages.map((msg, i) => (
              <li
                key={`${msg.timestamp}-${i}`}
                className={`vestaboard-history-item vestaboard-history-item-${i}`}
                data-builder-id={`vestaboard-history-item-${i}`}
              >
                <span
                  className={`vestaboard-history-text vestaboard-history-text-${i}`}
                >
                  {msg.text}
                </span>
                <time
                  className={`vestaboard-history-time vestaboard-history-time-${i}`}
                >
                  {msg.timestamp}
                </time>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  )
}
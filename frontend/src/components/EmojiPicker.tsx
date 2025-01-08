interface EmojiPickerProps {
  onSelect: (emoji: string) => void
}

const COMMON_EMOJIS = [
  '👍', '❤️', '😀', '😂', '🎉', '🔥',
  '👀', '✨', '👋', '🤔', '😍', '💯'
]

export function EmojiPicker({ onSelect }: EmojiPickerProps) {
  return (
    <div className="bg-white rounded-lg shadow-lg p-2 border">
      <div className="grid grid-cols-1 gap-1">
        {COMMON_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            onClick={() => onSelect(emoji)}
            className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded transition-colors text-base"
            title={`Add ${emoji} reaction`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  )
} 
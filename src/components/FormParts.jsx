import { Button, XStack } from 'tamagui'
import { CATEGORIES } from '../format.js'

/** Expense / income switch. */
export function TypeToggle({ type, onChange }) {
  return (
    <XStack gap="$2">
      <Button
        flex={1}
        theme={type === 'expense' ? 'red' : undefined}
        variant={type === 'expense' ? undefined : 'outlined'}
        onPress={() => onChange('expense')}
      >
        הוצאה
      </Button>
      <Button
        flex={1}
        theme={type === 'income' ? 'green' : undefined}
        variant={type === 'income' ? undefined : 'outlined'}
        onPress={() => onChange('income')}
      >
        הכנסה
      </Button>
    </XStack>
  )
}

/** One button per category of the given type. */
export function CategoryPicker({ type, category, onChange }) {
  return (
    <XStack gap="$2" flexWrap="wrap">
      {CATEGORIES[type].map((c) => (
        <Button
          key={c}
          size="sm"
          theme={c === category ? 'accent' : undefined}
          variant={c === category ? undefined : 'outlined'}
          onPress={() => onChange(c)}
        >
          {c}
        </Button>
      ))}
    </XStack>
  )
}

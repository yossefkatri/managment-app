import { useState } from 'react'
import { Button, Card, Input, Paragraph, SizableText, XStack } from 'tamagui'
import { CATEGORIES, amountText, monthOf, today } from '../format.js'
import { CategoryPicker, TypeToggle } from './FormParts.jsx'

/**
 * New transaction form. With "repeats every month" on, it creates a cyclic rule instead
 * (`onAddCyclic`): the date's day becomes the day of the month, and its month the first month.
 */
export default function TransactionForm({ onAdd, onAddCyclic }) {
  const [type, setType] = useState('expense')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState(CATEGORIES.expense[0])
  const [date, setDate] = useState(today())
  const [repeat, setRepeat] = useState(false)

  const value = Number(amount)
  const valid = value > 0 && date
  const day = date ? Number(date.slice(8, 10)) : null

  const switchType = (next) => {
    setType(next)
    setCategory(CATEGORIES[next][0])
  }

  const submit = () => {
    if (!valid) return
    const common = { id: crypto.randomUUID(), type, amount: value, description: description.trim(), category }
    if (repeat) {
      onAddCyclic({ ...common, dayOfMonth: day, startMonth: monthOf(date), endMonth: null })
    } else {
      onAdd({ ...common, date })
    }
    setAmount('')
    setDescription('')
  }

  return (
    <Card padding="$4" gap="$3" borderWidth={1} borderColor="$border-color">
      <SizableText size="$5" fontWeight="700">
        תנועה חדשה
      </SizableText>

      <TypeToggle type={type} onChange={switchType} />

      <XStack gap="$2" flexWrap="wrap">
        <Input
          flex={1}
          minWidth={120}
          placeholder="סכום ₪"
          inputMode="decimal"
          value={amount}
          onChangeText={(text) => setAmount(amountText(text))}
        />
        <Input flex={1} minWidth={140} type="date" value={date} onChangeText={setDate} />
      </XStack>

      <Input
        placeholder="תיאור (לא חובה)"
        value={description}
        onChangeText={setDescription}
        onSubmitEditing={submit}
      />

      <CategoryPicker type={type} category={category} onChange={setCategory} />

      <XStack gap="$3" alignItems="center" flexWrap="wrap">
        <Button
          size="sm"
          theme={repeat ? 'accent' : undefined}
          variant={repeat ? undefined : 'outlined'}
          aria-pressed={repeat}
          onPress={() => setRepeat(!repeat)}
        >
          {repeat ? '✓ חוזר כל חודש' : '🔁 חוזר כל חודש'}
        </Button>
        {repeat && day ? (
          <Paragraph size="$2" color="$color-10">
            {`יתווסף אוטומטית בכל ${day} לחודש, החל מהחודש של התאריך שנבחר`}
          </Paragraph>
        ) : null}
      </XStack>

      <Button theme="accent" disabled={!valid} opacity={valid ? 1 : 0.5} onPress={submit}>
        {repeat ? 'הוסף תנועה קבועה' : 'הוסף'}
      </Button>
    </Card>
  )
}

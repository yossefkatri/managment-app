import { useState } from 'react'
import { Button, Card, Input, SizableText, XStack } from 'tamagui'
import { CATEGORIES, today } from '../format.js'

export default function TransactionForm({ onAdd }) {
  const [type, setType] = useState('expense')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState(CATEGORIES.expense[0])
  const [date, setDate] = useState(today())

  const value = Number(amount)
  const valid = value > 0 && date

  const switchType = (next) => {
    setType(next)
    setCategory(CATEGORIES[next][0])
  }

  const submit = () => {
    if (!valid) return
    onAdd({
      id: crypto.randomUUID(),
      type,
      amount: value,
      description: description.trim(),
      category,
      date,
    })
    setAmount('')
    setDescription('')
  }

  return (
    <Card padding="$4" gap="$3" borderWidth={1} borderColor="$border-color">
      <SizableText size="$5" fontWeight="700">
        תנועה חדשה
      </SizableText>

      <XStack gap="$2">
        <Button
          flex={1}
          theme={type === 'expense' ? 'red' : undefined}
          variant={type === 'expense' ? undefined : 'outlined'}
          onPress={() => switchType('expense')}
        >
          הוצאה
        </Button>
        <Button
          flex={1}
          theme={type === 'income' ? 'green' : undefined}
          variant={type === 'income' ? undefined : 'outlined'}
          onPress={() => switchType('income')}
        >
          הכנסה
        </Button>
      </XStack>

      <XStack gap="$2" flexWrap="wrap">
        <Input
          flex={1}
          minWidth={120}
          placeholder="סכום ₪"
          inputMode="decimal"
          value={amount}
          onChangeText={(text) => setAmount(text.replace(/[^\d.]/g, ''))}
        />
        <Input flex={1} minWidth={140} type="date" value={date} onChangeText={setDate} />
      </XStack>

      <Input
        placeholder="תיאור (לא חובה)"
        value={description}
        onChangeText={setDescription}
        onSubmitEditing={submit}
      />

      <XStack gap="$2" flexWrap="wrap">
        {CATEGORIES[type].map((c) => (
          <Button
            key={c}
            size="sm"
            theme={c === category ? 'accent' : undefined}
            variant={c === category ? undefined : 'outlined'}
            onPress={() => setCategory(c)}
          >
            {c}
          </Button>
        ))}
      </XStack>

      <Button theme="accent" disabled={!valid} opacity={valid ? 1 : 0.5} onPress={submit}>
        הוסף
      </Button>
    </Card>
  )
}

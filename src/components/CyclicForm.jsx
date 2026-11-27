import { useState } from 'react'
import { Button, Card, Input, Paragraph, SizableText, XStack, YStack } from 'tamagui'
import { CATEGORIES, amountText, monthOf, today } from '../format.js'
import { CategoryPicker, TypeToggle } from './FormParts.jsx'

/**
 * Add or edit a cyclic rule. With `initial` it edits that rule (keeping its id and end month),
 * otherwise it creates a new one starting this month.
 */
export default function CyclicForm({ initial, onSubmit, onCancel }) {
  const editing = Boolean(initial)
  const [type, setType] = useState(initial?.type ?? 'expense')
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [category, setCategory] = useState(initial?.category ?? CATEGORIES.expense[0])
  const [day, setDay] = useState(initial ? String(initial.dayOfMonth) : String(Number(today().slice(8, 10))))
  const [startMonth, setStartMonth] = useState(initial?.startMonth ?? monthOf(today()))

  const value = Number(amount)
  const dayValue = Number(day)
  const dayValid = Number.isInteger(dayValue) && dayValue >= 1 && dayValue <= 31
  const valid = value > 0 && dayValid && Boolean(startMonth)

  const switchType = (next) => {
    setType(next)
    setCategory(CATEGORIES[next][0])
  }

  const submit = () => {
    if (!valid) return
    onSubmit({
      id: initial?.id ?? crypto.randomUUID(),
      type,
      amount: value,
      description: description.trim(),
      category,
      dayOfMonth: dayValue,
      startMonth,
      endMonth: initial?.endMonth ?? null,
    })
    if (!editing) {
      setAmount('')
      setDescription('')
    }
  }

  return (
    <Card padding="$4" gap="$3" borderWidth={1} borderColor="$border-color">
      <SizableText size="$5" fontWeight="700">
        {editing ? 'עריכת תנועה קבועה' : 'תנועה קבועה חדשה'}
      </SizableText>

      <TypeToggle type={type} onChange={switchType} />

      <XStack gap="$2" flexWrap="wrap">
        <YStack flex={1} minWidth={120} gap="$1">
          <SizableText size="$2" color="$color-10">
            סכום חודשי
          </SizableText>
          <Input
            placeholder="סכום ₪"
            inputMode="decimal"
            value={amount}
            onChangeText={(text) => setAmount(amountText(text))}
          />
        </YStack>
        <YStack width={110} gap="$1">
          <SizableText size="$2" color="$color-10">
            יום בחודש
          </SizableText>
          <Input
            inputMode="numeric"
            value={day}
            onChangeText={(text) => setDay(text.replace(/\D/g, '').slice(0, 2))}
            aria-invalid={!dayValid}
          />
        </YStack>
        <YStack flex={1} minWidth={150} gap="$1">
          <SizableText size="$2" color="$color-10">
            החל מחודש
          </SizableText>
          <Input type="month" value={startMonth} onChangeText={setStartMonth} />
        </YStack>
      </XStack>
      {!dayValid && day !== '' ? (
        <Paragraph size="$2" theme="red" color="$color-10">
          יום בחודש צריך להיות בין 1 ל-31.
        </Paragraph>
      ) : dayValue > 28 ? (
        <Paragraph size="$2" color="$color-10">
          בחודשים קצרים יותר התנועה תירשם ביום האחרון של החודש.
        </Paragraph>
      ) : null}

      <Input placeholder="תיאור (לא חובה)" value={description} onChangeText={setDescription} onSubmitEditing={submit} />

      <CategoryPicker type={type} category={category} onChange={setCategory} />

      <XStack gap="$2">
        <Button flex={1} theme="accent" disabled={!valid} opacity={valid ? 1 : 0.5} onPress={submit}>
          {editing ? 'שמור' : 'הוסף תנועה קבועה'}
        </Button>
        {editing && (
          <Button variant="outlined" onPress={onCancel}>
            ביטול
          </Button>
        )}
      </XStack>
    </Card>
  )
}

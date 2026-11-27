import { Button, SizableText, XStack, YStack } from 'tamagui'
import { money } from '../format.js'

export default function TransactionRow({ tx, onDelete }) {
  const isIncome = tx.type === 'income'
  return (
    <XStack alignItems="center" gap="$3" paddingVertical="$2">
      <YStack flex={1}>
        <SizableText fontWeight="600">{tx.description || tx.category}</SizableText>
        <SizableText size="$2" color="$color-10">
          {tx.category} · {new Date(tx.date).toLocaleDateString('he-IL')}
        </SizableText>
      </YStack>
      <SizableText theme={isIncome ? 'green' : 'red'} color="$color-10" fontWeight="700">
        {isIncome ? '+' : '−'}
        {money.format(tx.amount)}
      </SizableText>
      <Button size="sm" variant="outlined" onPress={() => onDelete(tx.id)} aria-label="מחק">
        ✕
      </Button>
    </XStack>
  )
}

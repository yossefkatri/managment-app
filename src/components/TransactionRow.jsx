import { Button, SizableText, XStack, YStack } from 'tamagui'
import { money, today } from '../format.js'

/**
 * One transaction in the month's list. An occurrence generated from a cyclic rule (`tx.cyclicId`)
 * can't be deleted on its own; its button opens the cyclic management page (`onManageCyclic`) instead.
 */
export default function TransactionRow({ tx, onDelete, onManageCyclic }) {
  const isIncome = tx.type === 'income'
  const isCyclic = Boolean(tx.cyclicId)
  const upcoming = isCyclic && tx.date > today()
  return (
    <XStack alignItems="center" gap="$3" paddingVertical="$2" opacity={upcoming ? 0.7 : 1}>
      <YStack flex={1}>
        <XStack gap="$2" alignItems="center" flexWrap="wrap">
          <SizableText fontWeight="600">{tx.description || tx.category}</SizableText>
          {isCyclic && (
            <SizableText
              size="$1"
              theme="accent"
              color="$color-10"
              backgroundColor="$background"
              paddingHorizontal="$2"
              borderRadius="$10"
            >
              {upcoming ? '🔁 קבוע · צפוי' : '🔁 קבוע'}
            </SizableText>
          )}
        </XStack>
        <SizableText size="$2" color="$color-10">
          {tx.category} · {new Date(tx.date).toLocaleDateString('he-IL')}
        </SizableText>
      </YStack>
      <SizableText theme={isIncome ? 'green' : 'red'} color="$color-10" fontWeight="700">
        {isIncome ? '+' : '−'}
        {money.format(tx.amount)}
      </SizableText>
      {isCyclic ? (
        <Button size="sm" variant="outlined" onPress={onManageCyclic} aria-label="נהל תנועה קבועה">
          ⚙
        </Button>
      ) : (
        <Button size="sm" variant="outlined" onPress={() => onDelete(tx.id)} aria-label="מחק">
          ✕
        </Button>
      )}
    </XStack>
  )
}

import { Card, SizableText } from 'tamagui'
import { money } from '../format.js'

export default function SummaryCard({ title, amount, theme }) {
  return (
    <Card theme={theme} flex={1} minWidth={150} padding="$4" borderWidth={1} borderColor="$border-color">
      <SizableText size="$3" color="$color-10">
        {title}
      </SizableText>
      <SizableText size="$7" fontWeight="700">
        {money.format(amount)}
      </SizableText>
    </Card>
  )
}

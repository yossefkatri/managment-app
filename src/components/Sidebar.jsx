import { Button, Circle, H1, Paragraph, Separator, SizableText, XStack, YStack } from 'tamagui'
import { initialOf } from '../format.js'
import { PAGES } from '../pages.js'
import { SYNC_LABELS, isSyncWarning } from '../syncLabels.js'

/**
 * Navigation between the pages, plus the account and sync status at the bottom.
 * On wide screens it's a fixed column; on phones App shows it as a drawer (`onNavigate` then also closes it).
 */
export default function Sidebar({ page, onNavigate, sync }) {
  const warn = isSyncWarning(sync.status)
  return (
    <YStack
      tag="nav"
      aria-label="ניווט ראשי"
      width={260}
      height="100%"
      padding="$4"
      gap="$4"
      backgroundColor="$background"
      borderLeftWidth={1}
      borderColor="$border-color"
    >
      <YStack>
        <H1 size="$8">הכסף שלי</H1>
        <Paragraph size="$2" color="$color-10">
          מעקב הכנסות והוצאות
        </Paragraph>
      </YStack>

      <YStack gap="$2">
        {PAGES.map((p) => {
          const active = p.id === page
          return (
            <Button
              key={p.id}
              justifyContent="flex-start"
              theme={active ? 'accent' : undefined}
              // Inactive items are flat; passing backgroundColor={undefined} would drop the accent color
              {...(active ? {} : { backgroundColor: 'transparent' })}
              aria-current={active ? 'page' : undefined}
              onPress={() => onNavigate(p.id)}
            >
              {`${p.icon}  ${p.label}`}
            </Button>
          )
        })}
      </YStack>

      <YStack flex={1} />

      <Separator />
      <YStack gap="$2">
        <XStack gap="$3" alignItems="center">
          <Circle size={36} theme="accent" backgroundColor="$background">
            <SizableText fontWeight="700">{initialOf(sync.user)}</SizableText>
          </Circle>
          <YStack flex={1} minWidth={0}>
            <SizableText size="$3" fontWeight="600" numberOfLines={1}>
              {sync.user?.displayName || 'משתמש'}
            </SizableText>
            <SizableText size="$1" color="$color-10" numberOfLines={1}>
              {sync.user?.emailAddress}
            </SizableText>
          </YStack>
        </XStack>
        <SizableText size="$1" theme={warn ? 'red' : undefined} color="$color-10">
          {SYNC_LABELS[sync.status]}
        </SizableText>
        {sync.status === 'needs-login' && (
          <Button size="sm" theme="accent" onPress={sync.signIn}>
            התחבר מחדש
          </Button>
        )}
      </YStack>
    </YStack>
  )
}

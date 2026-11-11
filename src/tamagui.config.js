import { defaultConfig } from '@tamagui/config/v6'
import { animations } from '@tamagui/config/animations-css'
import { createTamagui } from 'tamagui'

export const config = createTamagui({ ...defaultConfig, animations })

export default config

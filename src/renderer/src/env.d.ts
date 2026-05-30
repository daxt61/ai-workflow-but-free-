/// <reference types="vite/client" />

import type { SlowBurnAPI } from '@shared/types'

declare global {
  interface Window {
    slowburn: SlowBurnAPI
  }
}

import { NitroModules } from 'react-native-nitro-modules'
import type { HybridFileSystem } from './specs/HybridFileSystem.nitro'

export const NitroFileSystem = NitroModules.createHybridObject<HybridFileSystem>('NitroNodeFileSystem')

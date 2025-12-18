import { HybridObject } from 'react-native-nitro-modules'

export interface HybridFileWatcher extends HybridObject<{ ios: 'c++', android: 'c++' }> {
    close(): void;
}

import { HybridObject } from 'react-native-nitro-modules'

export interface HybridDirIterator extends HybridObject<{ ios: 'c++', android: 'c++' }> {
    next(): string | undefined;
    close(): void;
}

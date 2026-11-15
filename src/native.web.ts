import type { HybridFileSystem } from './specs/HybridFileSystem.nitro';

let warned = false;

export function warnWebOnce(): void {
    if (!warned && (globalThis as { __DEV__?: unknown }).__DEV__ === true) {
        warned = true;
        console.warn('[NitroFS] File system operations are not supported on web platform.');
    }
}

export function webNotSupportedError(): Error {
    return new Error('[NitroFS] Not supported on web platform');
}

export function nodeFsError(syscall: string, path: string): Error {
    const err = new Error(`${syscall} failed on web: '${path}'`) as Error & {
        syscall?: string;
        path?: string;
    };
    err.syscall = syscall;
    err.path = path;
    return err;
}

const STRING_GETTERS = new Set<string>([
    'bundleUri',
    'cachesDirectoryPath',
    'documentDirectoryPath',
    'downloadDirectoryPath',
    'externalCachesDirectoryPath',
    'externalDirectoryPath',
    'externalStorageDirectoryPath',
    'libraryDirectoryPath',
    'mainBundlePath',
    'picturesDirectoryPath',
    'temporaryDirectoryPath',
    'lastErrorCode',
]);

const methodCache = new Map<string, Function>();

export const NitroFileSystem = new Proxy({} as HybridFileSystem, {
    get(_target, prop) {
        if (typeof prop !== 'string') return undefined;
        if (STRING_GETTERS.has(prop)) return '';
        if (prop === 'lastErrno') return 0;
        if (prop === 'openFlagValues') return [];
        if (prop === 'fileProtectionKeys') return {};

        let fn = methodCache.get(prop);
        if (!fn) {
            fn = function () {
                warnWebOnce();
                throw webNotSupportedError();
            };
            methodCache.set(prop, fn);
        }
        return fn;
    },
});

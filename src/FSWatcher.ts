import { EventEmitter } from 'events';
import { NitroFileSystem } from './native';
import type { HybridFileWatcher } from './specs/HybridFileWatcher.nitro';

export type WatchEventType = 'rename' | 'change';
export type WatchListener = (eventType: WatchEventType, filename: string | Buffer) => void;

/**
 * Node.js compatible FSWatcher class.
 * Watches for changes on a file or directory.
 */
export class FSWatcher extends EventEmitter {
    private _watcher: HybridFileWatcher | null = null;
    private _closed = false;

    constructor(filename: string, options?: { persistent?: boolean; recursive?: boolean; encoding?: BufferEncoding }) {
        super();

        // Start watching
        try {
            this._watcher = NitroFileSystem.watch(filename, (eventType, path) => {
                const event = eventType as WatchEventType;
                this.emit('change', event, path);
            });
        } catch (e) {
            // Emit error asynchronously
            setImmediate(() => this.emit('error', e));
        }
    }

    /**
     * Stop watching for changes.
     */
    close(): this {
        if (this._watcher && !this._closed) {
            this._watcher.close();
            this._watcher = null;
            this._closed = true;
            this.emit('close');
        }
        return this;
    }

    /**
     * Reference the watcher so the event loop stays active.
     */
    ref(): this {
        // No-op in React Native context
        return this;
    }

    /**
     * Unreference the watcher so it doesn't keep the event loop active.
     */
    unref(): this {
        // No-op in React Native context
        return this;
    }
}

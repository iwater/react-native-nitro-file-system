import { Writable, WritableOptions } from 'readable-stream';
import { NitroFileSystem } from './native';
import { Buffer } from 'react-native-nitro-buffer';

export interface WriteStreamOptions extends WritableOptions {
    flags?: string;
    encoding?: BufferEncoding;
    fd?: number | null;
    mode?: number;
    autoClose?: boolean;
    emitClose?: boolean;
    start?: number;
}

export class WriteStream extends Writable {
    path: string | Buffer;
    fd: number | null;
    flags: string = 'w';
    mode: number = 0o666;
    start: number | undefined;
    pos: number;
    bytesWritten: number = 0;
    autoClose: boolean;
    _fileClosed: boolean = false;
    pending: boolean = false;

    constructor(path: string | Buffer, options?: WriteStreamOptions) {
        // @ts-ignore
        super(options);

        this.path = path;
        this.fd = options?.fd === undefined ? null : options.fd;
        this.flags = options?.flags === undefined ? 'w' : options.flags;
        this.mode = options?.mode === undefined ? 0o666 : options.mode;
        this.start = options?.start;
        this.pos = this.start ?? 0; // If start is undefined, pos is 0? Or append? 
        // Node.js docs: "start" option is to allow writing data at some position past the beginning of the file.
        // If not modifying the file, use 'a' flags.

        this.autoClose = options?.autoClose === undefined ? true : options.autoClose;

        if (this.fd === null) {
            this.pending = true;
            this._open();
        } else {
            this.pending = false;
        }

        this.on('finish', () => {
            if (this.autoClose) {
                this.close();
            }
        });
    }

    _open() {
        // TODO: Import getFlags from a shared util to avoid duplication
        // For now, simple mapping
        let flagNum = 1 | 64 | 512; // O_WRONLY | O_CREAT | O_TRUNC (w)
        if (this.flags === 'w') flagNum = 1 | 64 | 512;
        else if (this.flags === 'a') flagNum = 1 | 64 | 1024; // O_WRONLY | O_CREAT | O_APPEND
        // ... extend as needed

        try {
            if (typeof this.path !== 'string') throw new Error("Path must be string");

            setImmediate(() => {
                try {
                    const fd = NitroFileSystem.open(this.path as string, flagNum, this.mode);
                    if (fd < 0) {
                        this.emit('error', new Error(`ENOENT: no such file or directory, open '${this.path}'`));
                        this._fileClosed = true;
                        return;
                    }
                    this.fd = fd;
                    this.pending = false;
                    this.emit('open', fd);
                    this.emit('ready');
                } catch (e) {
                    this.emit('error', e);
                    this._fileClosed = true;
                }
            });
        } catch (e) {
            this.emit('error', e);
            this._fileClosed = true;
        }
    }

    _write(chunk: any, encoding: string, callback: (error?: Error | null) => void) {
        if (this.pending) {
            this.once('ready', () => this._write(chunk, encoding, callback));
            return;
        }

        if (this._fileClosed || this.fd === null) {
            callback(new Error('Write after close'));
            return;
        }

        const buffer = (Buffer.isBuffer(chunk)) ? chunk : Buffer.from(chunk, encoding as BufferEncoding);

        try {
            // Sync write via native bridge
            // Note: position argument in native write. 
            // If this.start is set, we track this.pos.
            // If this.flags is 'a', we might ignore pos? 
            // Node fs.write behaviour: if pos is integer, write at pos. if null, write at current pos.

            // If user passed start, we use it. If not, start is undefined.
            // If flags is 'a', we usually append. Native open with O_APPEND handles it?
            // Nitro write wrapper: write(fd, buffer, offset, length, pos)
            // If pos is -1, it uses current file offset.

            let posToWrite = (this.start !== undefined) ? this.pos : -1;

            const bytesWritten = NitroFileSystem.write(this.fd, buffer.buffer as ArrayBuffer, buffer.byteOffset, buffer.length, posToWrite);

            if (bytesWritten >= 0) {
                this.bytesWritten += bytesWritten;
                if (this.start !== undefined) {
                    this.pos += bytesWritten;
                }
                callback(null);
            } else {
                callback(new Error("Write failed"));
            }
        } catch (e: any) {
            callback(e);
        }
    }

    close(cb?: (err?: NodeJS.ErrnoException | null) => void) {
        if (this._fileClosed) {
            if (cb) cb();
            return;
        }

        if (this.fd !== null) {
            try {
                NitroFileSystem.close(this.fd);
                this.fd = null;
            } catch (e: any) {
                if (cb) cb(e);
                else this.emit('error', e);
                return;
            }
        }

        this._fileClosed = true;
        this.emit('close');
        if (cb) cb();
    }
}

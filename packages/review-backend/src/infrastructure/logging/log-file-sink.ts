/**
 * 模块职责：把结构化日志以 JSONL 写入独立目录，并控制文件大小与保留期限。
 * 边界约束：只处理自身前缀的日志文件，不触碰 session 数据或其他应用文件。
 */
import { existsSync, mkdirSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { Writable } from "node:stream";
import { join } from "node:path";

type LogFileSinkOptions = {
  directory: string;
  baseName?: string;
  maxBytes?: number;
  retentionDays?: number;
  now?: () => Date;
};

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;
const DEFAULT_RETENTION_DAYS = 7;

export class LogFileSink extends Writable {
  private readonly directory: string;
  private readonly baseName: string;
  private readonly maxBytes: number;
  private readonly retentionDays: number;
  private readonly now: () => Date;
  private currentPath = "";
  private currentBytes = 0;

  constructor(options: LogFileSinkOptions) {
    super();
    this.directory = options.directory;
    this.baseName = options.baseName ?? "review-backend";
    this.maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
    this.retentionDays = options.retentionDays ?? DEFAULT_RETENTION_DAYS;
    this.now = options.now ?? (() => new Date());

    mkdirSync(this.directory, { recursive: true });
    this.removeExpiredFiles();
    this.selectCurrentFile();
  }

  override _write(chunk: Buffer | string, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    try {
      const line = chunk.toString().endsWith("\n") ? chunk.toString() : `${chunk.toString()}\n`;
      this.selectCurrentFile();
      if (this.currentBytes > 0 && this.currentBytes + Buffer.byteLength(line) > this.maxBytes) {
        this.rotateCurrentFile();
        this.selectCurrentFile();
      }
      writeFileSync(this.currentPath, line, { flag: "a" });
      this.currentBytes += Buffer.byteLength(line);
      callback();
    } catch (error) {
      callback(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private selectCurrentFile(): void {
    const date = this.formatDate(this.now());
    const currentPath = join(this.directory, `${this.baseName}-${date}.jsonl`);
    this.currentPath = currentPath;
    this.currentBytes = existsSync(currentPath) ? statSync(currentPath).size : 0;
  }

  private rotateCurrentFile(): void {
    const date = this.formatDate(this.now());
    for (let index = 9; index >= 1; index -= 1) {
      const source = join(this.directory, `${this.baseName}-${date}.${index}.jsonl`);
      const target = join(this.directory, `${this.baseName}-${date}.${index + 1}.jsonl`);
      if (existsSync(source)) renameSync(source, target);
    }
    if (existsSync(this.currentPath)) {
      renameSync(this.currentPath, join(this.directory, `${this.baseName}-${date}.1.jsonl`));
    }
    this.currentBytes = 0;
  }

  private removeExpiredFiles(): void {
    const threshold = this.now().getTime() - this.retentionDays * 24 * 60 * 60 * 1000;
    const prefix = `${this.baseName}-`;
    for (const file of readdirSync(this.directory)) {
      if (!file.startsWith(prefix) || !file.endsWith(".jsonl")) continue;
      const path = join(this.directory, file);
      if (statSync(path).mtimeMs < threshold) unlinkSync(path);
    }
  }

  private formatDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }
}

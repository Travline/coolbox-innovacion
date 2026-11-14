export class AppError extends Error {
  constructor(public readonly code: 'CONFIG' | 'INPUT' | 'DATABASE' | 'EMBEDDING' | 'MODEL', message: string) {
    super(message);
    this.name = 'AppError';
  }
}

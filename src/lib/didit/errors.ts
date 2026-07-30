export class DiditValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DiditValidationError";
  }
}

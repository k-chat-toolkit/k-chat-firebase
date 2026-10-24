import {
  Validators,
  type AbstractControl,
  type ValidationErrors,
  type ValidatorFn,
} from '@angular/forms';

/** Fails on an empty or whitespace-only value. */
export const notBlank: ValidatorFn = (control: AbstractControl): ValidationErrors | null =>
  typeof control.value === 'string' && control.value.trim().length === 0 ? { blank: true } : null;

/** A name the rules accept once trimmed: not blank, at most `max` characters. */
export function nameValidators(max: number): ValidatorFn[] {
  return [Validators.required, notBlank, Validators.maxLength(max)];
}

/** Characters left before `max`; negative when over. */
export function remaining(value: string, max: number): number {
  return max - value.length;
}

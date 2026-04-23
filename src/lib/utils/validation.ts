// Quality Improvement 10: Data Validation and Sanitization

export function sanitizeInput(input: string): string {
  return input.trim().replace(/[<>]/g, '')
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function validatePhoneNumber(phone: string): boolean {
  // Saudi phone number format: starts with 05 and 10 digits total
  const phoneRegex = /^05\d{8}$/
  return phoneRegex.test(phone.replace(/\s/g, ''))
}

export function validateSaudiPlateLetters(letters: string): boolean {
  const allowedLetters = ['A', 'B', 'D', 'E', 'G', 'H', 'J', 'K', 'L', 'N', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'X', 'Y', 'Z']
  return letters.split('').every(letter => allowedLetters.includes(letter.toUpperCase()))
}

export function validateVIN(vin: string): boolean {
  // VIN must be exactly 17 characters, alphanumeric, no I, O, or Q
  const vinRegex = /^[A-HJ-NPR-Z0-9]{17}$/
  return vinRegex.test(vin.toUpperCase())
}

export function sanitizeNumber(value: string): number {
  const num = parseInt(value.replace(/[^0-9]/g, ''))
  return isNaN(num) ? 0 : num
}

export function validateYear(year: number): boolean {
  const currentYear = new Date().getFullYear()
  return year >= 1900 && year <= currentYear + 1
}

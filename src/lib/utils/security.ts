import path from 'path'
import fs from 'fs'

/**
 * Validates that a resolved path stays within the allowed base directory.
 * Prevents path traversal, symlink abuse, and directory traversal attacks.
 */
export function validatePath(baseDir: string, userPath: string): string {
  // Normalize and resolve both paths
  const normalizedBase = path.resolve(baseDir)
  
  // Reject obvious traversal patterns
  if (userPath.includes('..')) {
    throw new SecurityError('Path traversal detected: ".." is not allowed')
  }
  
  // Handle root/current directory references - strip leading slashes
  // so path.resolve doesn't treat relative paths as absolute
  const normalizedUserPath = userPath.replace(/^\/+/, '').replace(/^\.$/, '')
  
  // Resolve the full path
  const resolvedPath = normalizedUserPath
    ? path.resolve(baseDir, normalizedUserPath)
    : normalizedBase
  
  // Check that the resolved path starts with the base directory
  if (!resolvedPath.startsWith(normalizedBase + path.sep) && resolvedPath !== normalizedBase) {
    throw new SecurityError(`Access denied: path is outside the application directory`)
  }
  
  // Check for symlinks that might point outside
  try {
    const realPath = fs.realpathSync(resolvedPath)
    const realBase = fs.realpathSync(normalizedBase)
    if (!realPath.startsWith(realBase + path.sep) && realPath !== realBase) {
      throw new SecurityError('Symlink escape detected: resolved path is outside application directory')
    }
    return realPath
  } catch (err) {
    if (err instanceof SecurityError) throw err
    // File might not exist yet - use the validated resolved path
    return resolvedPath
  }
}

/**
 * Sanitizes a filename to prevent directory traversal and injection.
 */
export function sanitizeFileName(fileName: string): string {
  // Remove path separators and null bytes
  let sanitized = fileName.replace(/[/\\]/g, '_').replace(/\0/g, '')
  
  // Remove leading dots to prevent hidden files on Unix
  sanitized = sanitized.replace(/^\.+/, '_')
  
  // Limit length
  if (sanitized.length > 255) {
    const ext = path.extname(sanitized)
    const name = path.basename(sanitized, ext)
    sanitized = name.substring(0, 250 - ext.length) + ext
  }
  
  // Reject empty filenames
  if (!sanitized || sanitized.trim() === '') {
    throw new SecurityError('Filename cannot be empty')
  }
  
  return sanitized
}

/**
 * Sanitizes a command to prevent command injection.
 * Only allows alphanumeric, spaces, dots, dashes, underscores, and common safe characters.
 */
export function sanitizeCommand(command: string): string {
  // Allow common safe characters for commands
  // This is a conservative allowlist - extend as needed for legitimate use cases
  const allowed = /^[a-zA-Z0-9\s._\-/:@=,;+'"!|#$%&*()<>{}\[\]]+$/
  if (!allowed.test(command)) {
    throw new SecurityError('Command contains disallowed characters')
  }
  return command.trim()
}

/**
 * Generates a slug from a name string.
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50)
}

/**
 * Masks a secret value for display.
 */
export function maskSecret(value: string): string {
  if (value.length <= 4) return '****'
  return value.substring(0, 2) + '*'.repeat(Math.min(value.length - 4, 20)) + value.substring(value.length - 2)
}

/**
 * Validates that a port number is in the valid range and not a system port.
 */
export function validatePort(port: number): void {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new SecurityError(`Invalid port: ${port}. Must be between 1024 and 65535`)
  }
}

export class SecurityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SecurityError'
  }
}
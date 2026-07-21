import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import { validatePath, sanitizeFileName, SecurityError } from './security'
import { MAX_FILE_SIZE } from '../constants'
import type { FileEntry } from '../types'

/**
 * List files and directories within an application's storage path.
 * All paths are validated against the application's base directory.
 */
export async function listFiles(baseDir: string, relativePath: string = '.'): Promise<FileEntry[]> {
  const safePath = validatePath(baseDir, relativePath)
  
  let entries: fs.Dirent[]
  try {
    entries = await fs.readdir(safePath, { withFileTypes: true })
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Directory not found: ${relativePath}`)
    }
    if ((err as NodeJS.ErrnoException).code === 'EACCES') {
      throw new Error(`Permission denied: ${relativePath}`)
    }
    throw err
  }
  
  const results: FileEntry[] = []
  for (const entry of entries) {
    // Skip hidden files and directories
    if (entry.name.startsWith('.') && entry.name !== '.env') continue
    
    const fullPath = path.join(safePath, entry.name)
    try {
      const stat = await fs.stat(fullPath)
      results.push({
        name: entry.name,
        path: path.join(relativePath, entry.name),
        isDirectory: entry.isDirectory(),
        size: entry.isDirectory() ? 0 : stat.size,
        modifiedAt: stat.mtime.toISOString(),
        extension: entry.isDirectory() ? undefined : path.extname(entry.name),
      })
    } catch {
      // Skip entries we can't stat
    }
  }
  
  // Sort: directories first, then alphabetically
  results.sort((a, b) => {
    if (a.isDirectory && !b.isDirectory) return -1
    if (!a.isDirectory && b.isDirectory) return 1
    return a.name.localeCompare(b.name)
  })
  
  return results
}

/**
 * Read a file's content (text only, with size limit).
 */
export async function readFileContent(baseDir: string, relativePath: string): Promise<{ content: string; size: number }> {
  const safePath = validatePath(baseDir, relativePath)
  const stat = await fs.stat(safePath)
  
  if (stat.size > MAX_FILE_SIZE) {
    throw new Error(`File too large to read in editor: ${stat.size} bytes (max ${MAX_FILE_SIZE} bytes)`)
  }
  
  if (stat.isDirectory()) {
    throw new Error('Cannot read a directory as a file')
  }
  
  const content = await fs.readFile(safePath, 'utf-8')
  return { content, size: stat.size }
}

/**
 * Write content to a file.
 */
export async function writeFileContent(baseDir: string, relativePath: string, content: string): Promise<void> {
  const safePath = validatePath(baseDir, relativePath)
  await fs.writeFile(safePath, content, 'utf-8')
}

/**
 * Create a new file.
 */
export async function createFile(baseDir: string, relativePath: string): Promise<void> {
  const fileName = path.basename(relativePath)
  sanitizeFileName(fileName)
  const safePath = validatePath(baseDir, relativePath)
  
  const dir = path.dirname(safePath)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(safePath, '', 'utf-8')
}

/**
 * Create a new directory.
 */
export async function createDirectory(baseDir: string, relativePath: string): Promise<void> {
  const dirName = path.basename(relativePath)
  sanitizeFileName(dirName)
  const safePath = validatePath(baseDir, relativePath)
  await fs.mkdir(safePath, { recursive: true })
}

/**
 * Delete a file or directory.
 */
export async function deletePath(baseDir: string, relativePath: string): Promise<void> {
  const safePath = validatePath(baseDir, relativePath)
  
  if (relativePath === '.' || relativePath === '' || relativePath === '/') {
    throw new SecurityError('Cannot delete the root directory')
  }
  
  const stat = await fs.stat(safePath)
  if (stat.isDirectory()) {
    await fs.rm(safePath, { recursive: true, force: true })
  } else {
    await fs.unlink(safePath)
  }
}

/**
 * Rename a file or directory.
 */
export async function renamePath(baseDir: string, oldRelativePath: string, newRelativePath: string): Promise<void> {
  const oldSafePath = validatePath(baseDir, oldRelativePath)
  const newSafePath = validatePath(baseDir, newRelativePath)
  
  const newName = path.basename(newRelativePath)
  sanitizeFileName(newName)
  
  await fs.rename(oldSafePath, newSafePath)
}

/**
 * Get the total disk usage of an application's storage directory.
 */
export async function getDirectorySize(dirPath: string): Promise<number> {
  let totalSize = 0
  
  async function walk(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(fullPath)
      } else {
        try {
          const stat = await fs.stat(fullPath)
          totalSize += stat.size
        } catch {
          // Skip files we can't stat
        }
      }
    }
  }
  
  try {
    await walk(dirPath)
  } catch {
    // Directory might not exist
  }
  
  return totalSize
}

/**
 * Save an uploaded file to the application's storage.
 */
export async function saveUploadedFile(baseDir: string, relativePath: string, buffer: Buffer): Promise<number> {
  const fileName = path.basename(relativePath)
  sanitizeFileName(fileName)
  const safePath = validatePath(baseDir, relativePath)
  
  const dir = path.dirname(safePath)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(safePath, buffer)
  return buffer.length
}

/**
 * Check if a path exists.
 */
export async function pathExists(baseDir: string, relativePath: string): Promise<boolean> {
  try {
    const safePath = validatePath(baseDir, relativePath)
    await fs.access(safePath)
    return true
  } catch {
    return false
  }
}

/**
 * Get the content type for a file based on extension.
 */
export function getContentType(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase()
  const types: Record<string, string> = {
    '.py': 'text/x-python',
    '.js': 'text/javascript',
    '.ts': 'text/typescript',
    '.json': 'application/json',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.yml': 'text/yaml',
    '.yaml': 'text/yaml',
    '.html': 'text/html',
    '.css': 'text/css',
    '.php': 'text/x-php',
    '.sh': 'text/x-shellscript',
    '.env': 'text/plain',
    '.log': 'text/plain',
    '.csv': 'text/csv',
    '.xml': 'text/xml',
    '.sql': 'text/x-sql',
    '.toml': 'text/x-toml',
    '.cfg': 'text/plain',
    '.ini': 'text/plain',
    '.conf': 'text/plain',
  }
  return types[ext] || 'application/octet-stream'
}

/**
 * Detect project type from uploaded files.
 */
export function detectProjectType(fileNames: string[]): {
  runtime: 'python' | 'php' | 'custom'
  appType: string
  entryPoint: string | null
  installCmd: string | null
} {
  const hasPython = fileNames.some(f => f.endsWith('.py'))
  const hasPHP = fileNames.some(f => f.endsWith('.php'))
  const hasComposer = fileNames.includes('composer.json')
  const hasRequirements = fileNames.includes('requirements.txt')
  const hasMainPy = fileNames.includes('main.py')
  const hasAppPy = fileNames.includes('app.py')
  const hasIndexPhp = fileNames.includes('index.php')
  const hasPublic = fileNames.some(f => f.startsWith('public/'))
  const hasProcfile = fileNames.includes('Procfile')
  
  if (hasPHP || hasComposer) {
    return {
      runtime: 'php',
      appType: 'php-web',
      entryPoint: hasPublic ? 'public/index.php' : 'index.php',
      installCmd: hasComposer ? 'composer install --no-dev' : null,
    }
  }
  
  if (hasPython) {
    if (hasMainPy) {
      return {
        runtime: 'python',
        appType: 'python-web',
        entryPoint: 'main.py',
        installCmd: hasRequirements ? 'pip install -r requirements.txt' : null,
      }
    }
    if (hasAppPy) {
      return {
        runtime: 'python',
        appType: 'python-api',
        entryPoint: 'app.py',
        installCmd: hasRequirements ? 'pip install -r requirements.txt' : null,
      }
    }
    // Find any .py file as entry point
    const pyFiles = fileNames.filter(f => f.endsWith('.py'))
    if (pyFiles.length > 0) {
      return {
        runtime: 'python',
        appType: 'python-script',
        entryPoint: pyFiles[0],
        installCmd: hasRequirements ? 'pip install -r requirements.txt' : null,
      }
    }
  }
  
  if (hasProcfile) {
    return {
      runtime: 'custom',
      appType: 'custom',
      entryPoint: null,
      installCmd: null,
    }
  }
  
  return {
    runtime: 'custom',
    appType: 'custom',
    entryPoint: null,
    installCmd: null,
  }
}

/**
 * Search for text within files in a directory.
 */
export async function searchInFiles(baseDir: string, query: string, maxResults: number = 50): Promise<{ file: string; line: number; text: string }[]> {
  const results: { file: string; line: number; text: string }[] = []
  const safeQuery = query.toLowerCase()
  
  async function searchDir(dir: string, relativeBase: string): Promise<void> {
    if (results.length >= maxResults) return
    
    let entries: fs.Dirent[]
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    
    for (const entry of entries) {
      if (results.length >= maxResults) break
      if (entry.name.startsWith('.') && entry.name !== '.env') continue
      
      const fullPath = path.join(dir, entry.name)
      const relativePath = path.join(relativeBase, entry.name)
      
      if (entry.isDirectory()) {
        await searchDir(fullPath, relativePath)
      } else {
        try {
          const stat = await fs.stat(fullPath)
          // Skip binary/large files
          if (stat.size > 1024 * 1024) continue
          
          const content = await fs.readFile(fullPath, 'utf-8')
          const lines = content.split('\n')
          
          for (let i = 0; i < lines.length && results.length < maxResults; i++) {
            if (lines[i].toLowerCase().includes(safeQuery)) {
              results.push({
                file: relativePath,
                line: i + 1,
                text: lines[i].trim().substring(0, 200),
              })
            }
          }
        } catch {
          // Skip files we can't read
        }
      }
    }
  }
  
  await searchDir(baseDir, '.')
  return results
}

/**
 * Calculate directory size using synchronous approach for quick stats.
 */
export function getDirectorySizeSync(dirPath: string): number {
  let totalSize = 0
  try {
    const entries = fsSync.readdirSync(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        totalSize += getDirectorySizeSync(fullPath)
      } else {
        try {
          const stat = fsSync.statSync(fullPath)
          totalSize += stat.size
        } catch {
          // skip
        }
      }
    }
  } catch {
    // Directory doesn't exist or not accessible
  }
  return totalSize
}
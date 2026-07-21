import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { SecurityError } from '@/lib/utils/security'
import {
  listFiles,
  readFileContent,
  writeFileContent,
  createDirectory,
  deletePath,
  renamePath,
  saveUploadedFile,
  searchInFiles,
  getContentType,
} from '@/lib/utils/files'
import { MAX_FILE_SIZE } from '@/lib/constants'
import fs from 'fs/promises'
import path from 'path'

function ok<T>(data: T): NextResponse {
  return NextResponse.json({ success: true, data })
}

function err(code: string, message: string, details?: string, actionable?: string, status = 400): NextResponse {
  return NextResponse.json(
    { success: false, error: { code, message, details, actionable } },
    { status }
  )
}

async function getApp(id: string) {
  const app = await db.application.findUnique({ where: { id } })
  if (!app) {
    return null
  }
  return app
}

// GET /api/apps/[id]/files - List files, read file content, or download
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const filePath = searchParams.get('path') || '.'
    const action = searchParams.get('action') // 'read' or 'download'

    const app = await getApp(id)
    if (!app) {
      return err('NOT_FOUND', `Application with id "${id}" not found`, undefined, undefined, 404)
    }

    // Read file content
    if (action === 'read') {
      try {
        const { content, size } = await readFileContent(app.storagePath, filePath)
        const contentType = getContentType(filePath)
        return ok({ content, size, path: filePath, contentType, isBinary: contentType === 'application/octet-stream' })
      } catch (error: unknown) {
        const e = error as { message?: string }
        if (e.message?.includes('too large')) {
          return err('FILE_TOO_LARGE', e.message, undefined, 'Use the download endpoint for large files')
        }
        if (e.message?.includes('Directory not found')) {
          return err('NOT_FOUND', e.message, undefined, undefined, 404)
        }
        if (e.message?.includes('Cannot read a directory')) {
          return err('INVALID_PATH', e.message, undefined, 'Use the list endpoint (without ?action=read) to view directory contents')
        }
        throw error
      }
    }

    // Download file
    if (action === 'download') {
      const { validatePath } = await import('@/lib/utils/security')
      const safePath = validatePath(app.storagePath, filePath)
      try {
        const stat = await fs.stat(safePath)
        if (stat.isDirectory()) {
          return err('INVALID_PATH', 'Cannot download a directory', undefined, 'Use backup functionality to download directories')
        }
      } catch {
        return err('NOT_FOUND', `File not found: ${filePath}`, undefined, undefined, 404)
      }

      const fileBuffer = await fs.readFile(safePath)
      const fileName = path.basename(safePath)
      const contentType = getContentType(fileName)

      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${fileName}"`,
          'Content-Length': String(fileBuffer.length),
        },
      })
    }

    // Default: list directory
    try {
      const files = await listFiles(app.storagePath, filePath)
      return ok(files)
    } catch (error: unknown) {
      const e = error as { message?: string }
      if (e.message?.includes('Directory not found')) {
        return err('NOT_FOUND', e.message, undefined, undefined, 404)
      }
      if (e.message?.includes('Permission denied')) {
        return err('PERMISSION_DENIED', e.message, undefined, undefined, 403)
      }
      throw error
    }
  } catch (error) {
    if (error instanceof SecurityError) {
      return err('SECURITY_ERROR', error.message, undefined, undefined, 403)
    }
    console.error('Files GET failed:', error)
    return err('INTERNAL_ERROR', 'Failed to read files', undefined, undefined, 500)
  }
}

// POST /api/apps/[id]/files - Upload, mkdir, write, rename, or search
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action') // 'upload', 'mkdir', 'write', 'rename', 'search'

    const app = await getApp(id)
    if (!app) {
      return err('NOT_FOUND', `Application with id "${id}" not found`, undefined, undefined, 404)
    }

    if (!action) {
      return err('VALIDATION_ERROR', 'Missing action parameter. Use ?action=upload|mkdir|write|rename|search')
    }

    switch (action) {
      case 'upload':
        return handleUpload(app, request)
      case 'mkdir':
        return handleMkdir(app, request)
      case 'write':
        return handleWrite(app, request)
      case 'rename':
        return handleRename(app, request)
      case 'search':
        return handleSearch(app, request)
      default:
        return err('VALIDATION_ERROR', `Unknown action: ${action}. Use upload|mkdir|write|rename|search`)
    }
  } catch (error) {
    if (error instanceof SecurityError) {
      return err('SECURITY_ERROR', error.message, undefined, undefined, 403)
    }
    console.error('Files POST failed:', error)
    return err('INTERNAL_ERROR', 'File operation failed', undefined, undefined, 500)
  }
}

// DELETE /api/apps/[id]/files?path=... - Delete file/directory
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const filePath = searchParams.get('path')

    if (!filePath || filePath === '.' || filePath === '') {
      return err('VALIDATION_ERROR', 'Path parameter is required and cannot be the root directory')
    }

    const app = await getApp(id)
    if (!app) {
      return err('NOT_FOUND', `Application with id "${id}" not found`, undefined, undefined, 404)
    }

    try {
      await deletePath(app.storagePath, filePath)
    } catch (error: unknown) {
      const e = error as { message?: string }
      if (e.message?.includes('not found') || (e as NodeJS.ErrnoException).code === 'ENOENT') {
        return err('NOT_FOUND', `File or directory not found: ${filePath}`, undefined, undefined, 404)
      }
      throw error
    }

    await createAuditLog(app.id, 'delete_file', 'success', `Deleted: ${filePath}`)
    return ok({ deleted: true, path: filePath })
  } catch (error) {
    if (error instanceof SecurityError) {
      return err('SECURITY_ERROR', error.message, undefined, undefined, 403)
    }
    console.error('Files DELETE failed:', error)
    return err('INTERNAL_ERROR', 'Failed to delete file', undefined, undefined, 500)
  }
}

// ---- Handlers ----

async function handleUpload(app: any, request: NextRequest) {
  const formData = await request.formData()
  const files = formData.getAll('files') as File[]
  const targetPath = (formData.get('path') as string) || '.'

  if (!files || files.length === 0) {
    return err('VALIDATION_ERROR', 'No files provided. Use "files" field in multipart form data.')
  }

  if (files.length > 50) {
    return err('VALIDATION_ERROR', 'Too many files. Maximum 50 files per upload.')
  }

  const results: { name: string; size: number; error?: string }[] = []
  for (const file of files) {
    try {
      const relativePath = path.join(targetPath, file.name)
      if (file.size > MAX_FILE_SIZE) {
        results.push({ name: file.name, size: file.size, error: `File exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024}MB` })
        continue
      }
      const buffer = Buffer.from(await file.arrayBuffer())
      const savedSize = await saveUploadedFile(app.storagePath, relativePath, buffer)
      results.push({ name: file.name, size: savedSize })
    } catch (error: unknown) {
      const e = error as { message?: string }
      results.push({ name: file.name, size: file.size, error: e.message || 'Upload failed' })
    }
  }

  const successCount = results.filter(r => !r.error).length
  await createAuditLog(app.id, 'upload_file', 'success', `Uploaded ${successCount}/${files.length} files to ${targetPath}`)

  return ok({ results, uploaded: successCount, total: files.length })
}

async function handleMkdir(app: any, request: NextRequest) {
  const body = await request.json()
  const dirPath = body.path || '.'
  const dirName = body.name

  if (!dirName || typeof dirName !== 'string') {
    return err('VALIDATION_ERROR', 'Directory name is required (field: "name")')
  }

  if (dirName.includes('/') || dirName.includes('\\')) {
    return err('VALIDATION_ERROR', 'Directory name must not contain path separators. Use "path" field for the parent directory.')
  }

  const fullPath = path.join(dirPath, dirName)
  try {
    await createDirectory(app.storagePath, fullPath)
  } catch (error: unknown) {
    const e = error as { message?: string }
    if (e.message?.includes('already exists')) {
      return err('ALREADY_EXISTS', `Directory "${dirName}" already exists at ${dirPath}`)
    }
    throw error
  }

  await createAuditLog(app.id, 'create_directory', 'success', `Created directory: ${fullPath}`)
  return ok({ created: true, path: fullPath })
}

async function handleWrite(app: any, request: NextRequest) {
  const body = await request.json()
  const filePath = body.path
  const content = body.content

  if (!filePath || typeof filePath !== 'string') {
    return err('VALIDATION_ERROR', 'File path is required (field: "path")')
  }
  if (content === undefined || content === null) {
    return err('VALIDATION_ERROR', 'File content is required (field: "content")')
  }
  if (typeof content !== 'string') {
    return err('VALIDATION_ERROR', 'Content must be a string')
  }
  if (content.length > MAX_FILE_SIZE) {
    return err('VALIDATION_ERROR', `Content exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024}MB`)
  }

  try {
    await writeFileContent(app.storagePath, filePath, content)
  } catch (error: unknown) {
    const e = error as { message?: string }
    if (e.message?.includes('not a directory')) {
      return err('INVALID_PATH', `Parent path is not a directory: ${path.dirname(filePath)}`)
    }
    throw error
  }

  await createAuditLog(app.id, 'write_file', 'success', `Wrote file: ${filePath}`)
  return ok({ written: true, path: filePath, size: content.length })
}

async function handleRename(app: any, request: NextRequest) {
  const body = await request.json()
  const oldPath = body.oldPath
  const newPath = body.newPath

  if (!oldPath || typeof oldPath !== 'string') {
    return err('VALIDATION_ERROR', 'Source path is required (field: "oldPath")')
  }
  if (!newPath || typeof newPath !== 'string') {
    return err('VALIDATION_ERROR', 'Destination path is required (field: "newPath")')
  }

  try {
    await renamePath(app.storagePath, oldPath, newPath)
  } catch (error: unknown) {
    const e = error as { message?: string }
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      return err('NOT_FOUND', `Source path not found: ${oldPath}`, undefined, undefined, 404)
    }
    if (e.message?.includes('already exists')) {
      return err('ALREADY_EXISTS', `Destination already exists: ${newPath}`)
    }
    throw error
  }

  await createAuditLog(app.id, 'rename_file', 'success', `Renamed: ${oldPath} -> ${newPath}`)
  return ok({ renamed: true, from: oldPath, to: newPath })
}

async function handleSearch(app: any, request: NextRequest) {
  const body = await request.json()
  const query = body.query

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return err('VALIDATION_ERROR', 'Search query is required (field: "query")')
  }

  if (query.length > 200) {
    return err('VALIDATION_ERROR', 'Search query must be less than 200 characters')
  }

  const results = await searchInFiles(app.storagePath, query.trim())
  return ok({ results, total: results.length, query })
}

async function createAuditLog(appId: string, action: string, status: string, details: string) {
  try {
    await db.auditLog.create({
      data: { appId, action, resource: 'file', details, status },
    })
  } catch {
    // Best effort
  }
}
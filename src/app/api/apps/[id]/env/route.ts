import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { SecurityError, maskSecret } from '@/lib/utils/security'

function ok<T>(data: T): NextResponse {
  return NextResponse.json({ success: true, data })
}

function err(code: string, message: string, details?: string, actionable?: string, status = 400): NextResponse {
  return NextResponse.json(
    { success: false, error: { code, message, details, actionable } },
    { status }
  )
}

// Validate env var key format
function validateEnvKey(key: string): void {
  if (!key || typeof key !== 'string') {
    throw new Error('Key is required')
  }
  if (key.length > 256) {
    throw new Error('Key must be less than 256 characters')
  }
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
    throw new Error('Key must start with a letter or underscore and contain only alphanumeric characters and underscores')
  }
}

// GET /api/apps/[id]/env - List env vars (secrets masked)
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const app = await db.application.findUnique({ where: { id } })
    if (!app) {
      return err('NOT_FOUND', `Application with id "${id}" not found`, undefined, undefined, 404)
    }

    const envVars = await db.envVar.findMany({
      where: { appId: id },
      orderBy: { createdAt: 'asc' },
    })

    // Mask secret values
    const masked = envVars.map(ev => ({
      id: ev.id,
      key: ev.key,
      value: ev.isSecret ? maskSecret(ev.value) : ev.value,
      isSecret: ev.isSecret,
      scope: ev.scope,
      createdAt: ev.createdAt,
      updatedAt: ev.updatedAt,
    }))

    return ok(masked)
  } catch (error) {
    if (error instanceof SecurityError) {
      return err('SECURITY_ERROR', error.message, undefined, undefined, 403)
    }
    console.error('Failed to list env vars:', error)
    return err('INTERNAL_ERROR', 'Failed to list environment variables', undefined, undefined, 500)
  }
}

// POST /api/apps/[id]/env - Upsert env var (or reveal secret with ?action=reveal)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    const app = await db.application.findUnique({ where: { id } })
    if (!app) {
      return err('NOT_FOUND', `Application with id "${id}" not found`, undefined, undefined, 404)
    }

    // Handle reveal action
    if (action === 'reveal') {
      const body = await request.json()
      if (!body.key || typeof body.key !== 'string') {
        return err('VALIDATION_ERROR', 'Key is required to reveal a secret')
      }

      const envVar = await db.envVar.findUnique({
        where: { appId_key: { appId: id, key: body.key } },
      })

      if (!envVar) {
        return err('NOT_FOUND', `Environment variable "${body.key}" not found`, undefined, undefined, 404)
      }

      await createAuditLog(app.id, 'reveal_env', 'success', `Revealed secret value for key: ${body.key}`)
      return ok({ key: envVar.key, value: envVar.value, isSecret: envVar.isSecret })
    }

    // Default: upsert env var
    const body = await request.json()
    const { key, value, isSecret, scope } = body

    try {
      validateEnvKey(key)
    } catch (error: unknown) {
      const e = error as Error
      return err('VALIDATION_ERROR', `Invalid key: ${e.message}`)
    }

    if (value === undefined || value === null) {
      return err('VALIDATION_ERROR', 'Value is required')
    }

    if (typeof value !== 'string') {
      return err('VALIDATION_ERROR', 'Value must be a string')
    }

    if (value.length > 10000) {
      return err('VALIDATION_ERROR', 'Value must be less than 10,000 characters')
    }

    const validScopes = ['all', 'build', 'runtime']
    const envScope = validScopes.includes(scope) ? scope : 'all'

    // Upsert
    const envVar = await db.envVar.upsert({
      where: { appId_key: { appId: id, key } },
      update: { value: String(value), isSecret: !!isSecret, scope: envScope },
      create: { appId: id, key, value: String(value), isSecret: !!isSecret, scope: envScope },
    })

    await createAuditLog(app.id, 'upsert_env', 'success', `${envVar.isSecret ? 'Updated secret' : 'Updated'} env var: ${key}`)

    return ok({
      id: envVar.id,
      key: envVar.key,
      value: envVar.isSecret ? maskSecret(envVar.value) : envVar.value,
      isSecret: envVar.isSecret,
      scope: envVar.scope,
    })
  } catch (error) {
    if (error instanceof SecurityError) {
      return err('SECURITY_ERROR', error.message, undefined, undefined, 403)
    }
    if (error instanceof SyntaxError) {
      return err('INVALID_JSON', 'Request body contains invalid JSON')
    }
    console.error('Failed to upsert env var:', error)
    return err('INTERNAL_ERROR', 'Failed to save environment variable', undefined, undefined, 500)
  }
}

// DELETE /api/apps/[id]/env?key=... - Delete env var
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const key = searchParams.get('key')

    if (!key) {
      return err('VALIDATION_ERROR', 'Query parameter "key" is required')
    }

    try {
      validateEnvKey(key)
    } catch (error: unknown) {
      const e = error as Error
      return err('VALIDATION_ERROR', `Invalid key: ${e.message}`)
    }

    const app = await db.application.findUnique({ where: { id } })
    if (!app) {
      return err('NOT_FOUND', `Application with id "${id}" not found`, undefined, undefined, 404)
    }

    const envVar = await db.envVar.findUnique({
      where: { appId_key: { appId: id, key } },
    })

    if (!envVar) {
      return err('NOT_FOUND', `Environment variable "${key}" not found`, undefined, undefined, 404)
    }

    await db.envVar.delete({
      where: { appId_key: { appId: id, key } },
    })

    await createAuditLog(app.id, 'delete_env', 'success', `Deleted env var: ${key}`)
    return ok({ deleted: true, key })
  } catch (error) {
    if (error instanceof SecurityError) {
      return err('SECURITY_ERROR', error.message, undefined, undefined, 403)
    }
    console.error('Failed to delete env var:', error)
    return err('INTERNAL_ERROR', 'Failed to delete environment variable', undefined, undefined, 500)
  }
}

async function createAuditLog(appId: string, action: string, status: string, details: string) {
  try {
    await db.auditLog.create({
      data: { appId, action, resource: 'env_var', details, status },
    })
  } catch {
    // Best effort
  }
}
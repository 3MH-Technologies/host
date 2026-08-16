import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { slugify, SecurityError } from '@/lib/utils/security'
import type { ApiResponse, AppStatus } from '@/lib/types'
import { DEFAULT_RUNTIME_COMMANDS, DEFAULT_PYTHON_VERSION, DEFAULT_PHP_VERSION } from '@/lib/constants'
import fs from 'fs/promises'
import path from 'path'

const APPS_DIR = path.join(process.cwd(), 'apps')

function ok<T>(data: T, meta?: ApiResponse<T>['meta']): NextResponse {
  return NextResponse.json({ success: true, data, meta })
}

function err(code: string, message: string, details?: string, actionable?: string, status = 400): NextResponse {
  return NextResponse.json(
    { success: false, error: { code, message, details, actionable } },
    { status }
  )
}

// GET /api/apps - List all apps
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const sort = searchParams.get('sort') || 'createdAt'
    const order = searchParams.get('order') === 'asc' ? 'asc' : 'desc'

    // Validate sort field
    const allowedSortFields = ['createdAt', 'updatedAt', 'name', 'status']
    const sortField = allowedSortFields.includes(sort) ? sort : 'createdAt'

    // Build where clause
    const where: Record<string, unknown> = {}
    if (status) {
      where.status = status
    }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { slug: { contains: search } },
        { description: { contains: search } },
      ]
    }

    const [apps, total] = await Promise.all([
      db.application.findMany({
        where,
        orderBy: { [sortField]: order },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          appType: true,
          runtime: true,
          runtimeVersion: true,
          status: true,
          port: true,
          createdAt: true,
          updatedAt: true,
          lastStartedAt: true,
          lastStoppedAt: true,
          _count: {
            select: { envVars: true },
          },
        },
      }),
      db.application.count({ where }),
    ])

    return ok(apps, { page, limit, total })
  } catch (error) {
    if (error instanceof SecurityError) {
      return err('SECURITY_ERROR', error.message, undefined, undefined, 403)
    }
    console.error('Failed to list apps:', error)
    return err('INTERNAL_ERROR', 'Failed to list applications', undefined, undefined, 500)
  }
}

// POST /api/apps - Create a new application
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return err('UNAUTHORIZED', 'يجب تسجيل الدخول', undefined, undefined, 401)
    }

    let body: Record<string, unknown>
    let uploadedFiles: File[] = []
    let zipFile: File | null = null

    const contentType = request.headers.get('content-type') || ''
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const dataStr = formData.get('data') as string
      body = dataStr ? JSON.parse(dataStr) : {}
      // Collect uploaded files
      for (const [key, value] of formData.entries()) {
        if (key === 'zipFile' && value instanceof File) zipFile = value
        else if (key === 'files' && value instanceof File) uploadedFiles.push(value)
      }
    } else {
      body = await request.json()
    }

    // Validate required fields
    if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
      return err('VALIDATION_ERROR', 'اسم التطبيق مطلوب')
    }

    if (body.name.length > 100) {
      return err('VALIDATION_ERROR', 'اسم التطبيق يجب أن يكون أقل من 100 حرف')
    }

    // Determine app type
    const appType = body.appType || 'custom'
    const validAppTypes = [
      'python-web', 'python-bot', 'python-discord-bot', 'python-worker',
      'python-api', 'python-script', 'php-web', 'php-worker', 'custom',
    ]
    if (!validAppTypes.includes(appType)) {
      return err('VALIDATION_ERROR', `نوع التطبيق غير صالح: ${appType}`)
    }

    // Determine runtime
    let runtime = body.runtime
    if (!runtime) {
      if (appType.startsWith('python')) runtime = 'python'
      else if (appType.startsWith('php')) runtime = 'php'
      else runtime = 'custom'
    }
    if (!['python', 'php'].includes(runtime) && runtime !== 'custom') runtime = 'custom'

    // Generate slug
    const slug = slugify(body.name.trim())

    // Check if slug already exists
    const existing = await db.application.findUnique({ where: { slug } })
    if (existing) {
      return err('CONFLICT', `يوجد تطبيق بنفس الاسم`)
    }

    // Set defaults from app type
    const defaults = DEFAULT_RUNTIME_COMMANDS[appType as keyof typeof DEFAULT_RUNTIME_COMMANDS] || DEFAULT_RUNTIME_COMMANDS.custom
    const runtimeVersion = body.runtimeVersion || (runtime === 'python' ? DEFAULT_PYTHON_VERSION : DEFAULT_PHP_VERSION)

    let startCmd = body.startCmd || defaults.start
    if (startCmd && body.port) {
      startCmd = startCmd.replace('{port}', String(body.port))
    }

    // Create storage directory
    const storagePath = path.join(APPS_DIR, slug)
    await fs.mkdir(storagePath, { recursive: true })

    // Create the app in database
    const app = await db.application.create({
      data: {
        name: body.name.trim(),
        slug,
        description: body.description || null,
        appType,
        runtime: runtime === 'custom' ? 'python' : runtime,
        runtimeVersion,
        status: 'CREATED',
        storagePath,
        entryPoint: body.entryPoint || null,
        installCmd: body.installCmd || defaults.install,
        buildCmd: body.buildCmd || defaults.build,
        startCmd,
        stopCmd: body.stopCmd || null,
        restartCmd: body.restartCmd || null,
        healthCheckCmd: body.healthCheckCmd || null,
        port: body.port || null,
        host: '0.0.0.0',
        userId: session.user.id,
      },
    })

    // Create initial env vars if provided
    if (body.envVars && Array.isArray(body.envVars)) {
      for (const envVar of body.envVars) {
        if (envVar.key && typeof envVar.key === 'string') {
          await db.envVar.create({
            data: {
              appId: app.id,
              key: envVar.key,
              value: envVar.value || '',
              isSecret: envVar.isSecret || false,
            },
          })
        }
      }
    }

    // Create audit log
    await db.auditLog.create({
      data: {
        appId: app.id,
        action: 'create_app',
        resource: 'application',
        details: `Created application "${app.name}" (${app.appType}, ${app.runtime})`,
        status: 'success',
      },
    })

    return ok(app, undefined)
  } catch (error) {
    if (error instanceof SecurityError) {
      return err('SECURITY_ERROR', error.message, undefined, undefined, 403)
    }
    if (error instanceof SyntaxError) {
      return err('INVALID_JSON', 'JSON غير صالح')
    }
    console.error('Failed to create app:', error)
    return err('INTERNAL_ERROR', 'فشل في إنشاء التطبيق', undefined, undefined, 500)
  }
}
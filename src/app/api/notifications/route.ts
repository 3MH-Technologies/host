import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import type { ApiResponse } from '@/lib/types'

export async function GET() {
  try {
    const notifications = await db.notification.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return NextResponse.json<ApiResponse>({ success: true, data: notifications })
  } catch (error) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch notifications' } },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { id } = await request.json()
    if (!id) {
      return NextResponse.json<ApiResponse>(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Notification ID is required' } },
        { status: 400 }
      )
    }
    await db.notification.update({ where: { id }, data: { read: true } })
    return NextResponse.json<ApiResponse>({ success: true })
  } catch (error) {
    return NextResponse.json<ApiResponse>(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update notification' } },
      { status: 500 }
    )
  }
}

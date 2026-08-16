'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { toast } from 'sonner'
import { Loader2, User, Shield, Calendar } from 'lucide-react'
import { useApps } from '@/hooks/use-api'

export function ProfileView() {
  const { user } = useAuth()
  const { data: appsData } = useApps({ limit: 1 })
  const totalApps = appsData?.meta?.total ?? 0

  const [name, setName] = useState('')
  const [createdAt, setCreatedAt] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/user/profile')
        if (res.ok && !cancelled) {
          const data = await res.json()
          if (data.name) setName(data.name)
          if (data.createdAt) setCreatedAt(data.createdAt)
        }
      } catch {
        // silent
      }
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      })
      if (res.ok) {
        toast.success('تم تحديث الملف الشخصي')
      } else {
        const data = await res.json()
        toast.error(data.error || 'حدث خطأ')
      }
    } catch {
      toast.error('حدث خطأ')
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-bold">الملف الشخصي</h1>

      {/* User Info Card */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center gap-4 mb-6">
            <div className="h-14 w-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <span className="text-emerald-500 text-xl font-bold">
                {(user?.name || user?.email || 'م').charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="font-semibold text-sm">{user?.name || 'بدون اسم'}</p>
              <p className="text-xs text-muted-foreground">@{user?.email?.split('@')[0] || 'user'}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">الاسم</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="أدخل اسمك" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">اسم المستخدم</Label>
              <Input value={user?.email?.split('@')[0] || ''} disabled className="bg-muted" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">البريد الإلكتروني</Label>
              <Input value={user?.email || ''} disabled className="bg-muted" dir="ltr" />
            </div>

            <Button
              onClick={handleSave}
              disabled={saving}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-500 gap-1.5"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              حفظ التغييرات
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Account Info */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <InfoCard icon={User} label="التطبيقات" value={`${totalApps} من 3`} />
        <InfoCard icon={Shield} label="الخطة" value="مجانية" />
        <InfoCard icon={Calendar} label="انضم في" value={createdAt ? new Date(createdAt).toLocaleDateString('ar-SA', { month: 'short', year: 'numeric' }) : '—'} />
      </div>

      {/* Change Password */}
      <Card>
        <CardContent className="p-5">
          <h2 className="text-sm font-semibold mb-4">تغيير كلمة المرور</h2>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </div>
  )
}

function InfoCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 p-3.5 rounded-lg border bg-card">
      <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div>
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  )
}

function ChangePasswordForm() {
  const [current, setCurrent] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!current || !newPass || !confirm) {
      toast.error('جميع الحقول مطلوبة')
      return
    }
    if (newPass !== confirm) {
      toast.error('كلمة المرور الجديدة غير متطابقة')
      return
    }
    if (newPass.length < 6) {
      toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/user/password', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: newPass }),
      })
      if (res.ok) {
        toast.success('تم تغيير كلمة المرور')
        setCurrent('')
        setNewPass('')
        setConfirm('')
      } else {
        const data = await res.json()
        toast.error(data.error || 'حدث خطأ')
      }
    } catch {
      toast.error('حدث خطأ')
    }
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">كلمة المرور الحالية</Label>
        <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} dir="ltr" className="text-left" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">كلمة المرور الجديدة</Label>
        <Input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} dir="ltr" className="text-left" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">تأكيد كلمة المرور</Label>
        <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} dir="ltr" className="text-left" />
      </div>
      <Button
        type="submit"
        disabled={saving}
        size="sm"
        variant="outline"
        className="gap-1.5"
      >
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        تغيير كلمة المرور
      </Button>
    </form>
  )
}
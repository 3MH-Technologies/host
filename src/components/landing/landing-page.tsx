'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Terminal,
  Shield,
  Zap,
  Globe,
  Server,
  Menu,
  X,
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'

/* ------------------------------------------------------------------ */
/*  Animation                                                          */
/* ------------------------------------------------------------------ */
const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: 'easeOut' },
  }),
}

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */
const features = [
  { icon: Terminal, title: 'طرفية تفاعلية', desc: 'تحكم في تطبيقاتك مباشرة من المتصفح.' },
  { icon: Shield, title: 'حماية متقدمة', desc: 'تشفير كامل وعزل آمن لكل تطبيق.' },
  { icon: Zap, title: 'أداء عالي', desc: 'تشغيل سريع مع إدارة موارد ذكية.' },
  { icon: Globe, title: 'نشر فوري', desc: 'انشر تطبيقك بخطوات بسيطة.' },
  { icon: Server, title: 'دعم Python و PHP', desc: 'دعم كامل لأشهر لغات الويب.' },
  { icon: Terminal, title: 'إدارة ملفات', desc: 'رفع وتعديل الملفات بسهولة.' },
]

const steps = [
  { num: '١', title: 'أنشئ حسابك', desc: 'سجل مجانًا في ثوانٍ.' },
  { num: '٢', title: 'ارفع تطبيقك', desc: 'ارفع مشروعك بسهولة.' },
  { num: '٣', title: 'انطلق!', desc: 'تطبيقك يعمل مباشرة.' },
]

const plans = [
  {
    name: 'مجاني',
    price: '٠',
    features: ['٣ تطبيقات', '٥١٢ MB RAM', '1 نواة CPU', '500 MB تخزين', 'طرفية تفاعلية'],
  },
  {
    name: 'احترافي',
    price: '٢٩',
    popular: true,
    features: ['١٠ تطبيقات', '2 GB RAM', '2 نواة CPU', '5 GB تخزين', 'دعم فني', 'نسخ احتياطي'],
  },
  {
    name: 'المؤسسات',
    price: 'مخصص',
    features: ['تطبيقات غير محدودة', 'RAM مخصص', 'CPU مخصص', 'تخزين مخصص', 'دعم فني 24/7', 'SLA مخصص'],
  },
]

/* ------------------------------------------------------------------ */
/*  Auth Dialog                                                        */
/* ------------------------------------------------------------------ */
function AuthDialog({
  open,
  onOpenChange,
  defaultTab = 'login',
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  defaultTab?: 'login' | 'register'
}) {
  const { login, register } = useAuth()
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const fd = new FormData(e.currentTarget)
    const email = fd.get('email') as string
    const password = fd.get('password') as string
    if (!email || !password) { setError('جميع الحقول مطلوبة'); setLoading(false); return }
    try {
      const res = await login(email, password)
      if (res?.error) setError('البريد الإلكتروني أو كلمة المرور غير صحيحة')
      else { toast.success('مرحبًا بك!'); onOpenChange(false) }
    } catch { setError('حدث خطأ أثناء تسجيل الدخول') }
    setLoading(false)
  }

  const handleRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const fd = new FormData(e.currentTarget)
    const name = fd.get('name') as string
    const username = fd.get('username') as string
    const email = fd.get('email') as string
    const password = fd.get('password') as string
    if (!name || !username || !email || !password) { setError('جميع الحقول مطلوبة'); setLoading(false); return }
    try {
      await register({ name, username, email, password })
      toast.success('تم إنشاء الحساب بنجاح!')
      onOpenChange(false)
    } catch (err: any) { setError(err?.message || 'حدث خطأ أثناء التسجيل') }
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-border/50">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-center">
            {defaultTab === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب جديد'}
          </DialogTitle>
          <DialogDescription className="text-center text-sm">
            {defaultTab === 'login' ? 'ادخل إلى حسابك' : 'ابدأ مع Wolf Host مجانًا'}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue={defaultTab}>
          <TabsList className="w-full h-10">
            <TabsTrigger value="login" className="flex-1 text-xs">تسجيل الدخول</TabsTrigger>
            <TabsTrigger value="register" className="flex-1 text-xs">حساب جديد</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <form onSubmit={handleLogin} className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="l-email" className="text-xs">البريد الإلكتروني</Label>
                <Input id="l-email" name="email" type="email" placeholder="you@example.com" dir="ltr" className="text-left" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="l-pass" className="text-xs">كلمة المرور</Label>
                <div className="relative">
                  <Input id="l-pass" name="password" type={showPass ? 'text' : 'password'} placeholder="••••••••" dir="ltr" className="text-left" />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
              <Button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-500 h-10">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'تسجيل الدخول'}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="register">
            <form onSubmit={handleRegister} className="mt-4 space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="r-name" className="text-xs">الاسم</Label>
                <Input id="r-name" name="name" placeholder="أحمد محمد" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="r-user" className="text-xs">اسم المستخدم</Label>
                <Input id="r-user" name="username" placeholder="ahmed" dir="ltr" className="text-left" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="r-email" className="text-xs">البريد الإلكتروني</Label>
                <Input id="r-email" name="email" type="email" placeholder="you@example.com" dir="ltr" className="text-left" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="r-pass" className="text-xs">كلمة المرور</Label>
                <div className="relative">
                  <Input id="r-pass" name="password" type={showPass ? 'text' : 'password'} placeholder="••••••••" dir="ltr" className="text-left" />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
              <Button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-500 h-10">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'إنشاء الحساب'}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ */
/*  Landing Page                                                       */
/* ------------------------------------------------------------------ */
export function LandingPage() {
  const [authOpen, setAuthOpen] = useState(false)
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login')
  const [mobileMenu, setMobileMenu] = useState(false)

  const openAuth = (tab: 'login' | 'register') => {
    setAuthTab(tab)
    setAuthOpen(true)
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="Wolf Host" className="h-6 w-6" />
            <span className="font-bold text-sm">Wolf Host</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">المميزات</a>
            <a href="#how" className="hover:text-foreground transition-colors">كيف يعمل</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">الأسعار</a>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => openAuth('login')} className="text-xs">
              تسجيل الدخول
            </Button>
            <Button size="sm" onClick={() => openAuth('register')} className="bg-emerald-600 hover:bg-emerald-500 text-xs gap-1">
              ابدأ مجانًا
            </Button>
            <button className="md:hidden" onClick={() => setMobileMenu(!mobileMenu)}>
              {mobileMenu ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {mobileMenu && (
          <div className="md:hidden border-t px-4 py-3 space-y-2">
            <a href="#features" className="block text-sm py-1" onClick={() => setMobileMenu(false)}>المميزات</a>
            <a href="#how" className="block text-sm py-1" onClick={() => setMobileMenu(false)}>كيف يعمل</a>
            <a href="#pricing" className="block text-sm py-1" onClick={() => setMobileMenu(false)}>الأسعار</a>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="relative flex-1 flex items-center justify-center py-20 md:py-28 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/5 to-transparent" />
        <div className="relative max-w-2xl mx-auto px-4 text-center space-y-6">
          <motion.div
            initial="hidden" animate="visible" custom={0} variants={fadeUp}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium"
          >
            منصة استضافة Python و PHP
          </motion.div>

          <motion.h1
            initial="hidden" animate="visible" custom={1} variants={fadeUp}
            className="text-3xl md:text-5xl font-bold leading-tight"
          >
            استضف تطبيقاتك{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-l from-emerald-400 to-emerald-600">بذكاء</span>
          </motion.h1>

          <motion.p
            initial="hidden" animate="visible" custom={2} variants={fadeUp}
            className="text-muted-foreground text-sm md:text-base max-w-lg mx-auto leading-relaxed"
          >
            Wolf Host يوفر لك بيئة استضافة متكاملة مع طرفية تفاعلية وإدارة ملفات ومراقبة مباشرة.
          </motion.p>

          <motion.div
            initial="hidden" animate="visible" custom={3} variants={fadeUp}
            className="flex items-center justify-center gap-3"
          >
            <Button onClick={() => openAuth('register')} className="bg-emerald-600 hover:bg-emerald-500 gap-1.5">
              ابدأ مجانًا
            </Button>
            <Button variant="outline" onClick={() => openAuth('login')}>
              تسجيل الدخول
            </Button>
          </motion.div>

          <motion.div
            initial="hidden" animate="visible" custom={4} variants={fadeUp}
            className="flex items-center justify-center gap-2 pt-2"
          >
            {['Python', 'PHP', 'Flask', 'Django'].map((t) => (
              <span key={t} className="px-2.5 py-1 rounded-md bg-muted text-[10px] text-muted-foreground font-medium">
                {t}
              </span>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-16 border-t">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="text-xl font-bold text-center mb-8">لماذا Wolf Host؟</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i} variants={fadeUp}
                className="p-5 rounded-xl border bg-card hover:border-emerald-500/30 transition-colors"
              >
                <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center mb-3">
                  <f.icon className="h-4 w-4 text-emerald-500" />
                </div>
                <h3 className="font-semibold text-sm mb-1">{f.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-16 border-t">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-xl font-bold text-center mb-10">كيف يعمل؟</h2>
          <div className="flex flex-col md:flex-row items-center gap-6">
            {steps.map((s, i) => (
              <React.Fragment key={s.num}>
                <motion.div
                  initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i} variants={fadeUp}
                  className="flex-1 text-center space-y-2"
                >
                  <div className="text-3xl font-bold text-emerald-500 mb-2">{s.num}</div>
                  <h3 className="font-semibold text-sm">{s.title}</h3>
                  <p className="text-xs text-muted-foreground">{s.desc}</p>
                </motion.div>
                {i < steps.length - 1 && (
                  <div className="hidden md:block text-muted-foreground/30 text-xl">←</div>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-16 border-t">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-xl font-bold text-center mb-8">الأسعار</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {plans.map((plan, i) => (
              <motion.div
                key={plan.name}
                initial="hidden" whileInView="visible" viewport={{ once: true }} custom={i} variants={fadeUp}
                className={`relative p-5 rounded-xl border bg-card ${plan.popular ? 'border-emerald-500 ring-1 ring-emerald-500/30' : ''}`}
              >
                {plan.popular && (
                  <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-emerald-500 text-[10px] text-white font-medium">
                    الأكثر شعبية
                  </div>
                )}
                <h3 className="font-semibold text-sm mb-1">{plan.name}</h3>
                <div className="mb-4">
                  <span className="text-2xl font-bold">{plan.price}</span>
                  {plan.price !== 'مخصص' && <span className="text-xs text-muted-foreground mr-1">ريال/شهريًا</span>}
                </div>
                <ul className="space-y-2">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => openAuth('register')}
                  variant={plan.popular ? 'default' : 'outline'}
                  className={`w-full mt-5 h-9 text-xs ${plan.popular ? 'bg-emerald-600 hover:bg-emerald-500' : ''}`}
                >
                  ابدأ الآن
                </Button>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 border-t">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <div className="p-8 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
            <h2 className="text-xl font-bold mb-2">جاهز للبدء؟</h2>
            <p className="text-sm text-muted-foreground mb-5">أنشئ حسابك المجاني واستضف تطبيقك الأول في دقائق.</p>
            <Button onClick={() => openAuth('register')} className="bg-emerald-600 hover:bg-emerald-500 gap-1.5">
              ابدأ مجانًا
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-6 mt-auto">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="Wolf Host" className="h-4 w-4" />
            <span className="text-xs text-muted-foreground">Wolf Host</span>
          </div>
          <p className="text-[11px] text-muted-foreground">© 2025 3MH TECHNOLOGIES</p>
        </div>
      </footer>

      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} defaultTab={authTab} />
    </div>
  )
}
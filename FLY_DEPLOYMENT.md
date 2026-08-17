# دليل تشغيل منصة 3MH Host على Fly.io | Fly.io Deployment Guide

هذا الدليل يوضح كيفية نشر وتشغيل منصة **3MH Host** على خوادم **Fly.io** باستخدام Docker و Persistent Volumes.

---

## 🇸🇦 دليل التشغيل باللغة العربية

### 1. المتطلبات الأساسية
- تثبيت أدوات Fly CLI (`flyctl`).
- حساب مفعل على [Fly.io](https://fly.io).
- تسجيل الدخول في العارض التفاعلي عبر الأمر:
  ```bash
  fly auth login
  ```

---

### 2. إعداد وقرص التخزين الدائم (Persistent Volume)
تعتمد المنصة على قاعدة بيانات SQLite وتخزين التطبيقات والسجلات بشكل دائم. قم بإنشاء قرص تخزين باسم `host_data`:

```bash
fly volumes create host_data --size 3 --region fra
```
*(ملاحظة: يمكنك تغيير المنطقة `fra` إلى المنطقة الأقرب لك مثل `cdg` أو `lhr`)*

---

### 3. ضبط اسم التطبيق (في ملف `fly.toml`)
افتراضياً تم إعداد ملف `fly.toml` في المشروع. يمكنك تغيير اسم التطبيق في السطر الأول:
```toml
app = "your-app-name"
```
أو تشغيل الأمر التفاعلي:
```bash
fly launch --no-deploy
```

---

### 4. تعيين المتغيرات السرية (Secrets)
إذا كنت تستخدم أسرار أو المفاتيح السرية مثل `NEXTAUTH_SECRET`:
```bash
fly secrets set NEXTAUTH_SECRET="your-super-secret-key"
```

---

### 5. نشر التطبيق (Deploy)
قم بنشر التطبيق مباشرة عبر الأمر:
```bash
fly deploy
```

سيقوم Fly.io بـ:
1. بناء الصورة المستهدفة باستخدام `Dockerfile`.
2. تثبيت Bun و Caddy و Python و PHP و SQLite.
3. ربط قرص التخزين الدائم `/data`.
4. تشغيل خادم Next.js، وخادم إدارة العمليات (Process Manager)، وخادم الطرفية (Terminal Service)، وموجه Caddy Reverse Proxy.

---

### 6. الوصول والتحقق
- فتح المنصة في المتصفح:
  ```bash
  fly open
  ```
- متابعة السجلات مباشرة:
  ```bash
  fly logs
  ```

---

## 🇬🇧 English Deployment Guide

### 1. Prerequisites
- [Fly CLI (`flyctl`)](https://fly.io/docs/hands-on/install-flyctl/) installed.
- An active Fly.io account.
- Authenticated session:
  ```bash
  fly auth login
  ```

---

### 2. Create Persistent Volume
The platform requires persistent storage for SQLite DB, tenant apps, and logs:

```bash
fly volumes create host_data --size 3 --region fra
```

---

### 3. Set Application Name
In `fly.toml`, adjust the `app` name field:
```toml
app = "your-app-name"
```

---

### 4. Set Environment Secrets
```bash
fly secrets set NEXTAUTH_SECRET="your-random-secret"
```

---

### 5. Deploy to Fly.io
```bash
fly deploy
```

---

### 6. Manage & Inspect
```bash
# View live logs
fly logs

# Open application URL
fly open
```

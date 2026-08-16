import os
import requests
import json
from pyrogram import Client, filters
from pyrogram.types import InlineKeyboardMarkup, InlineKeyboardButton
from pyrogram.errors import SessionPasswordNeeded, PhoneCodeInvalid, PhoneCodeExpired

API_ID = 34109266
API_HASH = "d254d389904ac811ef142659beaeed59"
BOT_TOKEN = "8726868468:AAEQUCqZmyiOKzS8m8AIPA7aQY_xvCLCi_Q"
OWNER_ID = 6812997550

USER_SESSION = "user_session"
BOT_SESSION = "bot_session"
CHANNELS_FILE = "channels.json"
THUMB_URL = "https://j.top4top.io/p_3879yu7m11.jpg"
SEND_FILE_NAME = "@j49_c"

channels = []
def load_channels():
    global channels
    try:
        with open(CHANNELS_FILE, 'r') as f:
            channels = json.load(f)
    except:
        channels = []

def save_channels():
    with open(CHANNELS_FILE, 'w') as f:
        json.dump(channels, f)

load_channels()

bot = Client(BOT_SESSION, api_id=API_ID, api_hash=API_HASH, bot_token=BOT_TOKEN)
user = Client(USER_SESSION, api_id=API_ID, api_hash=API_HASH)

login_state = {}
user_authorized = False

def main_keyboard():
    buttons = [
        [InlineKeyboardButton("🔐 تسجيل الدخول", callback_data="login")],
        [InlineKeyboardButton("➕ إضافة قناة", callback_data="add_channel")],
        [InlineKeyboardButton("📋 عرض القنوات", callback_data="list_channels")],
    ]
    return InlineKeyboardMarkup(buttons)

@bot.on_message(filters.command("start") & filters.private)
async def start_command(client, message):
    print(f"Received /start from {message.from_user.id}")
    if message.from_user.id != OWNER_ID:
        await message.reply_text("غير مصرح لك باستخدام هذا البوت.")
        return
    await message.reply_text(
        "مرحبًا!\n"
        "سجل دخول بحسابك ثم أضف القنوات.\n"
        "بعد ذلك أرسل أي ملف بايثون هنا وسيتم نشره تلقائيًا بالاسم والصورة المحددين.",
        reply_markup=main_keyboard()
    )

@bot.on_callback_query()
async def handle_callback(client, callback_query):
    print(f"Callback {callback_query.data} from {callback_query.from_user.id}")
    global user_authorized
    if callback_query.from_user.id != OWNER_ID:
        await callback_query.answer("غير مصرح لك", show_alert=True)
        return
    data = callback_query.data
    chat_id = callback_query.message.chat.id

    if data == "login":
        if user_authorized:
            await callback_query.answer("أنت مسجل بالفعل", show_alert=True)
            return
        try:
            if not user.is_connected:
                await user.connect()
            me = await user.get_me()
            user_authorized = True
            await bot.send_message(chat_id, f"تم تسجيل الدخول تلقائيًا كـ {me.first_name}")
        except:
            login_state[chat_id] = {"step": "phone"}
            await bot.send_message(chat_id, "أرسل رقم هاتفك مع رمز الدولة:")

    elif data == "add_channel":
        if not user_authorized:
            await callback_query.answer("يجب تسجيل الدخول أولاً", show_alert=True)
            return
        login_state[chat_id] = {"step": "channel"}
        await bot.send_message(chat_id, "أرسل معرف القناة:")

    elif data == "list_channels":
        if channels:
            text = "القنوات المسجلة:\n" + "\n".join(channels)
        else:
            text = "لا توجد قنوات مسجلة."
        await callback_query.message.reply_text(text)

@bot.on_message(filters.text & filters.private)
async def handle_text(client, message):
    print(f"Text from {message.from_user.id}: {message.text}")
    if message.from_user.id != OWNER_ID:
        return
    chat_id = message.chat.id
    text = message.text.strip()
    state = login_state.get(chat_id)
    if not state:
        return
    step = state.get("step")

    if step == "phone":
        phone = text
        login_state[chat_id]["phone"] = phone
        login_state[chat_id]["step"] = "code"
        try:
            if not user.is_connected:
                await user.connect()
            sent_code = await user.send_code(phone)
            login_state[chat_id]["phone_code_hash"] = sent_code.phone_code_hash
            await message.reply_text("تم إرسال رمز التحقق، أرسل الرمز:")
        except Exception as e:
            await message.reply_text(f"فشل إرسال الرمز: {e}")
            del login_state[chat_id]

    elif step == "code":
        phone = login_state[chat_id]["phone"]
        phone_code_hash = login_state[chat_id]["phone_code_hash"]
        code = text
        try:
            await user.sign_in(phone, phone_code_hash, code)
            user_authorized = True
            await message.reply_text("تم تسجيل الدخول بنجاح!")
            del login_state[chat_id]
        except SessionPasswordNeeded:
            login_state[chat_id]["step"] = "password"
            await message.reply_text("الحساب محمي بكلمة مرور، أرسل كلمة المرور:")
        except PhoneCodeInvalid:
            await message.reply_text("رمز غير صحيح، أعد المحاولة.")
        except PhoneCodeExpired:
            await message.reply_text("انتهت صلاحية الرمز، أعد تسجيل الدخول.")
            del login_state[chat_id]

    elif step == "password":
        password = text
        try:
            await user.check_password(password)
            user_authorized = True
            await message.reply_text("تم تسجيل الدخول بنجاح!")
            del login_state[chat_id]
        except Exception as e:
            await message.reply_text(f"فشل تسجيل الدخول: {e}")
            del login_state[chat_id]

    elif step == "channel":
        channel = text
        if channel not in channels:
            channels.append(channel)
            save_channels()
            await message.reply_text(f"تمت إضافة القناة: {channel}")
        else:
            await message.reply_text("القناة موجودة بالفعل.")
        del login_state[chat_id]

@bot.on_message(filters.document & filters.private)
async def handle_document(client, message):
    print(f"Document from {message.from_user.id}")
    if message.from_user.id != OWNER_ID:
        return
    if not user_authorized:
        await message.reply_text("يجب تسجيل الدخول أولاً.")
        return
    if not channels:
        await message.reply_text("لا توجد قنوات مضافة، أضف قناة أولاً.")
        return

    chat_id = message.chat.id
    await message.reply_text("تم استلام الملف، جاري المعالجة والنشر...")

    file_path = await message.download()
    if not file_path:
        await message.reply_text("فشل تحميل الملف.")
        return

    thumb_path = "thumb.jpg"
    try:
        response = requests.get(THUMB_URL)
        with open(thumb_path, 'wb') as f:
            f.write(response.content)
    except Exception as e:
        await message.reply_text(f"فشل تحميل الصورة المصغرة: {e}")
        if os.path.exists(file_path):
            os.remove(file_path)
        return

    success_count = 0
    for channel in channels:
        try:
            await user.send_document(
                chat_id=channel,
                document=file_path,
                file_name=SEND_FILE_NAME,
                thumb=thumb_path,
                caption="ملف بايثون"
            )
            success_count += 1
        except Exception as e:
            await bot.send_message(chat_id, f"فشل الإرسال إلى {channel}: {e}")

    await bot.send_message(chat_id, f"تم النشر بنجاح إلى {success_count} من {len(channels)} قناة.")

    for path in [file_path, thumb_path]:
        if os.path.exists(path):
            os.remove(path)

print("Starting bot...")
bot.run()
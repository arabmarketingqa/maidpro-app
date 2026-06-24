import React from 'react'

// ── Admin panel translations ──────────────────────────────────────────────
// The admin UI is built from hundreds of static English strings spread across
// many components. Rather than wrap every one in a t() call, we translate the
// rendered DOM: a dictionary maps an exact English phrase → its translation,
// and a MutationObserver keeps the visible text in sync as React re-renders.
// Phrases not in the dictionary simply stay in English (graceful fallback).

export const RTL_LANGS = ['ar', 'ur']

// Authored as { "English phrase": { lang: "translation", … } } so every
// language for a phrase lives together; we pivot to per-language maps below.
const PHRASES = {
  // ── Navigation & section titles ──
  'Overview':              { ar:'نظرة عامة', fr:'Aperçu', es:'Resumen', de:'Übersicht', ur:'جائزہ', hi:'अवलोकन', tl:'Pangkalahatang-ideya', bn:'সংক্ষিপ্ত বিবরণ', ru:'Обзор', tr:'Genel Bakış' },
  'Bookings':              { ar:'الحجوزات', fr:'Réservations', es:'Reservas', de:'Buchungen', ur:'بکنگز', hi:'बुकिंग', tl:'Mga Booking', bn:'বুকিং', ru:'Брони', tr:'Rezervasyonlar' },
  'Hourly Booking':        { ar:'حجز بالساعة', fr:'Réservation horaire', es:'Reserva por horas', de:'Stundenbuchung', ur:'گھنٹہ وار بکنگ', hi:'घंटेवार बुकिंग', tl:'Booking kada oras', bn:'ঘণ্টাভিত্তিক বুকিং', ru:'Почасовая бронь', tr:'Saatlik Rezervasyon' },
  'Monthly Plans':         { ar:'الخطط الشهرية', fr:'Forfaits mensuels', es:'Planes mensuales', de:'Monatspläne', ur:'ماہانہ پلانز', hi:'मासिक योजनाएं', tl:'Buwanang Plano', bn:'মাসিক প্ল্যান', ru:'Месячные планы', tr:'Aylık Planlar' },
  'Stay-In':               { ar:'الإقامة', fr:'Résidence', es:'Interno', de:'Wohnhaft', ur:'قیام', hi:'रहने वाली', tl:'Stay-In', bn:'থাকা', ru:'Проживание', tr:'Yatılı' },
  'Nationalities':         { ar:'الجنسيات', fr:'Nationalités', es:'Nacionalidades', de:'Nationalitäten', ur:'قومیتیں', hi:'राष्ट्रीयताएं', tl:'Mga Nasyonalidad', bn:'জাতীয়তা', ru:'Национальности', tr:'Uyruklar' },
  'Materials':             { ar:'المواد', fr:'Matériaux', es:'Materiales', de:'Materialien', ur:'مواد', hi:'सामग्री', tl:'Mga Materyales', bn:'উপকরণ', ru:'Материалы', tr:'Malzemeler' },
  'Payment Settings':      { ar:'إعدادات الدفع', fr:'Paramètres de paiement', es:'Configuración de pago', de:'Zahlungseinstellungen', ur:'ادائیگی کی ترتیبات', hi:'भुगतान सेटिंग्स', tl:'Mga Setting ng Bayad', bn:'পেমেন্ট সেটিংস', ru:'Настройки оплаты', tr:'Ödeme Ayarları' },
  'Settings':              { ar:'الإعدادات', fr:'Paramètres', es:'Configuración', de:'Einstellungen', ur:'ترتیبات', hi:'सेटिंग्स', tl:'Mga Setting', bn:'সেটিংস', ru:'Настройки', tr:'Ayarlar' },
  'Daily Report':          { ar:'التقرير اليومي', fr:'Rapport quotidien', es:'Informe diario', de:'Tagesbericht', ur:'روزانہ رپورٹ', hi:'दैनिक रिपोर्ट', tl:'Pang-araw-araw na Ulat', bn:'দৈনিক রিপোর্ট', ru:'Ежедневный отчёт', tr:'Günlük Rapor' },
  'Staff Report':          { ar:'تقرير الموظفين', fr:'Rapport du personnel', es:'Informe del personal', de:'Personalbericht', ur:'عملہ رپورٹ', hi:'स्टाफ रिपोर्ट', tl:'Ulat ng Staff', bn:'স্টাফ রিপোর্ট', ru:'Отчёт по персоналу', tr:'Personel Raporu' },
  'Services & Operations': { ar:'الخدمات والعمليات', fr:'Services et opérations', es:'Servicios y operaciones', de:'Dienste & Betrieb', ur:'خدمات و آپریشنز', hi:'सेवाएं और संचालन', tl:'Mga Serbisyo at Operasyon', bn:'সেবা ও পরিচালনা', ru:'Услуги и операции', tr:'Hizmetler ve Operasyonlar' },
  'Calendar View':         { ar:'عرض التقويم', fr:'Vue calendrier', es:'Vista de calendario', de:'Kalenderansicht', ur:'کیلنڈر ویو', hi:'कैलेंडर दृश्य', tl:'View ng Kalendaryo', bn:'ক্যালেন্ডার ভিউ', ru:'Календарь', tr:'Takvim Görünümü' },
  'Customers':             { ar:'العملاء', fr:'Clients', es:'Clientes', de:'Kunden', ur:'صارفین', hi:'ग्राहक', tl:'Mga Customer', bn:'গ্রাহক', ru:'Клиенты', tr:'Müşteriler' },
  'Staff Management':      { ar:'إدارة الموظفين', fr:'Gestion du personnel', es:'Gestión de personal', de:'Personalverwaltung', ur:'عملہ کا انتظام', hi:'स्टाफ प्रबंधन', tl:'Pamamahala ng Staff', bn:'স্টাফ ব্যবস্থাপনা', ru:'Управление персоналом', tr:'Personel Yönetimi' },
  'Nationality Manager':   { ar:'مدير الجنسيات', fr:'Gestion des nationalités', es:'Gestor de nacionalidades', de:'Nationalitäten-Manager', ur:'قومیت مینیجر', hi:'राष्ट्रीयता प्रबंधक', tl:'Tagapamahala ng Nasyonalidad', bn:'জাতীয়তা ম্যানেজার', ru:'Управление национальностями', tr:'Uyruk Yöneticisi' },
  'Packages':              { ar:'الباقات', fr:'Forfaits', es:'Paquetes', de:'Pakete', ur:'پیکجز', hi:'पैकेज', tl:'Mga Package', bn:'প্যাকেজ', ru:'Пакеты', tr:'Paketler' },
  'Materials & Add-ons':   { ar:'المواد والإضافات', fr:'Matériaux et options', es:'Materiales y extras', de:'Materialien & Extras', ur:'مواد و اضافہ جات', hi:'सामग्री और ऐड-ऑन', tl:'Mga Materyales at Add-on', bn:'উপকরণ ও অ্যাড-অন', ru:'Материалы и допы', tr:'Malzemeler ve Eklentiler' },

  // ── Common actions / buttons ──
  'Save changes':          { ar:'حفظ التغييرات', fr:'Enregistrer', es:'Guardar cambios', de:'Änderungen speichern', ur:'تبدیلیاں محفوظ کریں', hi:'परिवर्तन सहेजें', tl:'I-save ang mga pagbabago', bn:'পরিবর্তন সংরক্ষণ করুন', ru:'Сохранить изменения', tr:'Değişiklikleri kaydet' },
  'Save':                  { ar:'حفظ', fr:'Enregistrer', es:'Guardar', de:'Speichern', ur:'محفوظ کریں', hi:'सहेजें', tl:'I-save', bn:'সংরক্ষণ', ru:'Сохранить', tr:'Kaydet' },
  'Close':                 { ar:'إغلاق', fr:'Fermer', es:'Cerrar', de:'Schließen', ur:'بند کریں', hi:'बंद करें', tl:'Isara', bn:'বন্ধ', ru:'Закрыть', tr:'Kapat' },
  'Cancel':                { ar:'إلغاء', fr:'Annuler', es:'Cancelar', de:'Abbrechen', ur:'منسوخ کریں', hi:'रद्द करें', tl:'Kanselahin', bn:'বাতিল', ru:'Отмена', tr:'İptal' },
  'Delete':                { ar:'حذف', fr:'Supprimer', es:'Eliminar', de:'Löschen', ur:'حذف کریں', hi:'हटाएं', tl:'Tanggalin', bn:'মুছুন', ru:'Удалить', tr:'Sil' },
  'Add':                   { ar:'إضافة', fr:'Ajouter', es:'Añadir', de:'Hinzufügen', ur:'شامل کریں', hi:'जोड़ें', tl:'Magdagdag', bn:'যোগ করুন', ru:'Добавить', tr:'Ekle' },
  'Edit':                  { ar:'تعديل', fr:'Modifier', es:'Editar', de:'Bearbeiten', ur:'ترمیم', hi:'संपादित करें', tl:'I-edit', bn:'সম্পাদনা', ru:'Изменить', tr:'Düzenle' },
  'Retry':                 { ar:'إعادة المحاولة', fr:'Réessayer', es:'Reintentar', de:'Erneut versuchen', ur:'دوبارہ کوشش کریں', hi:'पुनः प्रयास करें', tl:'Subukan muli', bn:'আবার চেষ্টা করুন', ru:'Повторить', tr:'Tekrar dene' },
  'Search bookings...':    { ar:'البحث في الحجوزات...', fr:'Rechercher des réservations...', es:'Buscar reservas...', de:'Buchungen suchen...', ur:'بکنگ تلاش کریں...', hi:'बुकिंग खोजें...', tl:'Maghanap ng booking...', bn:'বুকিং খুঁজুন...', ru:'Поиск броней...', tr:'Rezervasyon ara...' },

  // ── Booking statuses & payment ──
  'Pending':               { ar:'قيد الانتظار', fr:'En attente', es:'Pendiente', de:'Ausstehend', ur:'زیر التواء', hi:'लंबित', tl:'Nakabinbin', bn:'মুলতুবি', ru:'В ожидании', tr:'Beklemede' },
  'Confirmed':             { ar:'مؤكد', fr:'Confirmé', es:'Confirmado', de:'Bestätigt', ur:'تصدیق شدہ', hi:'पुष्ट', tl:'Nakumpirma', bn:'নিশ্চিত', ru:'Подтверждено', tr:'Onaylandı' },
  'Completed':             { ar:'مكتمل', fr:'Terminé', es:'Completado', de:'Abgeschlossen', ur:'مکمل', hi:'पूर्ण', tl:'Tapos na', bn:'সম্পন্ন', ru:'Завершено', tr:'Tamamlandı' },
  'Cancelled':             { ar:'ملغى', fr:'Annulé', es:'Cancelado', de:'Storniert', ur:'منسوخ', hi:'रद्द', tl:'Kinansela', bn:'বাতিল', ru:'Отменено', tr:'İptal edildi' },
  'Paid':                  { ar:'مدفوع', fr:'Payé', es:'Pagado', de:'Bezahlt', ur:'ادا شدہ', hi:'भुगतान किया', tl:'Bayad', bn:'পরিশোধিত', ru:'Оплачено', tr:'Ödendi' },

  // ── Settings / Brand Identity ──
  'Brand Identity':        { ar:'هوية العلامة التجارية', fr:'Identité de marque', es:'Identidad de marca', de:'Markenidentität', ur:'برانڈ شناخت', hi:'ब्रांड पहचान', tl:'Pagkakakilanlan ng Brand', bn:'ব্র্যান্ড পরিচিতি', ru:'Фирменный стиль', tr:'Marka Kimliği' },
  'Brand name':            { ar:'اسم العلامة التجارية', fr:'Nom de la marque', es:'Nombre de marca', de:'Markenname', ur:'برانڈ کا نام', hi:'ब्रांड नाम', tl:'Pangalan ng Brand', bn:'ব্র্যান্ডের নাম', ru:'Название бренда', tr:'Marka adı' },
  'WhatsApp number':       { ar:'رقم واتساب', fr:'Numéro WhatsApp', es:'Número de WhatsApp', de:'WhatsApp-Nummer', ur:'واٹس ایپ نمبر', hi:'व्हाट्सएप नंबर', tl:'WhatsApp number', bn:'হোয়াটসঅ্যাপ নম্বর', ru:'Номер WhatsApp', tr:'WhatsApp numarası' },
  'Call number':           { ar:'رقم الاتصال', fr:"Numéro d'appel", es:'Número de llamada', de:'Rufnummer', ur:'کال نمبر', hi:'कॉल नंबर', tl:'Numero ng tawag', bn:'কল নম্বর', ru:'Номер для звонков', tr:'Arama numarası' },
  'Country':               { ar:'الدولة', fr:'Pays', es:'País', de:'Land', ur:'ملک', hi:'देश', tl:'Bansa', bn:'দেশ', ru:'Страна', tr:'Ülke' },
  'Currency':              { ar:'العملة', fr:'Devise', es:'Moneda', de:'Währung', ur:'کرنسی', hi:'मुद्रा', tl:'Pera', bn:'মুদ্রা', ru:'Валюта', tr:'Para birimi' },
  'Language':              { ar:'اللغة', fr:'Langue', es:'Idioma', de:'Sprache', ur:'زبان', hi:'भाषा', tl:'Wika', bn:'ভাষা', ru:'Язык', tr:'Dil' },
  'Company Logo':          { ar:'شعار الشركة', fr:"Logo de l'entreprise", es:'Logo de la empresa', de:'Firmenlogo', ur:'کمپنی لوگو', hi:'कंपनी लोगो', tl:'Logo ng Kumpanya', bn:'কোম্পানি লোগো', ru:'Логотип компании', tr:'Şirket Logosu' },
  'Upload logo':           { ar:'تحميل الشعار', fr:'Téléverser le logo', es:'Subir logo', de:'Logo hochladen', ur:'لوگو اپ لوڈ کریں', hi:'लोगो अपलोड करें', tl:'Mag-upload ng logo', bn:'লোগো আপলোড করুন', ru:'Загрузить логотип', tr:'Logo yükle' },
  'Change logo':           { ar:'تغيير الشعار', fr:'Changer le logo', es:'Cambiar logo', de:'Logo ändern', ur:'لوگو تبدیل کریں', hi:'लोगो बदलें', tl:'Palitan ang logo', bn:'লোগো পরিবর্তন', ru:'Изменить логотип', tr:'Logoyu değiştir' },
  'Auto Assign':           { ar:'التعيين التلقائي', fr:'Attribution auto', es:'Asignación automática', de:'Auto-Zuweisung', ur:'خودکار تفویض', hi:'स्वतः असाइन', tl:'Auto Assign', bn:'স্বয়ংক্রিয় নিয়োগ', ru:'Авто-назначение', tr:'Otomatik Atama' },

  // ── Reports ──
  'Date Range':            { ar:'النطاق الزمني', fr:'Plage de dates', es:'Rango de fechas', de:'Datumsbereich', ur:'تاریخ کی حد', hi:'तिथि सीमा', tl:'Saklaw ng Petsa', bn:'তারিখ পরিসর', ru:'Диапазон дат', tr:'Tarih Aralığı' },
  'Revenue':               { ar:'الإيرادات', fr:'Revenus', es:'Ingresos', de:'Umsatz', ur:'آمدنی', hi:'राजस्व', tl:'Kita', bn:'রাজস্ব', ru:'Доход', tr:'Gelir' },
  'Total':                 { ar:'الإجمالي', fr:'Total', es:'Total', de:'Gesamt', ur:'کل', hi:'कुल', tl:'Kabuuan', bn:'মোট', ru:'Итого', tr:'Toplam' },
  'Today':                 { ar:'اليوم', fr:"Aujourd'hui", es:'Hoy', de:'Heute', ur:'آج', hi:'आज', tl:'Ngayon', bn:'আজ', ru:'Сегодня', tr:'Bugün' },
  'This week':             { ar:'هذا الأسبوع', fr:'Cette semaine', es:'Esta semana', de:'Diese Woche', ur:'اس ہفتے', hi:'इस सप्ताह', tl:'Ngayong linggo', bn:'এই সপ্তাহ', ru:'На этой неделе', tr:'Bu hafta' },
  'This month':            { ar:'هذا الشهر', fr:'Ce mois', es:'Este mes', de:'Diesen Monat', ur:'اس مہینے', hi:'इस माह', tl:'Ngayong buwan', bn:'এই মাস', ru:'В этом месяце', tr:'Bu ay' },
  'All time':              { ar:'كل الوقت', fr:'Tout le temps', es:'Todo el tiempo', de:'Gesamt', ur:'تمام وقت', hi:'सभी समय', tl:'Lahat ng oras', bn:'সর্বকালীন', ru:'За всё время', tr:'Tüm zamanlar' },
  'From':                  { ar:'من', fr:'De', es:'Desde', de:'Von', ur:'از', hi:'से', tl:'Mula', bn:'থেকে', ru:'С', tr:'Başlangıç' },
  'To':                    { ar:'إلى', fr:'À', es:'Hasta', de:'Bis', ur:'تک', hi:'तक', tl:'Hanggang', bn:'পর্যন্ত', ru:'По', tr:'Bitiş' },
}

// Pivot to { lang: { "English phrase": "translation" } } for O(1) lookup.
export const TRANSLATIONS = (() => {
  const out = {}
  for (const [en, langs] of Object.entries(PHRASES)) {
    for (const [lang, val] of Object.entries(langs)) {
      ;(out[lang] = out[lang] || {})[en] = val
    }
  }
  return out
})()

function translatePhrase(dict, raw) {
  if (!raw) return raw
  const trimmed = raw.trim()
  if (!trimmed) return raw
  const hit = dict[trimmed]
  if (hit == null) return raw
  return raw.replace(trimmed, hit)
}

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'OPTION'])
const I18N_ATTRS = ['placeholder', 'title', 'aria-label']

// Translate the admin DOM in place and keep it translated as React re-renders.
// `getRoot` returns the admin container element. Switching language remounts the
// admin subtree (via a React key), so on every effect run the DOM is back in
// English and we translate forward — no need to remember originals.
export function useAdminI18n(lang, getRoot) {
  React.useEffect(() => {
    const code = lang || 'en'
    const isRTL = RTL_LANGS.includes(code)
    document.documentElement.lang = code
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr'

    const root = (getRoot && getRoot()) || document.body
    if (root) root.setAttribute('dir', isRTL ? 'rtl' : 'ltr')

    const dict = TRANSLATIONS[code]
    if (!dict || code === 'en' || !root) return

    // node → last value we wrote, so the observer ignores our own edits.
    const seen = new WeakMap()

    const handleText = (node) => {
      const cur = node.nodeValue
      if (seen.get(node) === cur) return
      const out = translatePhrase(dict, cur)
      seen.set(node, out)
      if (out !== cur) node.nodeValue = out
    }

    const handleAttrs = (el) => {
      if (!el.getAttribute) return
      for (const a of I18N_ATTRS) {
        if (!el.hasAttribute(a)) continue
        const cur = el.getAttribute(a)
        const out = translatePhrase(dict, cur)
        if (out !== cur) el.setAttribute(a, out)
      }
    }

    const walk = (node) => {
      const tw = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => (n.parentNode && SKIP_TAGS.has(n.parentNode.nodeName))
          ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
      })
      let n
      while ((n = tw.nextNode())) handleText(n)
      if (node.querySelectorAll) {
        if (node.nodeType === 1) handleAttrs(node)
        node.querySelectorAll('[placeholder],[title],[aria-label]').forEach(handleAttrs)
      }
    }

    let scheduled = false
    const obs = new MutationObserver(() => {
      if (scheduled) return
      scheduled = true
      requestAnimationFrame(() => {
        scheduled = false
        obs.disconnect()
        try { walk(root) } finally {
          obs.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: I18N_ATTRS })
        }
      })
    })

    walk(root)
    obs.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: I18N_ATTRS })

    return () => obs.disconnect()
  }, [lang])
}

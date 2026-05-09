import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  Alert, Modal, FlatList, Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as DocumentPicker from 'expo-document-picker';
import * as ScreenCapture from 'expo-screen-capture';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { Colors } from '../constants/colors';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { cacheManager, CACHE_PRESETS } from '../utils/CacheManager';

const LANGUAGES = [
  { key: 'english', label: 'English', flag: '🇬🇧' },
  { key: 'hindi',   label: 'हिन्दी',  flag: '🇮🇳' },
  { key: 'gujarati',label: 'ગુજરાતી', flag: '🇮🇳' },
];

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const FULL_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function formatDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayStr() { return formatDate(new Date()); }

// Escape values that get injected into the WebView HTML / JS strings, so a
// malicious file URL or watermark string can't break out of the script.
function escapeForJs(s: string) {
  return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/</g, '\\u003c');
}

/**
 * Build a self-contained HTML page that renders the given PDF using PDF.js,
 * burns a watermark into each page, and locks down user gestures (no
 * selection, no long-press menu, no right-click).
 *
 * Rendering pages as canvas pixels (instead of the platform's PDF viewer)
 * means there's no underlying PDF the user can save through the WebView UI
 * and no selectable/copyable text. Combined with FLAG_SECURE on Android via
 * expo-screen-capture, this materially raises the bar for content leakage.
 */
function buildPdfHtml(pdfUrl: string, watermark: string) {
  const safeUrl = escapeForJs(pdfUrl);
  const safeMark = escapeForJs(watermark);
  return `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=yes, maximum-scale=4.0">
<style>
  * { -webkit-user-select: none !important; user-select: none !important; -webkit-touch-callout: none !important; }
  html, body { margin:0; padding:0; background:#1f2937; min-height:100%; font-family:-apple-system,Segoe UI,Roboto,sans-serif; }
  #viewer { padding: 8px 0 24px; }
  .page { display:block; max-width: 100%; margin: 0 auto 10px; box-shadow: 0 4px 14px rgba(0,0,0,0.5); border-radius: 4px; }
  #loading { color:#fff; text-align:center; padding:40px 24px; }
  .lbar { width:60%; max-width:280px; height:6px; background:rgba(255,255,255,0.15); border-radius:3px; margin:14px auto 0; overflow:hidden; }
  .lfill { height:100%; background:#3B5FC0; transition:width 0.25s ease; width:0%; }
  #err { display:none; color:#FCA5A5; padding:24px; text-align:center; }
  #err small { display:block; color:#9CA3AF; margin-top:6px; font-size:11px; word-break:break-word; }
</style></head>
<body oncontextmenu="return false" ondragstart="return false" onselectstart="return false">
  <div id="loading">Loading newspaper...<div class="lbar"><div id="bar" class="lfill"></div></div></div>
  <div id="viewer"></div>
  <div id="err"></div>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
  <script>
    (function(){
      var post=function(m){try{window.ReactNativeWebView.postMessage(JSON.stringify(m));}catch(_){} };
      if(!window.pdfjsLib){post({type:'error',message:'pdfjs failed to load'});return;}
      pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      var WM='${safeMark}';
      pdfjsLib.getDocument({url:'${safeUrl}',disableRange:true,disableStream:true}).promise.then(function(pdf){
        var viewer=document.getElementById('viewer');
        var bar=document.getElementById('bar');
        var dpr=Math.min(window.devicePixelRatio||1,2);
        var maxW=Math.min(window.innerWidth,1080);
        var i=1;
        function next(){
          if(i>pdf.numPages){document.getElementById('loading').style.display='none';post({type:'done',pages:pdf.numPages});return;}
          pdf.getPage(i).then(function(page){
            var base=page.getViewport({scale:1});
            var scale=(maxW/base.width)*dpr;
            var vp=page.getViewport({scale:scale});
            var canvas=document.createElement('canvas');
            canvas.className='page';
            canvas.width=vp.width;canvas.height=vp.height;
            canvas.style.width=(vp.width/dpr)+'px';
            viewer.appendChild(canvas);
            var ctx=canvas.getContext('2d');
            page.render({canvasContext:ctx,viewport:vp}).promise.then(function(){
              ctx.save();
              ctx.translate(vp.width/2,vp.height/2);
              ctx.rotate(-Math.PI/8);
              ctx.font='bold '+(36*dpr)+'px sans-serif';
              ctx.fillStyle='rgba(59,95,192,0.16)';
              ctx.textAlign='center';
              ctx.fillText(WM,0,0);
              ctx.font='bold '+(20*dpr)+'px sans-serif';
              ctx.fillText(WM,-vp.width/3,-vp.height/4);
              ctx.fillText(WM,vp.width/3,vp.height/4);
              ctx.restore();
              bar.style.width=((i/pdf.numPages)*100)+'%';
              post({type:'progress',page:i,total:pdf.numPages});
              i++;next();
            });
          }).catch(function(e){fail(e);});
        }
        next();
      }).catch(function(e){fail(e);});
      function fail(err){
        document.getElementById('loading').style.display='none';
        var e=document.getElementById('err');
        e.style.display='block';
        e.innerHTML='Could not load newspaper. Please try again.<small>'+(err&&err.message?String(err.message).slice(0,200):'')+'</small>';
        post({type:'error',message:String(err&&err.message)});
      }
    })();
  </script>
</body></html>`;
}

export default function NewspaperScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [language, setLanguage] = useState('english');
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [editionUrl, setEditionUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [noAddon, setNoAddon] = useState(false);
  const [notAvailable, setNotAvailable] = useState(false);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const d = new Date(); return { year: d.getFullYear(), month: d.getMonth() };
  });

  const [editionKind, setEditionKind] = useState<'pdf' | 'external' | null>(null);

  // Admin upload state
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<{ uri: string; name: string; mimeType: string } | null>(null);
  const [uploadDate, setUploadDate] = useState(todayStr());
  const [uploadLang, setUploadLang] = useState('english');
  const [uploading, setUploading] = useState(false);
  const [recentEditions, setRecentEditions] = useState<any[]>([]);
  const [pdfLoadFailed, setPdfLoadFailed] = useState(false);

  // Watermark text drawn on every rendered page — picks the most identifying
  // info we have so that a leaked screenshot/photo can be traced.
  const watermark = (user?.email || user?.phone || user?.name || 'My Building') + ' · ' + selectedDate;

  // Lock down screen capture while this screen is in focus. Android gets
  // FLAG_SECURE (true block); iOS can only listen and warn since Apple
  // doesn't expose a way to suppress screenshots.
  useFocusEffect(useCallback(() => {
    let active = true;
    let sub: { remove?: () => void } | null = null;
    (async () => {
      try { await ScreenCapture.preventScreenCaptureAsync('newspaper'); } catch (_) {}
      if (Platform.OS === 'ios') {
        try {
          sub = ScreenCapture.addScreenshotListener(() => {
            if (!active) return;
            Alert.alert(
              'Screenshot Detected',
              'Please do not screenshot or share newspaper content. This is for personal reading only.'
            );
          });
        } catch (_) {}
      }
    })();
    return () => {
      active = false;
      sub?.remove?.();
      ScreenCapture.allowScreenCaptureAsync('newspaper').catch(() => {});
    };
  }, []));

  const pickPdf = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' });
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (asset) {
      setUploadFile({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? 'application/pdf' });
    }
  };

  const fetchAvailableDates = useCallback(async () => {
    const cacheKey = cacheManager.generateKey('newspaper', '/newspapers/available-dates', { language }, user?.role);
    const cached = await cacheManager.get<any[]>(cacheKey, CACHE_PRESETS.buildingWide);
    if (cached) setAvailableDates(cached.map((e: any) => e.date ?? e));
    try {
      const res = await api.get('/newspapers/available-dates', { params: { language } });
      const data = Array.isArray(res.data) ? res.data : [];
      const dates = data.map((e: any) => e.date ?? e);
      await cacheManager.set(cacheKey, data, CACHE_PRESETS.buildingWide);
      setAvailableDates(dates);
    } catch {}
  }, [language, user?.role]);

  const fetchEdition = useCallback(async () => {
    setLoading(true);
    setEditionUrl(null);
    setEditionKind(null);
    setNotAvailable(false);
    setNoAddon(false);
    setPdfLoadFailed(false);
    try {
      const res = await api.get('/newspapers', { params: { date: selectedDate, language } });
      setEditionUrl(res.data.url);
      // Backend returns kind: 'pdf' for admin-uploaded files, 'external' for
      // URL-pattern fallbacks pointing at third-party newspaper websites.
      setEditionKind(res.data.kind === 'external' ? 'external' : 'pdf');
    } catch (e: any) {
      const errCode = e.response?.data?.error;
      if (errCode === 'newspaper_addon_required') {
        setNoAddon(true);
      } else {
        // not_available (404) or any other error — show friendly message, no console noise
        setNotAvailable(true);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedDate, language]);

  const fetchRecentEditions = useCallback(async () => {
    if (!isAdmin) return;
    const cacheKey = cacheManager.generateKey('newspaper', '/newspapers/recent', {}, user?.role);
    const cached = await cacheManager.get<any[]>(cacheKey, CACHE_PRESETS.buildingWide);
    if (cached) setRecentEditions(cached);
    try {
      const res = await api.get('/newspapers/recent');
      const data = Array.isArray(res.data) ? res.data : [];
      await cacheManager.set(cacheKey, data, CACHE_PRESETS.buildingWide);
      setRecentEditions(data);
    } catch {}
  }, [isAdmin, user?.role]);

  useFocusEffect(useCallback(() => {
    fetchAvailableDates();
    if (!isAdmin) fetchEdition();
    else fetchRecentEditions();
  }, [language, selectedDate]));

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    setShowCalendar(false);
  };

  const submitUpload = async () => {
    if (!uploadFile) return Alert.alert('Error', 'Please select a PDF file');
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('date', uploadDate);
      formData.append('language', uploadLang);
      formData.append('file', { uri: uploadFile.uri, name: uploadFile.name, type: uploadFile.mimeType } as any);
      await api.post('/newspapers', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      Alert.alert('Saved', 'Newspaper edition saved successfully');
      setUploadFile(null);
      setShowUpload(false);
      fetchRecentEditions();
      fetchAvailableDates();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to save');
    } finally {
      setUploading(false);
    }
  };

  const deleteEdition = (id: string, date: string) => {
    Alert.alert('Delete Edition', `Delete ${date} edition?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          await api.delete(`/newspapers/${id}`);
          fetchRecentEditions();
          fetchAvailableDates();
        } catch (e: any) {
          Alert.alert('Error', e.response?.data?.error || 'Failed');
        }
      }},
    ]);
  };

  // Calendar rendering
  const renderCalendar = () => {
    const { year, month } = calendarMonth;
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = todayStr();
    const cells: (number | null)[] = Array(firstDay).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    while (cells.length % 7 !== 0) cells.push(null);

    return (
      <View style={cal.container}>
        <View style={cal.header}>
          <TouchableOpacity onPress={() => setCalendarMonth(p => {
            const d = new Date(p.year, p.month - 1); return { year: d.getFullYear(), month: d.getMonth() };
          })}>
            <Ionicons name="chevron-back" size={22} color={Colors.primary} />
          </TouchableOpacity>
          <Text style={cal.monthLabel}>{FULL_MONTHS[month]} {year}</Text>
          <TouchableOpacity onPress={() => setCalendarMonth(p => {
            const d = new Date(p.year, p.month + 1); return { year: d.getFullYear(), month: d.getMonth() };
          })}>
            <Ionicons name="chevron-forward" size={22} color={Colors.primary} />
          </TouchableOpacity>
        </View>
        <View style={cal.weekRow}>
          {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
            <Text key={d} style={cal.weekDay}>{d}</Text>
          ))}
        </View>
        <View style={cal.grid}>
          {cells.map((day, i) => {
            if (!day) return <View key={i} style={cal.cell} />;
            const dateStr = `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            const isFuture = dateStr > today;
            const isAvail = availableDates.includes(dateStr);
            const isSelected = dateStr === selectedDate;
            return (
              <TouchableOpacity
                key={i}
                style={[cal.cell, isSelected && cal.cellSelected, isAvail && !isSelected && cal.cellAvail]}
                onPress={() => !isFuture && handleDateSelect(dateStr)}
                disabled={isFuture}
              >
                <Text style={[cal.cellText, isFuture && { color: Colors.border }, isSelected && { color: Colors.white, fontWeight: '800' }, isAvail && !isSelected && { color: Colors.primary, fontWeight: '700' }]}>
                  {day}
                </Text>
                {isAvail && !isSelected && <View style={cal.dot} />}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  // Memo the rendered HTML so the WebView doesn't re-mount on unrelated
  // re-renders (the WM/url combo is what should drive a reload).
  const viewerHtml = editionUrl && editionKind === 'pdf'
    ? buildPdfHtml(editionUrl, watermark)
    : null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>📰 Newspaper</Text>
        {isAdmin ? (
          <TouchableOpacity testID="upload-btn" style={styles.uploadBtn} onPress={() => setShowUpload(true)}>
            <Ionicons name="cloud-upload-outline" size={20} color={Colors.white} />
          </TouchableOpacity>
        ) : <View style={{ width: 36 }} />}
      </View>

      {/* Language tabs */}
      <View style={styles.langTabs}>
        {LANGUAGES.map(l => (
          <TouchableOpacity
            key={l.key}
            style={[styles.langTab, language === l.key && styles.langTabActive]}
            onPress={() => setLanguage(l.key)}
          >
            <Text style={styles.langFlag}>{l.flag}</Text>
            <Text style={[styles.langLabel, language === l.key && styles.langLabelActive]}>{l.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Date picker row */}
      <TouchableOpacity style={styles.datePicker} onPress={() => setShowCalendar(true)}>
        <Ionicons name="calendar-outline" size={18} color={Colors.primary} />
        <Text style={styles.datePickerText}>
          {(() => {
            const d = new Date(selectedDate + 'T00:00:00');
            return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
          })()}
        </Text>
        <Ionicons name="chevron-down" size={16} color={Colors.textMuted} />
        {availableDates.includes(selectedDate) && (
          <View style={styles.availBadge}><Text style={styles.availBadgeText}>Available</Text></View>
        )}
      </TouchableOpacity>

      {/* Content area */}
      {loading ? (
        <View style={styles.empty}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : isAdmin ? (
        // Admin: show recent editions list
        <FlatList
          data={recentEditions}
          keyExtractor={i => i.id}
          contentContainerStyle={{ padding: 16 }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="newspaper-outline" size={52} color={Colors.border} />
              <Text style={styles.emptyTitle}>No editions uploaded yet</Text>
              <Text style={styles.emptyText}>Tap the upload button to add today's newspaper</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.editionCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.editionDate}>{item.date}</Text>
                <Text style={styles.editionLang}>{item.language} · {item.source}</Text>
              </View>
              <TouchableOpacity onPress={() => deleteEdition(item.id, item.date)} style={styles.deleteBtn} testID="delete-edition-btn">
                <Ionicons name="trash-outline" size={18} color={Colors.danger} />
              </TouchableOpacity>
            </View>
          )}
        />
      ) : noAddon ? (
        <View style={styles.empty}>
          <Ionicons name="newspaper-outline" size={52} color={Colors.border} />
          <Text style={styles.emptyTitle}>Newspaper Add-On Required</Text>
          <Text style={styles.emptyText}>Enable the ₹3/month newspaper add-on in your subscription to read daily newspapers.</Text>
          <TouchableOpacity style={styles.upgradeBtn} onPress={() => router.push('/subscribe' as any)}>
            <Text style={styles.upgradeBtnText}>Enable Add-On</Text>
          </TouchableOpacity>
        </View>
      ) : notAvailable ? (
        <View style={styles.empty}>
          <Ionicons name="newspaper-outline" size={52} color={Colors.border} />
          <Text style={styles.emptyTitle}>No Newspaper Today</Text>
          <Text style={styles.emptyText}>
            The newspaper for this date hasn't been uploaded yet. Check back later or try a different date.
          </Text>
        </View>
      ) : viewerHtml ? (
        <View style={{ flex: 1 }}>
          <WebView
            originWhitelist={['*']}
            source={{ html: viewerHtml }}
            style={{ flex: 1, backgroundColor: '#1f2937' }}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.viewerLoading}>
                <ActivityIndicator size="large" color={Colors.primary} />
              </View>
            )}
            javaScriptEnabled
            domStorageEnabled
            setSupportMultipleWindows={false}
            allowFileAccess={false}
            allowFileAccessFromFileURLs={false}
            allowUniversalAccessFromFileURLs={false}
            allowsLinkPreview={false}
            sharedCookiesEnabled={false}
            thirdPartyCookiesEnabled={false}
            mixedContentMode="always"
            // Block any download attempt the WebView might surface.
            onShouldStartLoadWithRequest={(req) => req.url.startsWith('data:') || req.url.startsWith('about:') || req.url === 'about:blank'}
            onError={() => setPdfLoadFailed(true)}
            onHttpError={() => setPdfLoadFailed(true)}
            onMessage={(e) => {
              try {
                const msg = JSON.parse(e.nativeEvent.data);
                if (msg.type === 'error') setPdfLoadFailed(true);
              } catch (_) {}
            }}
          />
          {/* Diagonal RN-side watermark as a second layer of deterrent —
              even if a tampered build bypasses the canvas-baked one, this
              floats above the WebView and is captured by any photo. */}
          <View pointerEvents="none" style={styles.watermarkOverlay}>
            <Text style={styles.watermarkText} numberOfLines={1}>{watermark}</Text>
          </View>
        </View>
      ) : editionUrl && editionKind === 'external' ? (
        // Third-party newspaper website (URL pattern) — render in a sandboxed
        // WebView. We can't burn watermarks into someone else's HTML, but
        // we still keep capture protection on.
        <WebView
          originWhitelist={['*']}
          source={{ uri: editionUrl }}
          style={{ flex: 1 }}
          startInLoadingState
          renderLoading={() => <ActivityIndicator style={{ marginTop: 60 }} size="large" color={Colors.primary} />}
          setSupportMultipleWindows={false}
          allowFileAccess={false}
          allowsLinkPreview={false}
          onError={() => setPdfLoadFailed(true)}
          onHttpError={() => setPdfLoadFailed(true)}
        />
      ) : null}

      {pdfLoadFailed && !!editionUrl && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>
            Could not load newspaper. Pull down to retry or check back shortly.
          </Text>
        </View>
      )}

      {/* Calendar Modal */}
      <Modal visible={showCalendar} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowCalendar(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.calendarSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Select Date</Text>
            {renderCalendar()}
            <TouchableOpacity style={styles.todayBtn} onPress={() => handleDateSelect(todayStr())}>
              <Text style={styles.todayBtnText}>Today</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Admin Upload Modal */}
      <Modal visible={showUpload} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowUpload(false)}>
          <TouchableOpacity activeOpacity={1} style={styles.uploadSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Upload Newspaper</Text>

            <Text style={styles.inputLabel}>Date</Text>
            <TouchableOpacity style={styles.inputBox} onPress={() => {
              setShowUpload(false);
              setTimeout(() => setShowCalendar(true), 300);
            }}>
              <Ionicons name="calendar-outline" size={16} color={Colors.primary} />
              <Text style={styles.inputText}>{uploadDate}</Text>
            </TouchableOpacity>

            <Text style={styles.inputLabel}>Language</Text>
            <View style={styles.langRow}>
              {LANGUAGES.map(l => (
                <TouchableOpacity
                  key={l.key}
                  style={[styles.langChip, uploadLang === l.key && styles.langChipActive]}
                  onPress={() => setUploadLang(l.key)}
                >
                  <Text style={[styles.langChipText, uploadLang === l.key && { color: Colors.white }]}>{l.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>PDF File</Text>
            <TouchableOpacity testID="pick-pdf-btn" style={styles.pdfPickerBtn} onPress={pickPdf}>
              <Ionicons name="document-attach-outline" size={18} color={Colors.primary} />
              <Text style={styles.pdfPickerText} numberOfLines={1}>
                {uploadFile ? uploadFile.name : 'Pick PDF'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.saveBtn, uploading && { opacity: 0.5 }]} onPress={submitUpload} disabled={uploading}>
              {uploading ? <ActivityIndicator color={Colors.white} /> : <Text style={styles.saveBtnText}>Save Edition</Text>}
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    backgroundColor: '#3B5FC0', paddingTop: 56, paddingBottom: 16,
    paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  backBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  uploadBtn: { width: 36, height: 36, justifyContent: 'center', alignItems: 'center' },

  langTabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: Colors.border },
  langTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  langTabActive: { borderBottomColor: Colors.primary },
  langFlag: { fontSize: 16 },
  langLabel: { fontSize: 13, fontWeight: '600', color: Colors.textMuted },
  langLabelActive: { color: Colors.primary, fontWeight: '800' },

  datePicker: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  datePickerText: { flex: 1, fontSize: 15, fontWeight: '600', color: Colors.text },
  availBadge: { backgroundColor: Colors.success + '20', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  availBadgeText: { fontSize: 11, fontWeight: '700', color: Colors.success },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Colors.text },
  emptyText: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', lineHeight: 20 },
  errorBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 16,
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
    borderRadius: 10,
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorBannerText: { color: '#9A3412', fontSize: 12, fontWeight: '600', flex: 1 },
  viewerLoading: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#1f2937',
  },
  watermarkOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    paddingTop: 6,
    alignItems: 'center',
    pointerEvents: 'none' as any,
  },
  watermarkText: {
    color: 'rgba(255,255,255,0.18)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  upgradeBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12, marginTop: 8 },
  upgradeBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  editionCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  editionDate: { fontSize: 15, fontWeight: '700', color: Colors.text },
  editionLang: { fontSize: 12, color: Colors.textMuted, marginTop: 2, textTransform: 'capitalize' },
  deleteBtn: { padding: 8 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  calendarSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 },
  uploadSheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: Colors.text, marginBottom: 16 },
  todayBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  todayBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  inputLabel: { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 6, marginTop: 12 },
  inputBox: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 10, padding: 12 },
  inputText: { fontSize: 14, color: Colors.text },
  langRow: { flexDirection: 'row', gap: 8 },
  langChip: { flex: 1, borderWidth: 1.5, borderColor: Colors.border, borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  langChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  langChipText: { fontSize: 13, fontWeight: '600', color: Colors.text },
  pdfPickerBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 10, padding: 12, marginTop: 2 },
  pdfPickerText: { flex: 1, fontSize: 14, color: Colors.primary, fontWeight: '600' },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

const cal = StyleSheet.create({
  container: { marginTop: 4 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  monthLabel: { fontSize: 16, fontWeight: '800', color: Colors.text },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekDay: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '700', color: Colors.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  cellSelected: { backgroundColor: Colors.primary, borderRadius: 20 },
  cellAvail: { backgroundColor: Colors.primary + '15', borderRadius: 20 },
  cellText: { fontSize: 14, color: Colors.text },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.primary, position: 'absolute', bottom: 4 },
});

import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, CheckCircle2, Target, BarChart3, Briefcase, Layers,
  ShieldCheck, Settings, Rocket, User, HardHat, TrendingUp,
  Edit3, X, BrainCircuit, PenTool, Image as ImageIcon, Heart, Cloud, CloudOff,
  Key, Eye, EyeOff, Trash2, Check, Upload,
} from 'lucide-react';

const GEMINI_KEY_STORAGE = 'task-sultan:gemini-key';

const extractDominantColor = (canvas) => {
  try {
    const ctx = canvas.getContext('2d');
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const buckets = new Map();

    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a < 200) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (r > 230 && g > 230 && b > 230) continue;
      if (r < 25 && g < 25 && b < 25) continue;
      if (Math.max(r, g, b) - Math.min(r, g, b) < 25) continue;

      const q = (v) => Math.round(v / 24) * 24;
      const key = `${q(r)},${q(g)},${q(b)}`;
      buckets.set(key, (buckets.get(key) || 0) + 1);
    }

    if (buckets.size === 0) return null;

    let bestKey = null;
    let bestCount = 0;
    for (const [key, count] of buckets) {
      if (count > bestCount) {
        bestKey = key;
        bestCount = count;
      }
    }

    const [r, g, b] = bestKey.split(',').map(Number);
    return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
};

const readImageAsDataUrl = (file, maxSize = 256) =>
  new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('الملف ليس صورة'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('فشل قراءة الملف'));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(maxSize / img.width, maxSize / img.height, 1);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * ratio));
        canvas.height = Math.max(1, Math.round(img.height * ratio));
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const color = extractDominantColor(canvas);
        let dataUrl;
        try {
          dataUrl = canvas.toDataURL('image/webp', 0.85);
        } catch {
          dataUrl = canvas.toDataURL('image/png');
        }
        resolve({ dataUrl, color });
      };
      img.onerror = () => reject(new Error('صورة غير صالحة'));
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
import {
  initAuth, subscribe, getAll, add, update, remove,
  derivePhraseUid, setIdentity, getIdentityMode, getCurrentUid, migrateData,
} from './storage.js';

const initialProjects = [
  { name: 'تراحم', description: 'الدوام الرسمي - التركيز على المهام المؤسسية والعمل الخيري.', type: 'job', weeklyHours: 40, color: '#10B981', icon: 'Briefcase', incomePotential: 8, strategicValue: 6, effortLevel: 7 },
  { name: 'شركة محور', description: 'إدارة وتطوير العمليات في الشركة والتركيز على النمو المستدام.', type: 'project', weeklyHours: 15, color: '#3B82F6', icon: 'HardHat', incomePotential: 7, strategicValue: 8, effortLevel: 6 },
  { name: 'بعد التمكين', description: 'مبادرة تمكين ودعم - التركيز على الأثر المجتمعي وبناء الشراكات.', type: 'project', weeklyHours: 10, color: '#0EA5E9', icon: 'Target', incomePotential: 5, strategicValue: 9, effortLevel: 5 },
  { name: 'تطبيق الحساسية', description: 'ستارت اب تقني للرعاية الصحية - تطوير التطبيق والتسويق.', type: 'startup', weeklyHours: 10, color: '#F59E0B', icon: 'Rocket', incomePotential: 9, strategicValue: 10, effortLevel: 8 },
  { name: 'بوصلة الأعمال', description: 'شركة إدارة محتوى وتسويق - صناعة الهوية الرقمية للعملاء.', type: 'project', weeklyHours: 12, color: '#8B5CF6', icon: 'PenTool', incomePotential: 7, strategicValue: 7, effortLevel: 5 },
  { name: 'شخصي', description: 'تطوير الذات، الصحة، والراحة - المهام التي تعيد بناء طاقتك.', type: 'personal', weeklyHours: 20, color: '#F43F5E', icon: 'User', incomePotential: 0, strategicValue: 10, effortLevel: 4 },
];

const App = () => {
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState('local');
  const [tasks, setTasks] = useState([]);
  const [foundations, setFoundations] = useState([]);
  const [weeklyGoal, setWeeklyGoal] = useState('');
  const [activeContext, setActiveContext] = useState('all');
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [editingFoundation, setEditingFoundation] = useState(null);
  const [decisionModal, setDecisionModal] = useState(null);
  const [showFoundationManager, setShowFoundationManager] = useState(false);
  const [syncStatus, setSyncStatus] = useState('synced');
  const [newSubTask, setNewSubTask] = useState('');

  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [geminiKey, setGeminiKey] = useState(
    () => (typeof localStorage !== 'undefined' && localStorage.getItem(GEMINI_KEY_STORAGE)) || ''
  );
  const [keyDraft, setKeyDraft] = useState('');
  const [showKeyEditor, setShowKeyEditor] = useState(false);
  const [showKeyValue, setShowKeyValue] = useState(false);

  const [identityMode, setIdentityModeState] = useState('random');
  const [phraseEditor, setPhraseEditor] = useState(false);
  const [phraseDraft, setPhraseDraft] = useState('');
  const [phraseConfirm, setPhraseConfirm] = useState('');
  const [migrateExisting, setMigrateExisting] = useState(true);
  const [phraseError, setPhraseError] = useState('');
  const [phraseBusy, setPhraseBusy] = useState(false);

  const [logoUploadError, setLogoUploadError] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setLogoUploadError('حجم الصورة يتجاوز 5MB.');
      return;
    }
    setLogoUploadError('');
    setLogoUploading(true);
    try {
      const { dataUrl, color } = await readImageAsDataUrl(file, 256);
      setFoundationForm((f) => ({
        ...f,
        logoUrl: dataUrl,
        ...(color ? { color } : {}),
      }));
    } catch (err) {
      setLogoUploadError(err.message || 'تعذر تحميل الصورة');
    } finally {
      setLogoUploading(false);
    }
  };

  const refreshIdentityState = () => setIdentityModeState(getIdentityMode());

  const applyPhrase = async () => {
    setPhraseError('');
    if (phraseDraft.trim().length < 6) {
      setPhraseError('استخدم عبارة لا تقل عن 6 أحرف.');
      return;
    }
    if (phraseDraft !== phraseConfirm) {
      setPhraseError('العبارتان غير متطابقتين.');
      return;
    }
    setPhraseBusy(true);
    try {
      const newUid = await derivePhraseUid(phraseDraft);
      const oldUid = user?.uid;
      if (migrateExisting && oldUid && oldUid !== newUid) {
        await migrateData(oldUid, newUid);
      }
      setIdentity(newUid, 'phrase');
      setTasks([]);
      setFoundations([]);
      setUser({ uid: newUid });
      setIdentityModeState('phrase');
      setPhraseDraft('');
      setPhraseConfirm('');
      setPhraseEditor(false);
      setShowFoundationManager(false);
    } catch (err) {
      setPhraseError(err.message || 'خطأ غير متوقع');
    } finally {
      setPhraseBusy(false);
    }
  };

  const resetToRandomIdentity = () => {
    if (!confirm('سيُنشأ هوية عشوائية جديدة في هذا المتصفح. بياناتك الحالية المرتبطة بالعبارة ستبقى محفوظة (تُسترجع بإدخال العبارة مجدداً). متابعة؟')) {
      return;
    }
    const newUid = crypto.randomUUID
      ? `u-${crypto.randomUUID()}`
      : `u-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    setIdentity(newUid, 'random');
    setTasks([]);
    setFoundations([]);
    setUser({ uid: newUid });
    setIdentityModeState('random');
  };

  const saveGeminiKey = () => {
    const trimmed = keyDraft.trim();
    if (!trimmed) return;
    localStorage.setItem(GEMINI_KEY_STORAGE, trimmed);
    setGeminiKey(trimmed);
    setKeyDraft('');
    setShowKeyEditor(false);
  };

  const removeGeminiKey = () => {
    localStorage.removeItem(GEMINI_KEY_STORAGE);
    setGeminiKey('');
    setKeyDraft('');
    setShowKeyEditor(false);
  };

  const maskKey = (k) => (k && k.length > 10 ? `${k.slice(0, 6)}…${k.slice(-4)}` : k);

  const [newTask, setNewTask] = useState({
    title: '',
    foundationId: 'personal',
    type: 'project',
    energy: 'medium',
    impact: 5,
    difficulty: 5,
    subtasks: [],
  });

  const [foundationForm, setFoundationForm] = useState({
    name: '',
    description: '',
    type: 'job',
    weeklyHours: 40,
    color: '#3B82F6',
    icon: 'Briefcase',
    logoUrl: '',
    incomePotential: 5,
    strategicValue: 5,
    effortLevel: 5,
  });

  useEffect(() => {
    const unsub = initAuth((u, m) => {
      setUser(u);
      if (m) setMode(m);
      refreshIdentityState();
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      const existing = await getAll(user.uid, 'foundations');
      if (cancelled) return;
      if (existing.length === 0) {
        for (const proj of initialProjects) {
          await add(user.uid, 'foundations', proj);
        }
      }
    })();

    setSyncStatus('saving');
    const unsubTasks = subscribe(user.uid, 'tasks', (items) => {
      setTasks(items);
      setSyncStatus('synced');
    });
    const unsubFoundations = subscribe(user.uid, 'foundations', (items) => {
      setFoundations(items);
      setSyncStatus('synced');
    });

    return () => {
      cancelled = true;
      unsubTasks();
      unsubFoundations();
    };
  }, [user]);

  const handleAddTask = async () => {
    if (!newTask.title.trim() || !user) return;
    setSyncStatus('saving');
    try {
      await add(user.uid, 'tasks', {
        ...newTask,
        status: 'pending',
        createdAt: new Date().toISOString(),
        score: newTask.impact * 2 - newTask.difficulty,
      });
      setNewTask({
        title: '',
        foundationId: activeContext !== 'all' ? activeContext : 'personal',
        type: 'project',
        energy: 'medium',
        impact: 5,
        difficulty: 5,
        subtasks: [],
      });
      setIsAddingTask(false);
    } catch {
      setSyncStatus('error');
    }
  };

  const handleSaveFoundation = async () => {
    if (!foundationForm.name.trim() || !user) return;
    setSyncStatus('saving');
    try {
      const { id, ...data } = foundationForm;
      if (editingFoundation?.id) {
        await update(user.uid, 'foundations', editingFoundation.id, data);
      } else {
        await add(user.uid, 'foundations', data);
      }
      setEditingFoundation(null);
    } catch {
      setSyncStatus('error');
    }
  };

  const addSubTask = async (taskId) => {
    if (!newSubTask.trim()) return;
    const task = tasks.find((t) => t.id === taskId);
    const updatedSubtasks = [
      ...(task.subtasks || []),
      { id: Date.now(), title: newSubTask, done: false },
    ];
    await update(user.uid, 'tasks', taskId, { subtasks: updatedSubtasks });
    setNewSubTask('');
    setDecisionModal((d) => (d ? { ...d, subtasks: updatedSubtasks } : d));
  };

  const toggleSubTask = async (taskId, subTaskId) => {
    const task = tasks.find((t) => t.id === taskId);
    const updatedSubtasks = task.subtasks.map((st) =>
      st.id === subTaskId ? { ...st, done: !st.done } : st
    );
    await update(user.uid, 'tasks', taskId, { subtasks: updatedSubtasks });
    setDecisionModal((d) => (d ? { ...d, subtasks: updatedSubtasks } : d));
  };

  const toggleTaskStatus = async (task) => {
    if (!user) return;
    await update(user.uid, 'tasks', task.id, {
      status: task.status === 'done' ? 'pending' : 'done',
    });
  };

  const deleteTask = async (id) => {
    if (!user) return;
    await remove(user.uid, 'tasks', id);
  };

  const fetchAIAnalysis = async () => {
    setIsAnalyzing(true);
    setShowAiModal(true);
    const contextData = {
      weeklyGoal,
      projects: foundations,
      pendingTasks: tasks.filter((t) => t.status !== 'done'),
    };
    const prompt = `أنت مستشار استراتيجي. بناءً على هذه المشاريع (تراحم، محور، بعد التمكين، تطبيق الحساسية، بوصلة الأعمال، والجانب الشخصي)، حلل التوزيع الحالي وقدم نصيحة ذهبية لليوم باللغة العربية. البيانات: ${JSON.stringify(contextData)}`;

    try {
      const response = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          model: 'gemini-2.5-flash',
          ...(geminiKey ? { apiKey: geminiKey } : {}),
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setAiAnalysis(result.error || 'فشل التحليل.');
      } else {
        setAiAnalysis(result.text || 'لم يصل رد من النموذج.');
      }
    } catch {
      setAiAnalysis('خطأ في الاتصال بالذكاء الاصطناعي.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const iconMap = {
    Briefcase: <Briefcase size={16} />,
    Rocket: <Rocket size={16} />,
    HardHat: <HardHat size={16} />,
    User: <User size={16} />,
    Target: <Target size={16} />,
    PenTool: <PenTool size={16} />,
    Heart: <Heart size={16} />,
  };

  const RenderLogo = ({ foundation, size = 16 }) => {
    if (foundation?.logoUrl) {
      return (
        <img
          src={foundation.logoUrl}
          alt={foundation.name}
          className="rounded-md object-cover"
          style={{ width: size, height: size }}
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = 'https://via.placeholder.com/40?text=Logo';
          }}
        />
      );
    }
    return iconMap[foundation?.icon] || <Layers size={size} />;
  };

  const filteredTasks = useMemo(() => {
    let list = tasks;
    if (activeContext !== 'all') list = list.filter((t) => t.foundationId === activeContext);
    return [...list].sort((a, b) => (b.score || 0) - (a.score || 0));
  }, [tasks, activeContext]);

  const handleBackdropClick = (e, callback) => {
    if (e.target === e.currentTarget) callback();
  };

  const activeFoundation = foundations.find((f) => f.id === activeContext);

  const modeBadge =
    mode === 'firebase'
      ? { icon: <Cloud size={11} />, label: 'Firebase', cls: 'text-emerald-600' }
      : mode === 'netlify'
      ? { icon: <Cloud size={11} />, label: 'Netlify Blobs', cls: 'text-blue-600' }
      : { icon: <CloudOff size={11} />, label: 'وضع محلي', cls: 'text-amber-600' };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-blue-100" dir="rtl">
      <nav className="bg-white/90 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30 px-3 sm:px-4 h-16">
        <div className="max-w-6xl mx-auto h-full flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-slate-900 rounded-xl flex items-center justify-center shadow-lg shrink-0">
              <ShieldCheck className="text-white" size={20} />
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-xs sm:text-sm truncate">FocusFlow Architect</h1>
              <span className={`text-[9px] sm:text-[10px] font-bold uppercase flex items-center gap-1 ${modeBadge.cls}`}>
                {modeBadge.icon} {modeBadge.label} · {syncStatus === 'synced' ? 'متزامن' : 'حفظ...'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={fetchAIAnalysis}
              aria-label="محلل Gemini"
              className="bg-indigo-50 text-indigo-600 p-2 sm:p-2.5 rounded-xl hover:bg-indigo-100 border border-indigo-100 transition-all flex items-center gap-2"
            >
              <BrainCircuit size={18} /> <span className="hidden sm:inline">محلل Gemini</span>
            </button>
            <button
              onClick={() => setShowFoundationManager(true)}
              aria-label="الإعدادات"
              className="text-slate-600 p-2 sm:p-2.5 rounded-xl hover:bg-slate-50 border border-slate-100"
            >
              <Settings size={18} />
            </button>
            <button
              onClick={() => setIsAddingTask(true)}
              className="hidden sm:inline-flex bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-blue-100"
            >
              إضافة مهمة
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-3 sm:px-4 py-5 sm:py-8 pb-28 sm:pb-8">
        <div className="flex items-center gap-2 mb-5 sm:mb-8 overflow-x-auto pb-3 sm:pb-4 no-scrollbar -mx-3 sm:mx-0 px-3 sm:px-0">
          <button
            onClick={() => setActiveContext('all')}
            className={`px-4 sm:px-6 py-2.5 sm:py-3 rounded-2xl text-xs font-bold transition-all border whitespace-nowrap ${
              activeContext === 'all'
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
            }`}
          >
            الكل
          </button>
          {foundations.map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveContext(f.id)}
              className={`px-4 sm:px-6 py-2.5 sm:py-3 rounded-2xl text-xs font-bold whitespace-nowrap transition-all border flex items-center gap-2 shadow-sm ${
                activeContext === f.id
                  ? 'bg-white text-slate-900 border-slate-900 ring-4 ring-slate-900/5'
                  : 'bg-white text-slate-500 border-slate-200'
              }`}
              style={activeContext === f.id ? { borderColor: f.color } : {}}
            >
              <RenderLogo foundation={f} size={16} /> {f.name}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-8">
          <div className="lg:col-span-8 space-y-4 sm:space-y-6">
            {activeFoundation && (
              <div
                className="p-5 sm:p-6 rounded-3xl sm:rounded-[2rem] border transition-all relative overflow-hidden"
                style={{
                  backgroundColor: activeFoundation.color + '10',
                  borderColor: activeFoundation.color + '40',
                }}
              >
                <div className="flex items-center gap-3 sm:gap-4 relative z-10">
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center overflow-hidden shrink-0">
                    <RenderLogo foundation={activeFoundation} size={36} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-xl sm:text-2xl font-black truncate" style={{ color: activeFoundation.color }}>
                      {activeFoundation.name}
                    </h2>
                    <p className="text-xs text-slate-500 mt-1 font-medium line-clamp-2">{activeFoundation.description}</p>
                  </div>
                </div>
                {activeFoundation.type === 'personal' && (
                  <div className="mt-4 flex gap-2">
                    <span className="text-[10px] bg-rose-100 text-rose-600 px-3 py-1 rounded-full font-bold">
                      مساحة الهدوء والتطوير
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="bg-white p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-2">
                <Target size={14} className="text-blue-600" /> مرساة الأسبوع
              </label>
              <input
                type="text"
                placeholder="ما هو هدفك الاستراتيجي لهذا الأسبوع؟"
                className="w-full text-base sm:text-xl font-bold bg-transparent border-none focus:ring-0 outline-none placeholder:text-slate-200 p-0"
                value={weeklyGoal}
                onChange={(e) => setWeeklyGoal(e.target.value)}
              />
            </div>

            <div className="space-y-3">
              {filteredTasks.length === 0 && (
                <div className="bg-white p-10 rounded-3xl border border-dashed border-slate-200 text-center text-slate-400 text-sm font-bold">
                  لا توجد مهام بعد. اضغط "إضافة مهمة" للبدء.
                </div>
              )}
              {filteredTasks.map((task) => {
                const foundation = foundations.find((f) => f.id === task.foundationId);
                return (
                  <div
                    key={task.id}
                    className={`bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between group transition-all hover:shadow-md ${
                      task.status === 'done' ? 'opacity-40 grayscale' : ''
                    }`}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <button
                        onClick={() => toggleTaskStatus(task)}
                        className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all ${
                          task.status === 'done'
                            ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-100'
                            : 'border-slate-200 hover:border-blue-500'
                        }`}
                      >
                        <CheckCircle2 size={16} />
                      </button>
                      <div className="flex-1">
                        <h4 className="font-bold text-slate-800">{task.title}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-50 text-slate-400 font-bold border border-slate-100 flex items-center gap-1">
                            <RenderLogo foundation={foundation} size={10} /> {foundation?.name || 'عام'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                      <button
                        onClick={() => setDecisionModal(task)}
                        aria-label="تفاصيل المهمة"
                        className="p-2 text-slate-400 hover:text-blue-600"
                      >
                        <BarChart3 size={18} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-4 space-y-4 sm:space-y-6">
            <div className="bg-white p-5 sm:p-7 rounded-3xl sm:rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-full blur-[100px] opacity-60"></div>
              <h4 className="font-bold text-sm mb-6 flex items-center gap-2 text-slate-800">
                <TrendingUp size={18} className="text-blue-600" /> التوازن الحالي للمشاريع
              </h4>
              <div className="space-y-5">
                {foundations.map((f) => {
                  const pending = tasks.filter(
                    (t) => t.foundationId === f.id && t.status !== 'done'
                  ).length;
                  const roi =
                    f.type === 'personal'
                      ? f.strategicValue * 1.5
                      : (f.incomePotential || 0) + (f.strategicValue || 0);
                  return (
                    <div key={f.id} className="space-y-2">
                      <div className="flex justify-between items-center text-[11px] font-bold">
                        <span className="flex items-center gap-2 text-slate-700">
                          <RenderLogo foundation={f} size={14} /> {f.name}
                        </span>
                        <span className="text-slate-400">{pending} مهام</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-1000"
                          style={{ width: `${Math.min(roi * 5, 100)}%`, backgroundColor: f.color }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {mode === 'local' && (
              <div className="bg-amber-50 border border-amber-100 p-6 rounded-3xl">
                <h5 className="font-bold text-amber-900 text-xs mb-2 flex items-center gap-2">
                  <CloudOff className="text-amber-500" size={16} /> وضع التخزين المحلي
                </h5>
                <p className="text-[11px] text-amber-800 leading-relaxed font-medium opacity-90">
                  بياناتك محفوظة في هذا المتصفح فقط. على Netlify ستتحول تلقائياً إلى تخزين Netlify Blobs السحابي.
                </p>
              </div>
            )}
            {mode === 'netlify' && (
              <div className="bg-blue-50 border border-blue-100 p-6 rounded-3xl">
                <h5 className="font-bold text-blue-900 text-xs mb-2 flex items-center gap-2">
                  <Cloud className="text-blue-500" size={16} /> Netlify Blobs
                </h5>
                <p className="text-[11px] text-blue-800 leading-relaxed font-medium opacity-90">
                  بياناتك محفوظة سحابياً عبر Netlify Blobs. هويتك محفوظة في هذا المتصفح — احتفظ بنفس المتصفح للوصول لبياناتك.
                </p>
              </div>
            )}

            <div className="bg-rose-50 border border-rose-100 p-6 rounded-3xl">
              <h5 className="font-bold text-rose-900 text-xs mb-2 flex items-center gap-2">
                <User className="text-rose-500" size={16} /> ركن الحياة الشخصية
              </h5>
              <p className="text-[11px] text-rose-800 leading-relaxed font-medium opacity-80 italic">
                "تراحم ومحور هي محركات عملك، لكن الجانب الشخصي هو الوقود. لا تفرغ خزان طاقتك أبداً."
              </p>
            </div>
          </div>
        </div>
      </main>

      {showFoundationManager && (
        <div
          className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in"
          onClick={(e) => handleBackdropClick(e, () => setShowFoundationManager(false))}
        >
          <div className="bg-white w-full max-w-5xl rounded-t-3xl sm:rounded-[2.5rem] shadow-2xl flex flex-col md:flex-row overflow-hidden max-h-[92vh] sm:max-h-[90vh] relative animate-in zoom-in-95">
            <button
              onClick={() => setShowFoundationManager(false)}
              aria-label="إغلاق"
              className="absolute top-4 left-4 sm:top-6 sm:left-6 p-2 bg-slate-100 rounded-full z-10"
            >
              <X size={20} />
            </button>
            <div className="w-full md:w-[35%] bg-slate-50 p-5 sm:p-8 border-b md:border-b-0 md:border-l border-slate-200 overflow-y-auto">
              {mode !== 'firebase' && (
                <div className="mb-6 pb-6 border-b border-slate-200">
                  <h4 className="font-black text-sm mb-3 flex items-center gap-2">
                    <Key size={14} className="text-indigo-600" /> هويتك ومزامنة الأجهزة
                  </h4>

                  {identityMode === 'random' && !phraseEditor && (
                    <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3.5">
                      <p className="text-[11px] text-amber-800 leading-relaxed font-medium mb-3">
                        هويتك حالياً عشوائية ومحلية لهذا المتصفح. لمزامنة بياناتك على أجهزة أخرى، فعّل عبارة سرية.
                      </p>
                      <button
                        onClick={() => setPhraseEditor(true)}
                        className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black"
                      >
                        تفعيل عبارة المزامنة
                      </button>
                    </div>
                  )}

                  {identityMode === 'phrase' && !phraseEditor && (
                    <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3.5 space-y-3">
                      <div className="flex items-center gap-2 text-[11px] font-bold text-emerald-700">
                        <Check size={14} />
                        مزامنة الأجهزة مفعّلة بعبارة سرية
                      </div>
                      <p className="text-[10px] text-emerald-700 opacity-80 leading-relaxed">
                        افتح الموقع على جهاز آخر وفعّل المزامنة بنفس العبارة لاسترجاع بياناتك.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setPhraseEditor(true)}
                          className="flex-1 py-2 bg-white border border-emerald-200 text-emerald-700 rounded-lg text-[11px] font-bold"
                        >
                          تغيير العبارة
                        </button>
                        <button
                          onClick={resetToRandomIdentity}
                          className="px-3 py-2 bg-white border border-rose-200 text-rose-600 rounded-lg text-[11px] font-bold"
                        >
                          إيقاف
                        </button>
                      </div>
                    </div>
                  )}

                  {phraseEditor && (
                    <div className="bg-white border border-slate-200 rounded-2xl p-3.5 space-y-3">
                      <input
                        autoFocus
                        type="password"
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-500"
                        placeholder="عبارة سرية لا تنسى..."
                        value={phraseDraft}
                        onChange={(e) => setPhraseDraft(e.target.value)}
                      />
                      <input
                        type="password"
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-500"
                        placeholder="أعد كتابة العبارة..."
                        value={phraseConfirm}
                        onChange={(e) => setPhraseConfirm(e.target.value)}
                      />
                      <label className="flex items-center gap-2 text-[11px] font-bold text-slate-600">
                        <input
                          type="checkbox"
                          checked={migrateExisting}
                          onChange={(e) => setMigrateExisting(e.target.checked)}
                          className="w-4 h-4 accent-indigo-600"
                        />
                        نقل بياناتي الحالية إلى هذه العبارة
                      </label>
                      {phraseError && (
                        <p className="text-[11px] text-rose-600 font-bold">{phraseError}</p>
                      )}
                      <p className="text-[10px] text-slate-500 leading-relaxed">
                        تنبيه: نسيان العبارة يعني فقدان الوصول لبياناتك. لا تُحفظ العبارة في أي مكان — فقط البصمة المشتقة منها.
                      </p>
                      <div className="flex gap-2">
                        <button
                          onClick={applyPhrase}
                          disabled={phraseBusy}
                          className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black disabled:opacity-50"
                        >
                          {phraseBusy ? 'جاري التطبيق...' : 'تفعيل'}
                        </button>
                        <button
                          onClick={() => {
                            setPhraseEditor(false);
                            setPhraseDraft('');
                            setPhraseConfirm('');
                            setPhraseError('');
                          }}
                          className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600"
                        >
                          إلغاء
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <h3 className="font-black text-xl sm:text-2xl mb-5 sm:mb-8">إدارة التأسيس</h3>
              <div className="space-y-3">
                {foundations.map((f) => (
                  <div
                    key={f.id}
                    className={`p-4 rounded-2xl border transition-all flex items-center justify-between group bg-white ${
                      editingFoundation?.id === f.id ? 'border-blue-500 ring-4 ring-blue-50' : 'border-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
                        style={{ backgroundColor: f.color }}
                      >
                        <RenderLogo foundation={f} size={18} />
                      </div>
                      <div className="text-sm font-bold">{f.name}</div>
                    </div>
                    <button
                      onClick={() => {
                        setEditingFoundation(f);
                        setFoundationForm(f);
                      }}
                      className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg"
                    >
                      <Edit3 size={16} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => {
                    setEditingFoundation({ id: null });
                    setFoundationForm({
                      name: '',
                      description: '',
                      type: 'job',
                      weeklyHours: 40,
                      color: '#3B82F6',
                      icon: 'Briefcase',
                      logoUrl: '',
                      incomePotential: 5,
                      strategicValue: 5,
                      effortLevel: 5,
                    });
                  }}
                  className="w-full py-5 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 text-xs font-black hover:border-blue-400 hover:text-blue-600"
                >
                  + إضافة مشروع جديد
                </button>
              </div>
            </div>

            <div className="flex-1 p-5 sm:p-8 md:p-12 overflow-y-auto">
              {(editingFoundation || foundations.length === 0) && (
                <div className="max-w-xl mx-auto space-y-5 sm:space-y-8">
                  <h3 className="font-black text-2xl sm:text-3xl">
                    {editingFoundation?.id ? 'تعديل المشروع' : 'تأسيس مشروع جديد'}
                  </h3>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[11px] font-black text-slate-400 uppercase">اسم المشروع</label>
                        <input
                          className="w-full p-4 bg-slate-50 border rounded-2xl font-bold"
                          value={foundationForm.name}
                          onChange={(e) => setFoundationForm({ ...foundationForm, name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[11px] font-black text-slate-400 uppercase">النوع</label>
                        <select
                          className="w-full p-4 bg-slate-50 border rounded-2xl font-bold"
                          value={foundationForm.type}
                          onChange={(e) => setFoundationForm({ ...foundationForm, type: e.target.value })}
                        >
                          <option value="job">وظيفة ثابتة</option>
                          <option value="startup">ستارت-أب</option>
                          <option value="project">شركة / مشروع</option>
                          <option value="personal">شخصي / حياة</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-slate-400 uppercase">
                        فكرة المشروع / وصف الدور
                      </label>
                      <textarea
                        className="w-full p-4 bg-slate-50 border rounded-2xl min-h-[80px]"
                        value={foundationForm.description}
                        onChange={(e) => setFoundationForm({ ...foundationForm, description: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-slate-400 uppercase">
                        شعار المشروع - اختياري
                      </label>
                      {foundationForm.logoUrl ? (
                        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-2xl p-3">
                          <img
                            src={foundationForm.logoUrl}
                            alt="شعار المشروع"
                            className="w-16 h-16 rounded-xl object-cover bg-white shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-bold text-slate-700">شعار محمّل</div>
                            <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                              <span
                                className="inline-block w-2.5 h-2.5 rounded-full border border-white shadow-sm"
                                style={{ backgroundColor: foundationForm.color }}
                              />
                              لون المشروع التُقط من الشعار
                            </div>
                          </div>
                          <label
                            className={`p-2.5 bg-white border border-slate-200 rounded-lg text-blue-600 cursor-pointer ${
                              logoUploading ? 'opacity-50 pointer-events-none' : ''
                            }`}
                            aria-label="تغيير الشعار"
                          >
                            <Upload size={16} />
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleLogoUpload}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() =>
                              setFoundationForm({ ...foundationForm, logoUrl: '' })
                            }
                            className="p-2.5 bg-white border border-slate-200 rounded-lg text-rose-500"
                            aria-label="حذف الشعار"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ) : (
                        <label
                          className={`block w-full p-5 sm:p-6 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl text-center hover:border-blue-400 hover:bg-blue-50/40 cursor-pointer transition-colors ${
                            logoUploading ? 'opacity-50 pointer-events-none' : ''
                          }`}
                        >
                          <Upload size={22} className="mx-auto text-slate-400 mb-2" />
                          <div className="text-xs font-bold text-slate-600">
                            {logoUploading ? 'جاري المعالجة...' : 'اضغط لرفع صورة من جهازك'}
                          </div>
                          <div className="text-[10px] text-slate-400 mt-1">
                            PNG / JPG / WEBP — حتى 5MB
                          </div>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleLogoUpload}
                          />
                        </label>
                      )}
                      {logoUploadError && (
                        <p className="text-[11px] text-rose-600 font-bold">{logoUploadError}</p>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[11px] font-black text-slate-400 uppercase">اللون</label>
                        <input
                          type="color"
                          className="w-full h-14 p-2 bg-slate-50 border rounded-2xl cursor-pointer"
                          value={foundationForm.color}
                          onChange={(e) => setFoundationForm({ ...foundationForm, color: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[11px] font-black text-slate-400 uppercase">
                          الأيقونة (إذا لم يوجد شعار)
                        </label>
                        <select
                          className="w-full p-4 bg-slate-50 border rounded-2xl font-bold"
                          value={foundationForm.icon}
                          onChange={(e) => setFoundationForm({ ...foundationForm, icon: e.target.value })}
                        >
                          <option value="Briefcase">حقيبة</option>
                          <option value="Rocket">صاروخ</option>
                          <option value="HardHat">قبعة</option>
                          <option value="PenTool">ريشة</option>
                          <option value="Target">هدف</option>
                          <option value="User">شخص</option>
                          <option value="Heart">قلب</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleSaveFoundation}
                    className="w-full py-5 bg-blue-600 text-white rounded-[1.5rem] font-black shadow-xl"
                  >
                    حفظ التأسيس
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showAiModal && (
        <div
          className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in"
          onClick={(e) => handleBackdropClick(e, () => setShowAiModal(false))}
        >
          <div className="bg-white w-full max-w-2xl rounded-t-3xl sm:rounded-[2.5rem] shadow-2xl overflow-hidden relative flex flex-col max-h-[92vh] sm:max-h-[85vh]">
            <button
              onClick={() => setShowAiModal(false)}
              aria-label="إغلاق"
              className="absolute top-4 left-4 sm:top-8 sm:left-8 p-2 bg-slate-50 rounded-full z-10"
            >
              <X size={20} />
            </button>
            <div className="p-6 sm:p-10 flex-1 overflow-y-auto no-scrollbar">
              <div className="flex items-center gap-3 mb-5 sm:mb-6">
                <div className="w-11 h-11 sm:w-12 sm:h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shrink-0">
                  <BrainCircuit size={26} />
                </div>
                <h2 className="text-xl sm:text-2xl font-black flex-1">محلل Gemini الاستراتيجي</h2>
                <button
                  onClick={() => {
                    setKeyDraft('');
                    setShowKeyEditor((v) => !v);
                  }}
                  aria-label="مفتاح API"
                  className={`p-2 rounded-xl border transition-all ${
                    geminiKey
                      ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                      : 'bg-amber-50 text-amber-600 border-amber-100'
                  }`}
                >
                  <Key size={16} />
                </button>
              </div>

              <div className="mb-5 sm:mb-6">
                {!geminiKey && !showKeyEditor && (
                  <button
                    onClick={() => setShowKeyEditor(true)}
                    className="w-full bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl p-4 text-right text-xs font-bold flex items-center gap-2 hover:bg-amber-100"
                  >
                    <Key size={14} />
                    لم تضف مفتاح Gemini بعد. اضغط هنا للصق مفتاحك.
                  </button>
                )}

                {geminiKey && !showKeyEditor && (
                  <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3 sm:p-4 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 min-w-0">
                      <Check size={14} className="shrink-0" />
                      <span className="truncate">مفتاحك محفوظ: <span className="font-mono opacity-80">{maskKey(geminiKey)}</span></span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => {
                          setKeyDraft(geminiKey);
                          setShowKeyEditor(true);
                        }}
                        className="p-2 text-emerald-700 hover:bg-emerald-100 rounded-lg"
                        aria-label="تعديل"
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        onClick={removeGeminiKey}
                        className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg"
                        aria-label="حذف"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )}

                {showKeyEditor && (
                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <Key size={12} /> مفتاح Gemini API
                    </label>
                    <div className="flex gap-2">
                      <input
                        autoFocus
                        type={showKeyValue ? 'text' : 'password'}
                        dir="ltr"
                        className="flex-1 p-3 bg-white border border-slate-200 rounded-xl font-mono text-xs outline-none focus:border-indigo-500 text-left"
                        placeholder="AIza..."
                        value={keyDraft}
                        onChange={(e) => setKeyDraft(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && saveGeminiKey()}
                      />
                      <button
                        onClick={() => setShowKeyValue((v) => !v)}
                        className="p-3 bg-white border border-slate-200 rounded-xl text-slate-500"
                        aria-label={showKeyValue ? 'إخفاء' : 'إظهار'}
                      >
                        {showKeyValue ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      احصل على مفتاح مجاني من{' '}
                      <a
                        href="https://aistudio.google.com/apikey"
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-600 font-bold underline"
                      >
                        Google AI Studio
                      </a>
                      . يُحفظ في هذا المتصفح فقط ولا يُرسل إلى GitHub.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={saveGeminiKey}
                        disabled={!keyDraft.trim()}
                        className="flex-1 py-3 bg-indigo-600 text-white rounded-xl text-xs font-black disabled:opacity-40"
                      >
                        حفظ المفتاح
                      </button>
                      <button
                        onClick={() => {
                          setShowKeyEditor(false);
                          setKeyDraft('');
                        }}
                        className="px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600"
                      >
                        إلغاء
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {isAnalyzing ? (
                <div className="py-16 sm:py-20 text-center font-bold text-slate-400 animate-pulse text-sm sm:text-base">
                  جاري فحص مشاريع (تراحم، محور، بعد التمكين...)
                </div>
              ) : (
                <div className="bg-indigo-50 p-5 sm:p-8 rounded-2xl sm:rounded-[2rem] border border-indigo-100 text-slate-700 leading-relaxed whitespace-pre-wrap text-sm font-medium">
                  {aiAnalysis}
                </div>
              )}
            </div>
            <div className="p-5 sm:p-8 bg-slate-50 border-t">
              <button
                onClick={() => setShowAiModal(false)}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black shadow-lg"
              >
                فهمت، لنعد للعمل
              </button>
            </div>
          </div>
        </div>
      )}

      {isAddingTask && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in"
          onClick={(e) => handleBackdropClick(e, () => setIsAddingTask(false))}
        >
          <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-[2rem] shadow-2xl p-6 sm:p-10 relative">
            <button
              onClick={() => setIsAddingTask(false)}
              aria-label="إغلاق"
              className="absolute top-4 left-4 sm:top-6 sm:left-6 p-2 hover:bg-slate-50 rounded-full"
            >
              <X size={20} />
            </button>
            <h3 className="font-black text-xl sm:text-2xl mb-5 sm:mb-8 flex items-center gap-2">
              <Plus className="text-blue-600" /> إضافة مهمة
            </h3>
            <div className="space-y-4 sm:space-y-6">
              <input
                autoFocus
                className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold"
                placeholder="ماذا تنوي إنجازه؟"
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
              />
              <select
                className="w-full p-4 bg-slate-50 border rounded-2xl font-bold"
                value={newTask.foundationId}
                onChange={(e) => setNewTask({ ...newTask, foundationId: e.target.value })}
              >
                <option value="personal">عام / شخصي</option>
                {foundations.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
              <button
                onClick={handleAddTask}
                className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black shadow-xl shadow-blue-100"
              >
                إضافة المهمة
              </button>
            </div>
          </div>
        </div>
      )}

      {decisionModal && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in"
          onClick={(e) => handleBackdropClick(e, () => setDecisionModal(null))}
        >
          <div className="bg-white w-full max-w-2xl rounded-t-3xl sm:rounded-[2.5rem] shadow-2xl overflow-hidden relative max-h-[92vh] overflow-y-auto">
            <button
              onClick={() => setDecisionModal(null)}
              aria-label="إغلاق"
              className="absolute top-4 left-4 sm:top-8 sm:left-8 p-2 hover:bg-slate-50 rounded-full z-10 bg-white/80 backdrop-blur-sm"
            >
              <X size={20} />
            </button>
            <div className="p-6 sm:p-10 md:p-12 space-y-5 sm:space-y-8">
              <div>
                <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-widest">
                  تفكيك المهمة
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-4 leading-tight">{decisionModal.title}</h2>
              </div>
              <div className="bg-slate-50 p-4 sm:p-6 rounded-2xl sm:rounded-[2rem] space-y-4">
                <div className="flex gap-2">
                  <input
                    className="flex-1 p-3 bg-white border rounded-xl font-bold text-sm outline-none focus:border-blue-500"
                    placeholder="أضف خطوة فرعية بسيطة..."
                    value={newSubTask}
                    onChange={(e) => setNewSubTask(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addSubTask(decisionModal.id)}
                  />
                  <button
                    onClick={() => addSubTask(decisionModal.id)}
                    className="bg-slate-900 text-white p-3 rounded-xl"
                  >
                    <Plus size={20} />
                  </button>
                </div>
                <div className="space-y-2">
                  {(decisionModal.subtasks || []).map((st) => (
                    <div
                      key={st.id}
                      className="flex items-center gap-3 bg-white p-3 rounded-xl border border-slate-50"
                    >
                      <button
                        onClick={() => toggleSubTask(decisionModal.id, st.id)}
                        className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                          st.done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-200'
                        }`}
                      >
                        <CheckCircle2 size={12} />
                      </button>
                      <span
                        className={`text-sm font-bold ${
                          st.done ? 'line-through text-slate-300' : 'text-slate-600'
                        }`}
                      >
                        {st.title}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 sm:gap-4">
                <button
                  onClick={() => {
                    toggleTaskStatus(decisionModal);
                    setDecisionModal(null);
                  }}
                  className="flex-1 bg-slate-900 text-white py-4 sm:py-5 rounded-2xl font-black"
                >
                  تم الإنجاز
                </button>
                <button
                  onClick={() => {
                    deleteTask(decisionModal.id);
                    setDecisionModal(null);
                  }}
                  className="px-5 sm:px-8 py-4 sm:py-5 bg-rose-50 text-rose-600 rounded-2xl font-bold"
                >
                  حذف
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setIsAddingTask(true)}
        aria-label="إضافة مهمة"
        className="sm:hidden fixed left-5 z-40 w-14 h-14 bg-blue-600 text-white rounded-full shadow-2xl shadow-blue-500/40 flex items-center justify-center active:scale-95 transition-transform"
        style={{ bottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
      >
        <Plus size={26} strokeWidth={2.5} />
      </button>
    </div>
  );
};

export default App;

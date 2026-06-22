import React, { useState, useEffect } from 'react';
import type { AiVideoProps, JpStockItem, SubtitleLine } from '../types';

// ── 样式常量（匹配 index.html 暗色主题）──
const S = {
  panel: {
    width: 320, height: '100%', background: '#0a1525',
    borderLeft: '1px solid rgba(255,255,255,0.07)',
    display: 'flex', flexDirection: 'column' as const, overflow: 'hidden',
    fontSize: 12, color: '#c5d0dc', fontFamily: 'system-ui, sans-serif',
  },
  scroll: { flex: 1, overflowY: 'auto' as const, padding: '6px 10px 60px' },
  section: {
    background: 'rgba(255,255,255,0.022)', border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 8, marginBottom: 8, overflow: 'hidden',
  },
  sectionHead: {
    fontSize: 10, fontWeight: 700, color: 'rgba(90,130,170,0.65)',
    textTransform: 'uppercase' as const, letterSpacing: 1.2,
    padding: '8px 12px 7px', display: 'flex', alignItems: 'center', gap: 7,
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    background: 'rgba(245,166,35,0.025)', cursor: 'pointer', userSelect: 'none' as const,
  },
  sectionBody: { padding: '10px 12px' },
  label: { fontSize: 11, color: 'rgba(90,130,170,0.75)', marginBottom: 3, display: 'block' },
  input: {
    width: '100%', background: 'rgba(6,12,24,0.8)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 7, color: '#c5d0dc', fontFamily: 'inherit',
    fontSize: 13, padding: '7px 10px', outline: 'none',
  },
  textarea: {
    width: '100%', background: 'rgba(6,12,24,0.8)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 7, color: '#c5d0dc', fontFamily: 'inherit',
    fontSize: 12, padding: '7px 10px', outline: 'none', resize: 'vertical' as const,
    lineHeight: 1.6, minHeight: 56,
  },
  select: {
    width: '100%', background: 'rgba(6,12,24,0.8)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 7, color: '#c5d0dc', fontFamily: 'inherit',
    fontSize: 13, padding: '7px 10px', outline: 'none', cursor: 'pointer',
  },
  row: { display: 'flex', gap: 8, marginTop: 8 },
  field: { flex: 1 },
  slider: {
    width: '100%', height: 4, appearance: 'auto' as const,
    background: 'rgba(26,45,69,0.8)', borderRadius: 2, outline: 'none', cursor: 'pointer',
  },
  stockCard: {
    background: 'rgba(6,12,24,0.5)', border: '1px solid rgba(255,255,255,0.06)',
    borderRadius: 6, padding: '8px 10px', marginTop: 6,
  },
  stockHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 6, fontSize: 11, fontWeight: 600,
  },
  btnSmall: {
    background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 5, color: 'rgba(90,130,170,0.7)', fontSize: 11, padding: '3px 8px',
    cursor: 'pointer',
  },
  btnAccent: {
    background: 'linear-gradient(135deg,#4da3ff,#2d7fe0)', border: 'none',
    borderRadius: 7, color: '#fff', fontSize: 12, fontWeight: 600,
    padding: '8px 16px', cursor: 'pointer', width: '100%',
  },
  btnDanger: {
    background: 'rgba(220,50,50,0.15)', border: '1px solid rgba(220,50,50,0.3)',
    borderRadius: 5, color: '#e06060', fontSize: 11, padding: '3px 8px', cursor: 'pointer',
  },
  tplItem: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '6px 8px', borderRadius: 5, cursor: 'pointer',
    border: '1px solid rgba(255,255,255,0.06)', marginTop: 4,
    background: 'rgba(6,12,24,0.5)', fontSize: 12,
  },
};

const STOCK_SCENES = [
  { id: 'JpStockScene', name: '标准卡片' },
  { id: 'AiRankCard', name: 'AI 排行榜' },
  { id: 'AiDeepCard', name: 'AI 深度分析' },
  { id: 'JpBroadcastStockScene', name: '速报卡片' },
  { id: 'JpInsightStockScene', name: '研报卡片' },
  { id: 'JpSectorStockScene', name: '板块卡片' },
  { id: 'JpReportStockScene', name: '组合卡片' },
];

const THEMES = [
  { id: 'JP_PRIME', name: '蓝·冷调' },
  { id: 'JP_BROADCAST', name: '橙·速报' },
  { id: 'JP_REPORT', name: '薄荷·稳健' },
  { id: 'JP_INSIGHT', name: '青·研报' },
  { id: 'JP_SECTOR', name: '紫·题材' },
  { id: 'JP_NISA_OVERLAY', name: '红金·NISA' },
];

const PROC_BGS = [
  { id: 'theme', name: '跟随皮肤默认' },
  { id: 'JpPrimeBg', name: '蓝·冷调' },
  { id: 'JpBroadcastBg', name: '橙·速报' },
  { id: 'JpReportBg', name: '薄荷·组合' },
  { id: 'JpInsightBg', name: '青·研报' },
  { id: 'JpSectorBg', name: '紫·板块' },
];

// 标题/正文字体（Windows 自带，渲染器可用，避免渲染时字体缺失回退）
const SANS_FONTS = [
  { v: '', name: '默认（Noto Sans JP）' },
  { v: "'Yu Gothic UI','Yu Gothic',sans-serif", name: '游ゴシック（Yu Gothic）' },
  { v: "'Meiryo',sans-serif", name: 'メイリオ（Meiryo）' },
  { v: "'BIZ UDPGothic',sans-serif", name: 'BIZ UDPゴシック（沉稳）' },
  { v: "'MS PGothic','MS Gothic',sans-serif", name: 'ＭＳ Pゴシック（复古）' },
  { v: "'Yu Mincho','YuMincho',serif", name: '游明朝（Yu Mincho·明朝体）' },
  { v: "'BIZ UDPMincho',serif", name: 'BIZ UDP明朝（明朝体）' },
];
// 数字/代码字体（默认等宽 Roboto Mono）
const MONO_FONTS = [
  { v: '', name: '默认（Roboto Mono 等宽）' },
  { v: "'Consolas',monospace", name: 'Consolas' },
  { v: "'Cascadia Mono','Consolas',monospace", name: 'Cascadia Mono' },
  { v: "'Yu Gothic UI',sans-serif", name: '跟随正文（非等宽）' },
];

interface Template {
  name: string;
  file: string;
  createdAt?: string;
}

// ── 折叠区块 ──
const Section: React.FC<{ icon: string; title: string; children: React.ReactNode; defaultOpen?: boolean }> = ({ icon, title, children, defaultOpen = true }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={S.section}>
      <div style={S.sectionHead} onClick={() => setOpen(!open)}>
        <span style={{ fontSize: 13 }}>{icon}</span>
        <span>{title}</span>
        <span style={{ marginLeft: 'auto', fontSize: 10 }}>{open ? '▾' : '▸'}</span>
      </div>
      {open && <div style={S.sectionBody}>{children}</div>}
    </div>
  );
};

// ── 字段组件 ──
const Field: React.FC<{ label: string; children: React.ReactNode; style?: React.CSSProperties }> = ({ label, children, style }) => (
  <div style={{ marginTop: 8, ...style }}>
    <label style={S.label}>{label}</label>
    {children}
  </div>
);

const DurSlider: React.FC<{ label: string; value: number; min?: number; max?: number; onChange: (v: number) => void }> = ({ label, value, min = 30, max = 600, onChange }) => (
  <div style={{ marginTop: 8 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <label style={S.label}>{label}</label>
      <span style={{ fontSize: 11, color: '#f0c060' }}>{(value / 30).toFixed(1)}s ({value}f)</span>
    </div>
    <input type="range" min={min} max={max} step={1} value={value} onChange={e => onChange(+e.target.value)} style={S.slider} />
  </div>
);

// ── 股票编辑卡片 ──
const StockItemEditor: React.FC<{
  index: number; stock: JpStockItem; isMystery?: boolean;
  onChange: (s: JpStockItem) => void; onRemove: () => void;
}> = ({ index, stock, isMystery, onChange, onRemove }) => {
  const upd = (k: keyof JpStockItem, v: string) => onChange({ ...stock, [k]: v });
  return (
    <div style={S.stockCard}>
      <div style={S.stockHeader}>
        <span style={{ color: isMystery ? '#f0c060' : '#6b8aaf' }}>
          {isMystery ? '🔮 神秘股' : `#${index + 1}`}
        </span>
        <button style={S.btnDanger} onClick={onRemove}>删除</button>
      </div>
      <div style={S.row}>
        <div style={S.field}>
          <label style={S.label}>代码</label>
          <input style={S.input} value={stock.code} onChange={e => upd('code', e.target.value)} placeholder="7974" />
        </div>
        <div style={S.field}>
          <label style={S.label}>名称</label>
          <input style={S.input} value={stock.name} onChange={e => upd('name', e.target.value)} placeholder="任天堂" />
        </div>
      </div>
      <div style={S.row}>
        <div style={S.field}>
          <label style={S.label}>买入价</label>
          <input style={S.input} value={stock.buyPrice} onChange={e => upd('buyPrice', e.target.value)} placeholder="8,900円" />
        </div>
        <div style={S.field}>
          <label style={S.label}>涨幅</label>
          <input style={S.input} value={stock.pct} onChange={e => upd('pct', e.target.value)} placeholder="+50%" />
        </div>
      </div>
      <div style={S.row}>
        <div style={S.field}>
          <label style={S.label}>目标价</label>
          <input style={S.input} value={stock.targetPrice || ''} onChange={e => upd('targetPrice', e.target.value)} placeholder="13,400円" />
        </div>
        <div style={S.field}>
          <label style={S.label}>板块</label>
          <input style={S.input} value={stock.sector || ''} onChange={e => upd('sector', e.target.value)} placeholder="ゲーム" />
        </div>
      </div>
      <Field label="解说（屏幕显示）">
        <textarea style={S.textarea} value={stock.note} onChange={e => upd('note', e.target.value)} rows={2} />
      </Field>
      <Field label="旁白（配音用·出片必填）">
        <textarea style={S.textarea} value={stock.ttsText || ''} onChange={e => upd('ttsText', e.target.value)} rows={2}
          placeholder="留空则出片时自动用解说文" />
      </Field>
    </div>
  );
};

// ── 主面板 ──
export const EditorPanel: React.FC<{
  props: AiVideoProps;
  onChange: (patch: Partial<AiVideoProps>) => void;
}> = ({ props, onChange }) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [tplName, setTplName] = useState('');
  const [genMsg, setGenMsg] = useState('');
  const script = props.script || { title: '', stocks: [], ctaLineId: '', ctaText: '' };
  const stocks = script.stocks || [];

  useEffect(() => { loadTemplates(); }, []);

  async function loadTemplates() {
    try {
      const r = await fetch('/api/templates');
      if (r.ok) setTemplates(await r.json());
    } catch {}
  }

  async function saveTemplate() {
    const name = tplName.trim();
    if (!name) return;
    try {
      const r = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, props }),
      });
      if (r.ok) { setTplName(''); loadTemplates(); }
    } catch {}
  }

  async function loadTemplate(file: string) {
    try {
      const r = await fetch(`/api/templates/${encodeURIComponent(file)}`);
      if (r.ok) {
        const data = await r.json();
        if (data.props) onChange(data.props);
      }
    } catch {}
  }

  async function deleteTemplate(file: string) {
    try {
      await fetch(`/api/templates/${encodeURIComponent(file)}`, { method: 'DELETE' });
      loadTemplates();
    } catch {}
  }

  const updScript = (patch: Record<string, any>) => {
    onChange({ script: { ...script, ...patch } });
  };

  const updStock = (i: number, s: JpStockItem) => {
    const next = [...stocks];
    next[i] = s;
    updScript({ stocks: next });
  };

  const removeStock = (i: number) => {
    const next = stocks.filter((_, j) => j !== i);
    const durs = [...(props.stockDurations || [])];
    durs.splice(i, 1);
    onChange({ script: { ...script, stocks: next }, stockDurations: durs });
  };

  const addStock = () => {
    const next = [...stocks, { code: '', name: '', buyPrice: '', pct: '', note: '', sector: '' }];
    const durs = [...(props.stockDurations || []), 210];
    onChange({ script: { ...script, stocks: next }, stockDurations: durs });
  };

  const recalcDuration = (introDur: number, stockDurs: number[], ctaDur: number) => {
    return introDur + stockDurs.reduce((a, b) => a + b, 0) + ctaDur;
  };

  // 把编辑器内容转成生成管线要的 manualScript（旁白缺失时兜底，避免子进程硬退出）
  function buildManualScript() {
    const s: any = script;
    const stks = (s.stocks || []).map((st: JpStockItem) => ({
      ...st,
      ttsText: (st.ttsText && st.ttsText.trim()) || st.note || `${st.name}。${st.pct || ''}`.trim(),
    }));
    return {
      ...s,
      stocks: stks,
      introTts: (s.introTts && s.introTts.trim()) || s.title || '本日の注目銘柄をご紹介します。',
    };
  }

  function handleGenerate() {
    const gen = (window as any).generateFromEditor;
    if (typeof gen !== 'function') { setGenMsg('⚠ 生成功能未就绪（请刷新页面）'); return; }
    if (!stocks.length) { setGenMsg('⚠ 至少需要一只股票'); return; }
    const bg = props.bg && props.bg.type === 'procedural'
      ? { kind: 'procedural', id: (props.bg as any).id || 'theme' }
      : { kind: 'image' };
    gen({
      manualScript: buildManualScript(),
      themeId: props.themeId || 'JP_PRIME',
      stockSceneId: props.stockSceneId || 'JpStockScene',
      fontConfig: props.fontConfig || null,
      bg,
    });
    setGenMsg('✓ 已提交生成，进度见左栏「制作进度」');
  }

  return (
    <div style={S.panel}>
      <div style={{
        padding: '8px 12px', fontSize: 11, fontWeight: 700,
        color: '#f0c060', background: 'rgba(245,166,35,0.06)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        letterSpacing: 0.5,
      }}>
        属性编辑器
      </div>
      <div style={S.scroll}>

        {/* ── 生成 ── */}
        <div style={{ marginBottom: 8 }}>
          <button style={{ ...S.btnAccent, padding: '11px 16px', fontSize: 13,
            background: 'linear-gradient(135deg,#f0a830,#e0851a)' }} onClick={handleGenerate}>
            🎬 用当前编辑生成视频
          </button>
          {genMsg && (
            <div style={{ marginTop: 6, fontSize: 11, color: genMsg.startsWith('⚠') ? '#e0853a' : '#5fb87a', textAlign: 'center' }}>
              {genMsg}
            </div>
          )}
        </div>

        {/* ── 场景风格 ── */}
        <Section icon="🎨" title="场景风格">
          <Field label="结构">
            <select style={S.select} value={props.structure || 'standard'}
              onChange={e => onChange({ structure: e.target.value as any })}>
              <option value="standard">标准排行</option>
              <option value="portfolio">NISA 组合</option>
            </select>
          </Field>
          <Field label="主题配色">
            <select style={S.select} value={props.themeId || 'JP_PRIME'}
              onChange={e => onChange({ themeId: e.target.value })}>
              {THEMES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </Field>
          {props.structure !== 'portfolio' && (
            <Field label="股票卡片样式">
              <select style={S.select} value={props.stockSceneId || 'JpStockScene'}
                onChange={e => onChange({ stockSceneId: e.target.value })}>
                {STOCK_SCENES.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
          )}
          <Field label="背景">
            <select style={S.select}
              value={props.bg?.type === 'procedural' ? (props.bg.id || 'theme') : 'theme'}
              onChange={e => onChange({ bg: { type: 'procedural', id: e.target.value } })}>
              {PROC_BGS.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </Field>
        </Section>

        {/* ── 字体 ── */}
        <Section icon="🔤" title="字体">
          <Field label="标题 / 正文字体">
            <select style={S.select} value={props.fontConfig?.sans || ''}
              onChange={e => onChange({ fontConfig: { ...props.fontConfig, sans: e.target.value } })}>
              {SANS_FONTS.map(f => <option key={f.name} value={f.v}>{f.name}</option>)}
            </select>
          </Field>
          <Field label="数字 / 代码字体">
            <select style={S.select} value={props.fontConfig?.mono || ''}
              onChange={e => onChange({ fontConfig: { ...props.fontConfig, mono: e.target.value } })}>
              {MONO_FONTS.map(f => <option key={f.name} value={f.v}>{f.name}</option>)}
            </select>
          </Field>
          <div style={{ marginTop: 8, fontSize: 11, color: 'rgba(90,130,170,0.5)', lineHeight: 1.5 }}>
            预览与出片同步生效。仅限本机已装字体，避免渲染回退。
          </div>
        </Section>

        {/* ── 文案 ── */}
        <Section icon="📝" title="文案">
          <Field label="标题">
            <input style={S.input} value={script.title || ''}
              onChange={e => updScript({ title: e.target.value })} placeholder="今週激震！..." />
          </Field>
          <Field label="片头旁白（配音用·出片必填）">
            <textarea style={S.textarea} value={(script as any).introTts || ''}
              onChange={e => updScript({ introTts: e.target.value })} rows={2}
              placeholder="留空则出片时自动用标题" />
          </Field>
          <Field label="日期标注">
            <input style={S.input} value={script.dateStr || ''}
              onChange={e => updScript({ dateStr: e.target.value })} placeholder="2026年6月22日" />
          </Field>
          <Field label="CTA 文案">
            <textarea style={S.textarea} value={script.ctaText || ''}
              onChange={e => updScript({ ctaText: e.target.value })} rows={3} />
          </Field>
          <Field label="LINE ID">
            <input style={S.input} value={script.ctaLineId || ''}
              onChange={e => updScript({ ctaLineId: e.target.value })} placeholder="jpstock" />
          </Field>
        </Section>

        {/* ── 股票数据 ── */}
        <Section icon="📊" title={`股票数据 (${stocks.length})`}>
          {stocks.map((s, i) => (
            <StockItemEditor key={i} index={i} stock={s}
              isMystery={!s.name && s.code?.trim() === ''}
              onChange={ns => updStock(i, ns)}
              onRemove={() => removeStock(i)} />
          ))}
          <button style={{ ...S.btnSmall, marginTop: 8, width: '100%', textAlign: 'center' }} onClick={addStock}>
            + 添加股票
          </button>
        </Section>

        {/* ── 时间轴 ── */}
        <Section icon="⏱" title="时间轴">
          <DurSlider label="片头" value={props.introDur || 90}
            onChange={v => {
              const d = recalcDuration(v, props.stockDurations || [], props.ctaDur || 90);
              onChange({ introDur: v, durationInFrames: d });
            }} />
          {(props.stockDurations || []).map((dur, i) => (
            <DurSlider key={i} label={`股票 #${i + 1}`} value={dur}
              onChange={v => {
                const next = [...(props.stockDurations || [])];
                next[i] = v;
                const d = recalcDuration(props.introDur || 90, next, props.ctaDur || 90);
                onChange({ stockDurations: next, durationInFrames: d });
              }} />
          ))}
          <DurSlider label="CTA 结尾" value={props.ctaDur || 90}
            onChange={v => {
              const d = recalcDuration(props.introDur || 90, props.stockDurations || [], v);
              onChange({ ctaDur: v, durationInFrames: d });
            }} />
          <div style={{ marginTop: 8, fontSize: 11, color: '#6b8aaf', textAlign: 'right' }}>
            总时长: {((props.durationInFrames || 0) / 30).toFixed(1)}s ({props.durationInFrames}f)
          </div>
        </Section>

        {/* ── 模板 ── */}
        <Section icon="💾" title="模板">
          <div style={S.row}>
            <input style={{ ...S.input, flex: 1 }} value={tplName}
              onChange={e => setTplName(e.target.value)} placeholder="模板名称..."
              onKeyDown={e => e.key === 'Enter' && saveTemplate()} />
            <button style={{ ...S.btnAccent, width: 'auto', padding: '7px 14px' }} onClick={saveTemplate}>保存</button>
          </div>
          {templates.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {templates.map(t => (
                <div key={t.file} style={S.tplItem}>
                  <span style={{ cursor: 'pointer', flex: 1 }} onClick={() => loadTemplate(t.file)}>{t.name}</span>
                  <button style={{ ...S.btnDanger, marginLeft: 6 }} onClick={() => deleteTemplate(t.file)}>×</button>
                </div>
              ))}
            </div>
          )}
          {templates.length === 0 && (
            <div style={{ marginTop: 8, fontSize: 11, color: 'rgba(90,130,170,0.5)', textAlign: 'center' }}>
              暂无保存的模板
            </div>
          )}
        </Section>
      </div>
    </div>
  );
};

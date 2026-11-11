/* ============ LitBench layout: 侧栏折叠 + 拖拽调宽 ============
 *
 * 文献库的 rail 和阅读器的目录 side 共用一个控制器：
 *   - 右侧 7px 热区拖拽改宽度（双击恢复默认）
 *   - 顶栏 ◧ 按钮 / Ctrl(⌘)+B 收起，收起到左边缘只留一条窄把手，点它展开
 *   - 宽度和收起状态按 key 存 localStorage，下次打开还是你调好的样子
 */
(function () {
  const LB = window.LB;
  if (!LB) return;

  const DEFAULTS = { min: 168, max: 460 };
  const STORE = 'lb.panel.';
  const controllers = new WeakMap();

  function read(key, dflt) {
    try { const v = localStorage.getItem(key); return v == null || v === '' ? dflt : v; } catch (e) { return dflt; }
  }
  function write(key, v) {
    try {
      if (v == null) localStorage.removeItem(key);
      else localStorage.setItem(key, String(v));
    } catch (e) { }
  }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function tag(name, cls, html) {
    const n = document.createElement(name);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  function panelOf() {
    // 顶栏按钮固定管文献库 rail（常驻导航）；阅读器目录用自己右上的收起把手
    const rail = document.getElementById('rail');
    if (rail && controllers.get(rail)) return rail;
    const side = document.querySelector('.reader .side');
    if (side && controllers.get(side)) return side;
    return null;
  }

  function syncButton() {
    const btn = document.getElementById('btnPanel');
    if (!btn) return;
    const p = panelOf();
    const c = p ? controllers.get(p) : null;
    const off = !!(c && c.isCollapsed());
    btn.classList.toggle('off', off);
    btn.title = off ? '展开侧栏 (Ctrl+B)' : '收起侧栏 (Ctrl+B)';
    btn.setAttribute('aria-pressed', off ? 'false' : 'true');
  }
  LB.syncPanelButton = syncButton;

  LB.mountPanel = function (panel, options) {
    if (!panel) return null;
    const cached = controllers.get(panel);
    if (cached) return cached;

    const o = Object.assign({ key: 'side', min: DEFAULTS.min, max: DEFAULTS.max, edge: 'left' }, options || {});
    const right = o.edge === 'right';
    const base = parseFloat(getComputedStyle(panel).width) || 236;
    const dflt = Math.round(o.defaultWidth || base);
    const wKey = STORE + o.key + '.w';
    const hKey = STORE + o.key + '.hidden';

    let width = clamp(parseFloat(read(wKey, dflt)) || dflt, o.min, o.max);
    let collapsed = read(hKey, '0') === '1';
    let drag = null;

    const grip = tag('span', right ? 'lb-resizer lb-resizer-r' : 'lb-resizer');
    grip.title = '拖动调整宽度 · 双击恢复默认';
    // 收起把手：只给阅读器目录这种「没有顶栏按钮」的面板加，文献库用顶栏 ◧ 即可
    const fold = o.fold ? tag('button', 'lb-fold', right ? '&#187;' : '&laquo;') : null;
    if (fold) {
      fold.type = 'button';
      fold.title = '收起目录';
      fold.setAttribute('aria-label', '收起目录');
      fold.addEventListener('click', function () { setCollapsed(true); });
    }
    const tab = tag('button', right ? 'lb-edge-tab lb-edge-tab-r' : 'lb-edge-tab', right ? '&#171;' : '&#187;');
    tab.type = 'button';
    tab.title = '展开侧栏';
    tab.setAttribute('aria-label', '展开侧栏');
    const tip = tag('div', 'lb-resize-tip');

    function parentOf() { return panel.parentNode; }

    function mountChrome() {
      const p = parentOf();
      if (!p || panel.parentNode !== p) return;
      // 只在位置不对时才搬动节点：insertBefore 会触发 childList mutation，
      // 无条件重插会和下面的 MutationObserver 形成死循环（主线程卡死、页面不再响应）。
      if (grip.parentNode !== p || (right ? grip.nextSibling !== panel : grip.previousSibling !== panel)) {
        p.insertBefore(grip, right ? panel : panel.nextSibling);
      }
      if (fold) {
        const wantPrev = right ? panel : grip;
        if (fold.parentNode !== p || fold.previousSibling !== wantPrev) p.insertBefore(fold, wantPrev.nextSibling);
      }
      if (!tab.isConnected) p.appendChild(tab);
      if (!tip.isConnected) p.appendChild(tip);
      placeFold();
      placeTab();
    }

    function placeFold() {
      if (!fold || !fold.isConnected) return;
      // 左侧面板压在右上角（目录的 tab 行右侧是空的）；右侧面板压在左上角
      fold.style.left = (right
        ? panel.offsetLeft + 6
        : Math.max(2, panel.offsetLeft + panel.offsetWidth - 26)) + 'px';
      fold.style.top = (panel.offsetTop + 6) + 'px';
    }

    function placeTab() {
      if (!tab.isConnected) return;
      // 贴面板左边缘竖着放；两栏都收起时上下错开
      tab.style.top = (panel.offsetTop + 14) + 'px';
      const tabs = document.querySelectorAll('.lb-edge-tab.show');
      for (let i = 0; i < tabs.length; i++) {
        const other = tabs[i];
        if (other === tab) continue;
        const a = other.getBoundingClientRect(), b = tab.getBoundingClientRect();
        if (b.width && Math.abs(a.top - b.top) < 52 && Math.abs(a.left - b.left) < 24) {
          tab.style.top = (parseFloat(tab.style.top) + 54) + 'px';
        }
      }
    }

    function tipPos() {
      return right
        ? Math.max(6, grip.offsetLeft + grip.offsetWidth + 8)
        : Math.max(6, grip.offsetLeft - 38);
    }

    function applyWidth() {
      panel.style.width = width + 'px';
      panel.style.flex = '0 0 auto';
      if (grip.isConnected) tip.style.left = tipPos() + 'px';
      placeFold();
      placeTab();
    }

    function setCollapsed(v, persist) {
      collapsed = !!v;
      panel.classList.toggle('lb-collapsed', collapsed);
      panel.style.flex = '0 0 auto';
      panel.style.width = collapsed ? '0px' : width + 'px';
      grip.style.display = collapsed ? 'none' : '';
      if (fold) fold.style.display = collapsed ? 'none' : '';
      tab.classList.toggle('show', collapsed);
      if (!collapsed) requestAnimationFrame(function () { placeFold(); placeTab(); });
      if (persist !== false) write(hKey, collapsed ? '1' : '0');
      syncButton();
    }

    function setWidth(n, persist) {
      width = Math.round(clamp(n, o.min, o.max));
      if (!collapsed) applyWidth();
      if (persist !== false) write(wKey, width);
    }

    function onDown(e) {
      if (e.button !== 0) return;
      e.preventDefault();
      drag = { x: e.clientX, w: width };
      document.body.classList.add('lb-resizing');
      tip.textContent = width + ' px';
      tip.style.left = tipPos() + 'px';
      const shield = tag('div', 'lb-drag-shield');
      shield.id = 'lbDragShield';
      document.body.appendChild(shield);
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
      document.addEventListener('pointercancel', onUp);
    }
    function onMove(e) {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      setWidth(right ? drag.w - dx : drag.w + dx, false);
      tip.textContent = width + ' px';
    }
    function onUp() {
      if (!drag) return;
      drag = null;
      document.body.classList.remove('lb-resizing');
      const shield = document.getElementById('lbDragShield');
      if (shield && shield.parentNode) shield.parentNode.removeChild(shield);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
      write(wKey, width);
    }

    grip.addEventListener('pointerdown', onDown);
    grip.addEventListener('dblclick', function (e) {
      e.preventDefault();
      setWidth(dflt);
      tip.textContent = dflt + ' px';
      tip.style.left = tipPos() + 'px';
      document.body.classList.add('lb-resizing');
      setTimeout(function () { document.body.classList.remove('lb-resizing'); }, 420);
    });
    tab.addEventListener('click', function () { setCollapsed(false); });

    const ctl = {
      panel: panel,
      toggle: function () { setCollapsed(!collapsed); },
      setCollapsed: setCollapsed,
      setWidth: setWidth,
      isCollapsed: function () { return collapsed; },
      width: function () { return width; },
      defaultWidth: dflt
    };
    controllers.set(panel, ctl);

    // 父容器可能被重建（阅读器每次重开都重建），用 MutationObserver 保证把手还在。
    if (typeof MutationObserver === 'function') {
      const parent = parentOf();
      if (parent) {
        const mo = new MutationObserver(function () { mountChrome(); });
        mo.observe(parent, { childList: true });
        ctl._mo = mo;
      }
    }
    mountChrome();
    setCollapsed(collapsed, false);
    setWidth(width, false);
    window.addEventListener('resize', function () { placeFold(); placeTab(); });
    return ctl;
  };

  /* ---------- 顶栏按钮 + 快捷键 ---------- */
  LB.getPanel = function (p) { return (p && controllers.get(p)) || null; };

  const btn = document.getElementById('btnPanel');
  if (btn) {
    btn.addEventListener('click', function () {
      const p = panelOf();
      if (p) controllers.get(p).toggle();
    });
  }
  document.addEventListener('keydown', function (e) {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    if (String(e.key).toLowerCase() !== 'b') return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    const p = panelOf();
    if (!p) return;
    e.preventDefault();
    controllers.get(p).toggle();
  });
  window.addEventListener('resize', syncButton);
  syncButton();
})();

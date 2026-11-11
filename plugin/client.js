/**
 * dsh-litbench — browser half.
 *
 * 左侧栏注册一个「文献工作台」入口（书本图标），点开即在中央面板里
 * 内嵌 LitBench 自己的页面。iframe 与宿主同源，上传 / SSE / PDF Range
 * 都和独立标签页完全一样，前端不用改。
 */
window.__ModuleLoader__.load({
  id: 'dsh-litbench',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    var react = require('react');
    var h = react.createElement;

    var inject = ['slots'];
    var ROUTE = '/dsh-litbench';
    var PANEL_ID = 'litbench';
    var STYLE_ID = 'dsh-litbench-style';

    var CSS = [
      // 左侧栏面板：撑满宿主 main 槽位。宿主保证有确定高度，max-height 只是兜底。
      '.dsh-lb-panel{position:relative;height:100%;max-height:100vh;min-height:0;display:flex;',
      'box-sizing:border-box;overflow:hidden;background:var(--dsw-alias-bg-layer-1,#fbfaf7)}',
      '.dsh-lb-panel iframe{flex:1 1 auto;width:100%;height:100%;min-height:0;border:0;',
      'background:#fbfaf7;display:block}',
    ].join('');

    function ensureStyle() {
      var el = document.getElementById(STYLE_ID);
      if (el) return el;
      el = document.createElement('style');
      el.id = STYLE_ID;
      el.textContent = CSS;
      document.head.appendChild(el);
      return el;
    }

    // 左侧栏图标：宿主给 size（方块边长）和 active（当前是否选中）。
    // 用 currentColor 描边，跟随主题前景色，深色/浅色都不用另配。
    function LitbenchIcon(props) {
      var size = props && typeof props.size === 'number' ? props.size : 16;
      return h(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.7,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
        },
        h('path', { d: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H19v18H6.5A2.5 2.5 0 0 1 4 18.5z' }),
        h('path', { d: 'M4 17.5A2.5 2.5 0 0 1 6.5 15H19' }),
        h('path', { d: 'M8 7.5h7M8 11h5' })
      );
    }

    // 左侧栏点开的主面板：直接嵌工作台自己的页面。
    function LitbenchPanel() {
      return h(
        'div',
        { className: 'dsh-lb-panel' },
        h('iframe', {
          src: ROUTE + '/',
          title: 'LitBench 文献工作台',
          allow: 'clipboard-write',
        })
      );
    }

    function apply(ctx) {
      ensureStyle();
      ctx.effect(function () {
        return function () {
          var el = document.getElementById(STYLE_ID);
          if (el && el.parentNode) el.parentNode.removeChild(el);
        };
      }, 'dsh-litbench: style');

      // 左侧栏入口：panellist 的 id 就是 main 的 key，点图标切到对应中央面板。
      ctx.slots.inject('main', function () {
        return ctx.slots.register({ name: 'main', key: PANEL_ID }, LitbenchPanel);
      });
      ctx.slots.inject('sidebar.panellist', function () {
        return ctx.slots.register(
          {
            name: 'sidebar.panellist',
            id: PANEL_ID,
            order: 30,
            label: function () {
              return '文献工作台';
            },
          },
          LitbenchIcon
        );
      });
    }

    exports.apply = apply;
    exports.inject = inject;
    return module.exports;
  },
});

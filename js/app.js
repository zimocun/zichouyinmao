/* 子丑寅卯 —— 万年历 + 黄历 */
(function () {
  'use strict';

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var WEEK = ['日', '一', '二', '三', '四', '五', '六'];

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ymd(s) { return s.getYear() + '-' + pad(s.getMonth()) + '-' + pad(s.getDay()); }
  function parseYmd(str) { var a = str.split('-'); return Solar.fromYmd(+a[0], +a[1], +a[2]); }
  function today() { var n = new Date(); return Solar.fromYmd(n.getFullYear(), n.getMonth() + 1, n.getDate()); }
  function dayNum(s) { return Date.UTC(s.getYear(), s.getMonth() - 1, s.getDay()) / 86400000; }
  function diffDays(a, b) { return dayNum(b) - dayNum(a); }
  function lunarText(l) { return l.getMonthInChinese() + '月' + l.getDayInChinese(); }

  function isoWeek(s) {
    var d = new Date(Date.UTC(s.getYear(), s.getMonth() - 1, s.getDay()));
    var wd = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - wd);
    var y0 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d - y0) / 86400000 + 1) / 7);
  }

  function cnNum(n) {
    var D = '零一二三四五六七八九', U = ['', '十', '百', '千'], s = String(n), out = '', zero = false;
    for (var i = 0; i < s.length; i++) {
      var c = +s[i], p = s.length - 1 - i;
      if (c === 0) { zero = true; continue; }
      if (zero && out) out += '零';
      zero = false;
      out += D[c] + U[p];
    }
    return out.replace(/^一十/, '十');
  }

  function relText(n) {
    if (n === 0) return '今天';
    if (n === 1) return '明天';
    if (n === -1) return '昨天';
    return n > 0 ? n + '天后' : (-n) + '天前';
  }

  // iOS 主屏幕全屏模式下，页面高度会少算状态栏那一截，底部留出空白；用屏幕实际高度撑满
  function fitHeight() {
    var h = window.innerHeight;
    if (window.navigator.standalone) {
      var land = Math.abs(window.orientation || 0) === 90;
      var sh = land ? Math.min(screen.width, screen.height) : Math.max(screen.width, screen.height);
      if (sh > h) h = sh;
    }
    document.documentElement.style.setProperty('--apph', h + 'px');
  }
  fitHeight();
  window.addEventListener('resize', fitHeight);
  window.addEventListener('orientationchange', function () { setTimeout(fitHeight, 300); });

  // 标题栏固定在上方，下面的内容单独滚动；重画时保留滚动位置
  function paint(v, head, body) {
    var old = v.querySelector('.scroll'), st = old ? old.scrollTop : 0;
    v.innerHTML = head + '<div class="scroll">' + body + '</div>';
    v.querySelector('.scroll').scrollTop = st;
  }

  function scrollTop(tab) {
    var sc = $('#v-' + tab + ' .scroll');
    if (sc) sc.scrollTop = 0;
  }

  var toastTimer;
  function toast(msg) {
    var t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 1800);
  }

  // ---------- 状态 ----------
  var T = today();
  var S = { tab: 'cal', sel: T, vy: T.getYear(), vm: T.getMonth(), seg: 'day', modern: false };

  function setSel(s, keepView) {
    S.sel = s;
    if (!keepView) { S.vy = s.getYear(); S.vm = s.getMonth(); }
  }

  // ---------- 单日信息 ----------
  // 公历节日只留常用的
  var SOLAR_FEST = { '元旦节': '元旦', '情人节': 1, '妇女节': 1, '植树节': 1, '劳动节': 1, '青年节': 1, '儿童节': 1,
    '建党节': 1, '建军节': 1, '教师节': 1, '国庆节': 1, '平安夜': 1, '圣诞节': 1, '母亲节': 1, '父亲节': 1 };

  function festOf(s, l) {
    var a = [];
    l.getFestivals().forEach(function (f) { a.push(f); });
    s.getFestivals().forEach(function (f) {
      var v = SOLAR_FEST[f];
      if (v) a.push(v === 1 ? f : v);
    });
    return a;
  }

  function cellLabel(s, l) {
    var jq = l.getJieQi();
    if (jq) return { t: jq, c: 'jq' };
    var f = festOf(s, l);
    if (f.length) return { t: f[0].length > 4 ? f[0].slice(0, 4) : f[0], c: 'fest' };
    if (l.getDay() === 1) return { t: l.getMonthInChinese() + '月', c: '' };
    return { t: l.getDayInChinese(), c: '' };
  }

  function holidayOf(s) {
    return HolidayUtil.getHoliday(s.getYear(), s.getMonth(), s.getDay());
  }

  // 四柱干支跟随手机时间与时区：
  // 日柱、时柱按手机当地钟点，23点（子时）起换为次日日柱（八字、六爻的习惯）；年柱（立春为界）、月柱（节气为界）比较的是同一时刻，
  // 历法库的节气时刻是北京时间，所以先把当地时刻换算成北京时间再判断。
  // 某地当地时刻（offMin 为该地相对 UTC 的分钟数）的四柱
  function pillarsAt(y, m, d, h, mi, offMin) {
    var bj = new Date(Date.UTC(y, m - 1, d, h, mi) + (480 - offMin) * 60000);
    var lb = Solar.fromYmdHms(bj.getUTCFullYear(), bj.getUTCMonth() + 1, bj.getUTCDate(), bj.getUTCHours(), bj.getUTCMinutes(), 0).getLunar();
    var ll = Solar.fromYmdHms(y, m, d, h, mi, 0).getLunar();
    return { y: lb.getYearInGanZhiExact(), m: lb.getMonthInGanZhiExact(), d: ll.getDayInGanZhiExact(), t: ll.getTimeInGanZhi() };
  }

  function pillars(s) {
    var n = new Date();
    var h = n.getHours(), mi = n.getMinutes();
    var off = -new Date(s.getYear(), s.getMonth() - 1, s.getDay(), h, mi).getTimezoneOffset();
    return pillarsAt(s.getYear(), s.getMonth(), s.getDay(), h, mi, off);
  }

  function gz4(s, l, sep) {
    sep = sep || ' ';
    var p = pillars(s);
    return p.y + '年' + sep + p.m + '月' + sep + p.d + '日' + sep + p.t + '时';
  }

  function tzKey() {
    var tz = '';
    try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) {}
    return tz + '|' + new Date().getTimezoneOffset();
  }

  function clockText() {
    var n = new Date(), off = -n.getTimezoneOffset();
    var oh = Math.floor(Math.abs(off) / 60), om = Math.abs(off) % 60;
    var utc = 'UTC' + (off >= 0 ? '+' : '-') + oh + (om ? ':' + pad(om) : '');
    var tz = '';
    try { tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || '').split('/').pop().replace(/_/g, ' '); } catch (e) {}
    return '按手机时间 ' + pad(n.getHours()) + ':' + pad(n.getMinutes()) + ' · ' + (tz ? tz + ' ' : '') + utc +
      (n.getHours() === 23 ? ' · 已入子时，日柱按次日' : '');
  }

  function chongSha(l) {
    return l.getDayShengXiao() + '日冲' + l.getDayChongShengXiao() + ' 煞' + l.getDaySha();
  }

  function nowHourIndex() {
    var h = new Date().getHours();
    return Math.floor(((h + 1) % 24) / 2);
  }

  // ---------- 万年历 ----------
  function renderCal(anim) {
    var v = $('#v-cal');
    var y = S.vy, m = S.vm;
    var first = Solar.fromYmd(y, m, 1);
    var lead = first.getWeek();
    var days = SolarUtil.getDaysOfMonth(y, m);
    var rows = Math.ceil((lead + days) / 7);
    var start = first.next(-lead);
    var tStr = ymd(T), sStr = ymd(S.sel);

    var cells = '';
    for (var i = 0; i < rows * 7; i++) {
      var s = start.next(i), l = s.getLunar(), key = ymd(s);
      var cls = 'cell';
      if (s.getMonth() !== m) cls += ' other';
      var w = s.getWeek();
      if (w === 0 || w === 6) cls += ' we';
      if (key === tStr) cls += ' today';
      if (key === sStr) cls += ' sel';
      var lb = cellLabel(s, l);
      var hd = holidayOf(s), badge = '';
      if (hd) badge = hd.isWork() ? '<i class="bd work">班</i>' : '<i class="bd rest">休</i>';
      cells += '<div class="' + cls + '" data-d="' + key + '"><span class="n">' + s.getDay() +
        '</span><span class="l ' + lb.c + '">' + lb.t + '</span>' + badge + '</div>';
    }

    var wk = '';
    for (var k = 0; k < 7; k++) wk += '<span' + (k === 0 || k === 6 ? ' class="we"' : '') + '>' + WEEK[k] + '</span>';

    var showToday = !(y === T.getYear() && m === T.getMonth() && sStr === tStr);

    paint(v,
      '<header class="topbar">' +
        '<span class="ib"></span>' +
        '<label class="mtitle">' + y + '年' + m + '月<i class="caret"></i>' +
          '<input type="month" id="monthInput" value="' + y + '-' + pad(m) + '"></label>' +
        (showToday ? '<button class="ib" data-act="today"><span class="today-btn" style="display:flex;align-items:center;justify-content:center">今</span></button>' : '<span class="ib"></span>') +
      '</header>',
      installTip() +
      '<div class="wk">' + wk + '</div>' +
      '<div class="grid' + (anim ? ' slide-' + anim : '') + '" id="calGrid">' + cells + '</div>' +
      detailHtml(S.sel) +
      upcomingHtml());
  }

  function detailHtml(s) {
    var l = s.getLunar();
    var gz = gz4(s, l);
    var yi = l.getDayYi().slice(0, 5).join(' '), ji = l.getDayJi().slice(0, 3).join(' ');
    var tags = '';
    var jq = l.getJieQi();
    if (jq) tags += '<span class="tag g">' + jq + '</span>';
    festOf(s, l).forEach(function (f) { tags += '<span class="tag">' + f + '</span>'; });
    var hd = holidayOf(s);
    if (hd) tags += '<span class="tag' + (hd.isWork() ? '' : ' g') + '">' + hd.getName() + (hd.isWork() ? ' · 补班' : ' · 放假') + '</span>';
    var n = diffDays(T, s);
    return '<div class="detail" data-act="goAlm">' +
      '<div class="d-top"><div class="d-lunar">' + lunarText(l) + '</div>' +
      '<div class="d-rel"><b>' + relText(n) + '</b>' + s.getYear() + '年' + s.getMonth() + '月' + s.getDay() + '日</div></div>' +
      '<div class="d-line">' + s.getXingZuo() + '座　' + gz + '〔属' + l.getYearShengXiao() + '〕</div>' +
      '<div class="d-line">第' + isoWeek(s) + '周 周' + WEEK[s.getWeek()] +
        '<span class="yi">宜</span>' + yi + '<span class="ji">忌</span>' + ji + '</div>' +
      (tags ? '<div class="tags">' + tags + '</div>' : '') +
      '</div>';
  }

  function upcomingHtml() {
    var list = [], seenHoliday = {};
    for (var i = 1; i <= 75 && list.length < 7; i++) {
      var s = T.next(i), l = s.getLunar(), names = [];
      var jq = l.getJieQi();
      if (jq) names.push(jq);
      festOf(s, l).forEach(function (f) { if (names.indexOf(f) < 0) names.push(f); });
      var hd = holidayOf(s);
      if (hd && !hd.isWork() && !seenHoliday[hd.getName() + hd.getTarget()]) {
        seenHoliday[hd.getName() + hd.getTarget()] = 1;
        var hn = hd.getName() + '假期';
        names.push(hn);
      }
      if (names.length) list.push({ s: s, l: l, n: names.join(' · '), d: i });
    }
    if (!list.length) return '';
    var rows = list.map(function (o) {
      return '<div class="up-row" data-d="' + ymd(o.s) + '"><div class="nm">' + o.n +
        '<small>' + o.s.getMonth() + '月' + o.s.getDay() + '日 周' + WEEK[o.s.getWeek()] + ' · ' + lunarText(o.l) + '</small></div>' +
        '<div class="cnt">还有<b>' + o.d + '</b>天</div></div>';
    }).join('');
    return '<div class="card"><h3>近期节日节气</h3>' + rows + '</div>';
  }

  function installTip() {
    var standalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
    var dismissed = false;
    try { dismissed = localStorage.getItem('zcym.tip') === '1'; } catch (e) {}
    if (standalone || dismissed) return '';
    return '<div class="install">在 Safari 里点底部的 <b>分享</b> 按钮 <span style="font-size:16px">⎋</span>，' +
      '再选 <b>“添加到主屏幕”</b>，就能像 App 一样从桌面打开，离线也能用。' +
      '<button class="x" data-act="hideTip">×</button></div>';
  }

  // ---------- 黄历 ----------
  function renderAlm(anim) {
    var v = $('#v-alm');
    var s = S.sel, l = s.getLunar();
    var head =
      '<header class="topbar">' +
        '<button class="ib" data-act="today" aria-label="回到今天"><span class="today-btn" style="display:flex;align-items:center;justify-content:center">今</span></button>' +
        '<div class="seg"><button data-act="seg" data-v="day" class="' + (S.seg === 'day' ? 'on' : '') + '">黄历</button>' +
        '<button data-act="seg" data-v="hour" class="' + (S.seg === 'hour' ? 'on' : '') + '">时辰</button></div>' +
        '<button class="ib" data-act="share" aria-label="分享"><svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6"/><path d="M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg></button>' +
      '</header>';

    var top =
      '<div class="alm-date"><label class="dpick">' + s.getYear() + '年' + s.getMonth() + '月' + s.getDay() + '日<i class="caret"></i>' +
        '<input type="date" id="dateInput" value="' + ymd(s) + '"></label>' +
        '<button class="gold-btn" data-act="zeji">吉日查询</button></div>' +
      '<div class="alm-big" id="almBig"><button class="arr" data-act="prevDay" aria-label="前一天">' + arrow('l') + '</button>' +
        '<div class="big">' + lunarText(l) + '</div>' +
        '<button class="arr" data-act="nextDay" aria-label="后一天">' + arrow('r') + '</button></div>' +
      '<div class="alm-gz">' + gz4(s, l) + '<br>〔属' + l.getYearShengXiao() + '〕周' + WEEK[s.getWeek()] + '　第' + isoWeek(s) + '周</div>' +
      '<div class="clock" id="clock">' + clockText() + '</div>';

    paint(v, head, top + (S.seg === 'day' ? almDay(s, l) : almHours(s, l)));
    if (anim) {
      var b = $('#almBig .big');
      b.style.animation = 'slide' + (anim === 'l' ? 'L' : 'R') + ' .22s ease-out';
    }
  }

  function arrow(d) {
    return '<svg viewBox="0 0 24 24" width="30" height="30"><path d="' + (d === 'l' ? 'M15 4l-8 8l8 8' : 'M9 4l8 8l-8 8') +
      '" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  function words(a) { return a.map(function (x) { return '<span>' + x + '</span>'; }).join(''); }

  function almDay(s, l) {
    var isT = ymd(s) === ymd(T), cur = isT && new Date().getHours() !== 23 ? nowHourIndex() : -1;
    var hs = l.getTimes().slice(0, 12).map(function (t, i) {
      var gz = t.getGanZhi(), luck = t.getTianShenLuck();
      return '<div class="h' + (luck === '吉' ? '' : ' ji') + (i === cur ? ' now' : '') + '"><i>' + gz[0] + '</i><i>' + gz[1] + '</i><i>' + luck + '</i></div>';
    }).join('');

    var tai = l.getDayPositionTai().split(' ');
    var html =
      '<div class="yj"><span class="pill yi">宜</span><p>' + words(l.getDayYi()) + '</p></div>' +
      '<div class="yj"><span class="pill ji">忌</span><p>' + words(l.getDayJi()) + '</p></div>' +
      '<div class="tbl">' +
        '<div class="r hd">黄帝纪元' + cnNum(l.getYear() + 2697) + '年</div>' +
        '<div class="r r3"><div><b>五行</b>' + l.getDayNaYin() + '</div><div><b>冲煞</b>' + chongSha(l) + '</div><div><b>值神</b>' + l.getDayTianShen() + '</div></div>' +
        '<div class="r hours"><div class="lb">时辰<br>宜忌</div><div class="hs">' + hs + '</div></div>' +
        '<div class="r g3">' +
          '<div class="side"><span class="t2">建除十二神</span><span>' + l.getZhiXing() + '日</span></div>' +
          '<div class="top ws"><div class="tt">吉神宜趋</div>' + words(l.getDayJiShen()) + '</div>' +
          '<div class="top"><div class="tt">今日胎神</div>' + tai.join('<br>') + '</div>' +
          '<div class="top ws"><div class="tt">凶神宜忌</div>' + words(l.getDayXiongSha()) + '</div>' +
          '<div class="side"><span class="t2">二十八星宿</span><span>' + l.getXiu() + l.getZheng() + l.getAnimal() + ' ' + l.getXiuLuck() + '</span></div>' +
          '<div class="wide"><div class="tt">彭祖百忌</div>' + l.getPengZuGan() + ' ' + l.getPengZuZhi() + '</div>' +
        '</div>' +
        '<button class="modern-btn" data-act="modern"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M2 12s3.6-7 10-7s10 7 10 7s-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>' +
          (S.modern ? '收起现代文' : '查看现代文') + '</button>' +
        (S.modern ? modernHtml(l) : '') +
      '</div>';
    return html;
  }

  function dl(list) {
    return '<dl>' + list.map(function (t) {
      return '<dt>' + t + '</dt><dd>' + (ZD.yiji[t] || '—') + '</dd>';
    }).join('') + '</dl>';
  }

  function modernHtml(l) {
    var ts = l.getDayTianShen(), zx = l.getZhiXing();
    var pz = l.getDayGan(), pzz = l.getDayZhi();
    return '<div class="modern">' +
      '<h4>宜</h4>' + dl(l.getDayYi()) +
      '<h4>忌</h4>' + dl(l.getDayJi()) +
      '<h4>冲煞</h4><p>' + (ymd(S.sel) === ymd(T) ? '今' : '当') + '日日支为' + l.getDayZhi() + '（' + l.getDayShengXiao() + '），与' + l.getDayChong() + '（' + l.getDayChongShengXiao() +
        '）相冲，属' + l.getDayChongShengXiao() + '的人当天行事宜多加留意；煞' + l.getDaySha() + '，即当天不宜朝' + l.getDaySha() + '方办重要的事。</p>' +
      '<h4>值神 · 建除</h4><p><em>' + ts + '（' + l.getDayTianShenType() + '）</em>：' + (ZD.tianshen[ts] || '') + '</p>' +
        '<p><em>' + zx + '日</em>：' + (ZD.zhixing[zx] || '') + '</p>' +
      '<h4>彭祖百忌</h4><p>' + (ZD.pengzu[pz] || '') + '；' + (ZD.pengzu[pzz] || '') + '。</p>' +
      '<h4>胎神</h4><p>胎神是传统中护佑胎儿的神，当天在“' + l.getDayPositionTai() + '”。家中有孕妇时，当日不宜在这些位置动土、钉补、搬移重物。</p>' +
      '<h4>喜神 · 财神 · 福神</h4><p>喜神' + l.getDayPositionXiDesc() + '，财神' + l.getDayPositionCaiDesc() + '，福神' + l.getDayPositionFuDesc() +
        '；阳贵人' + l.getDayPositionYangGuiDesc() + '，阴贵人' + l.getDayPositionYinGuiDesc() + '。</p>' +
      '</div>';
  }

  function almHours(s, l) {
    var isT = ymd(s) === ymd(T), cur = isT && new Date().getHours() !== 23 ? nowHourIndex() : -1;
    var NAMES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
    var rows = l.getTimes().slice(0, 12).map(function (t, i) {
      var luck = t.getTianShenLuck();
      var st = (i * 2 + 23) % 24, en = (st + 2) % 24;
      return '<div class="hrow' + (i === cur ? ' now' : '') + '">' +
        '<div class="hl"><div class="gz">' + t.getGanZhi() + '</div><div class="tm">' + NAMES[i] + '时 ' + pad(st) + ':00-' + pad(en) + ':00</div>' +
          '<span class="lk ' + (luck === '吉' ? 'ji' : 'xiong') + '">' + luck + '</span></div>' +
        '<div class="hr"><div class="ts">' + t.getTianShen() + '（' + t.getTianShenType() + '）　冲' + t.getChongShengXiao() + ' 煞' + t.getSha() +
          (i === cur ? '　<span style="color:var(--gold)">当前时辰</span>' : '') + '</div>' +
          '<div><span class="y">宜</span>' + t.getYi().join(' ') + '</div>' +
          '<div><span class="j">忌</span>' + t.getJi().join(' ') + '</div>' +
          '<div style="color:var(--text3);font-size:12.5px">喜神' + t.getPositionXiDesc() + ' 财神' + t.getPositionCaiDesc() + ' 福神' + t.getPositionFuDesc() + '</div>' +
        '</div></div>';
    }).join('');
    return '<div style="margin-top:12px;background:var(--card)">' + rows + '</div>' +
      '<div class="hnote">子时按 23:00–00:59 计；时辰吉凶依黄道、黑道值神而定。</div>';
  }

  function share() {
    var s = S.sel, l = s.getLunar();
    var txt = s.getYear() + '年' + s.getMonth() + '月' + s.getDay() + '日 周' + WEEK[s.getWeek()] + '\n农历' + lunarText(l) + ' ' +
      gz4(s, l) + '\n宜：' + l.getDayYi().join(' ') +
      '\n忌：' + l.getDayJi().join(' ') + '\n冲煞：' + chongSha(l) + '　值神：' + l.getDayTianShen();
    if (navigator.share) {
      navigator.share({ title: '子丑寅卯 · 黄历', text: txt }).catch(function () {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(txt).then(function () { toast('已复制到剪贴板'); });
    }
  }

  // ---------- 吉日查询 ----------
  var Z = { ev: 0, range: 60, avoid: '', weekend: false, hd: false };
  var SX = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];

  function openZeji() {
    $('#pageTitle').textContent = '吉日查询';
    renderZeji();
    var p = $('#page');
    p.classList.add('open');
    p.setAttribute('aria-hidden', 'false');
    history.pushState({ page: 'zeji' }, '');
  }

  function closePage(fromPop) {
    var p = $('#page');
    if (!p.classList.contains('open')) return;
    p.classList.remove('open');
    p.setAttribute('aria-hidden', 'true');
    if (!fromPop && history.state && history.state.page) history.back();
  }

  function renderZeji() {
    var ev = ZD.events[Z.ev], terms = ev[1];
    var chips = ZD.events.map(function (e, i) {
      return '<button class="chip' + (i === Z.ev ? ' on' : '') + '" data-act="zev" data-v="' + i + '">' + e[0] + '</button>';
    }).join('');
    var ranges = [30, 60, 90, 180, 365].map(function (r) {
      return '<button class="chip' + (r === Z.range ? ' on' : '') + '" data-act="zrange" data-v="' + r + '">' + (r === 365 ? '一年' : r + '天') + '</button>';
    }).join('');
    var avoid = ['', ].concat(SX).map(function (x) {
      return '<button class="chip' + (x === Z.avoid ? ' on' : '') + '" data-act="zavoid" data-v="' + x + '">' + (x || '不限') + '</button>';
    }).join('');
    var opts = '<button class="chip' + (Z.weekend ? ' on' : '') + '" data-act="zwk">只看周末</button>' +
      '<button class="chip' + (Z.hd ? ' on' : '') + '" data-act="zhd">只看黄道日</button>';

    var res = [];
    for (var i = 0; i < Z.range; i++) {
      var s = T.next(i), l = s.getLunar();
      var yi = l.getDayYi(), ji = l.getDayJi();
      var hit = terms.some(function (t) { return yi.indexOf(t) >= 0; }) && !terms.some(function (t) { return ji.indexOf(t) >= 0; });
      if (!hit) continue;
      if (Z.weekend && s.getWeek() !== 0 && s.getWeek() !== 6) continue;
      if (Z.hd && l.getDayTianShenType() !== '黄道') continue;
      if (Z.avoid && l.getDayChongShengXiao() === Z.avoid) continue;
      res.push({ s: s, l: l, d: i });
    }

    var list = res.map(function (o) {
      var s = o.s, l = o.l, hd = holidayOf(s);
      return '<div class="res" data-act="pickDay" data-d="' + ymd(s) + '">' +
        '<div class="dd"><div class="dn">' + s.getDay() + '</div><div class="dm">' + s.getYear() + '.' + s.getMonth() + ' 周' + WEEK[s.getWeek()] + '</div></div>' +
        '<div class="info"><div class="t1">农历' + lunarText(l) + '　' + l.getDayInGanZhi() + '日' + (hd ? '　<span style="color:' + (hd.isWork() ? 'var(--red2)' : 'var(--green)') + '">' + (hd.isWork() ? '班' : '休') + '</span>' : '') + '</div>' +
          '<div><span class="' + (l.getDayTianShenType() === '黄道' ? 'hd' : 'bd2') + '">' + l.getDayTianShen() + (l.getDayTianShenType() === '黄道' ? '黄道' : '黑道') + '</span>　' + l.getZhiXing() + '日　' + chongSha(l) + '</div></div>' +
        '<div class="cd">' + relText(o.d) + ' ›</div></div>';
    }).join('');

    $('#pageBody').innerHTML =
      '<div class="sec"><h4>想办的事</h4><div class="chips">' + chips + '</div></div>' +
      '<div class="sec"><h4>时间范围（从今天起）</h4><div class="chips sm">' + ranges + '</div></div>' +
      '<div class="sec"><h4>避开冲我的日子（选你的属相）</h4><div class="chips sm">' + avoid + '</div></div>' +
      '<div class="sec"><h4>筛选</h4><div class="chips sm">' + opts + '</div></div>' +
      '<div class="res-hd">“' + ev[0] + '”宜' + '（对应黄历：' + terms.join('、') + '）共 <b>' + res.length + '</b> 天</div>' +
      (list || '<div class="empty">这段时间没有合适的日子，试试放宽条件</div>');
  }

  // ---------- 八字 ----------
  var WX_COLOR = { '木': '#4caf6a', '火': '#e5473c', '土': '#c08a3e', '金': '#e0b54a', '水': '#3d8bd9' };
  var SX_OF = { '子': '鼠', '丑': '牛', '寅': '虎', '卯': '兔', '辰': '龙', '巳': '蛇', '午': '马', '未': '羊', '申': '猴', '酉': '鸡', '戌': '狗', '亥': '猪' };
  var LDAY = ['初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十', '十一', '十二', '十三', '十四', '十五',
    '十六', '十七', '十八', '十九', '二十', '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'];
  var TZS = [];
  (function () {
    for (var o = -12; o <= 14; o++) TZS.push(o * 60);
    TZS.push(210, 330, 345, 570);
    TZS.sort(function (a, b) { return a - b; });
  })();

  function tzLabel(off) {
    var a = Math.abs(off), t = 'UTC' + (off >= 0 ? '+' : '-') + Math.floor(a / 60) + (a % 60 ? ':' + pad(a % 60) : '');
    var note = { 480: ' 北京时间', 540: ' 日本、韩国', 60: ' 德国冬令时', 120: ' 德国夏令时', 0: ' 英国冬令时', '-300': ' 美东冬令时', '-480': ' 美西冬令时' }[off];
    return t + (note || '');
  }

  var B = (function () {
    var d = { mode: 'solar', y: 1993, m: 6, d: 24, h: 12, mi: 30, tz: 480, noTime: false };
    try { var v = JSON.parse(localStorage.getItem('zcym.bazi') || 'null'); if (v) for (var k in d) if (k in v) d[k] = v[k]; } catch (e) {}
    return d;
  })();

  function saveB() { try { localStorage.setItem('zcym.bazi', JSON.stringify(B)); } catch (e) {} }

  function opt(v, label, sel) { return '<option value="' + v + '"' + (sel ? ' selected' : '') + '>' + label + '</option>'; }

  function renderBazi() {
    var v = $('#v-bazi');
    var sol = Solar.fromYmdHms(B.y, B.m, B.d, B.h, B.mi, 0), lun = sol.getLunar();

    var dateRow;
    if (B.mode === 'solar') {
      dateRow = '<input type="date" id="bzDate" min="1900-02-01" max="2100-12-31" value="' + B.y + '-' + pad(B.m) + '-' + pad(B.d) + '">';
    } else {
      var ly = lun.getYear(), yo = '', mo = '', dd = '';
      for (var y = 1900; y <= 2100; y++) yo += opt(y, y + '年', y === ly);
      LunarYear.fromYear(ly).getMonths().forEach(function (mm) {
        if (mm.getYear() !== ly) return;
        var mv = mm.getMonth();
        mo += opt(mv, (mv < 0 ? '闰' : '') + LunarUtil.MONTH[Math.abs(mv)] + '月', mv === lun.getMonth());
      });
      var dc = LunarMonth.fromYm(ly, lun.getMonth()).getDayCount();
      for (var i = 1; i <= dc; i++) dd += opt(i, LDAY[i - 1], i === lun.getDay());
      dateRow = '<div class="bz-sel"><select id="bzLy">' + yo + '</select><select id="bzLm">' + mo + '</select><select id="bzLd">' + dd + '</select></div>';
    }
    var tzo = TZS.map(function (o) { return opt(o, tzLabel(o), o === B.tz); }).join('');

    var p = pillarsAt(B.y, B.m, B.d, B.h, B.mi, B.tz);
    var cols = [['年柱', p.y], ['月柱', p.m], ['日柱', p.d]];
    if (!B.noTime) cols.push(['时柱', p.t]);
    var cnt = { '木': 0, '火': 0, '土': 0, '金': 0, '水': 0 };
    function ch(c, wx) { cnt[wx]++; return '<span style="color:' + WX_COLOR[wx] + '">' + c + '</span>'; }
    var hdr = '', gan = '', zhi = '', wx = '', hide = '', ny = '';
    cols.forEach(function (c, i) {
      var g = c[1][0], z = c[1][1], wg = LunarUtil.WU_XING_GAN[g], wz = LunarUtil.WU_XING_ZHI[z];
      hdr += '<th>' + c[0] + (i === 2 ? '<small>日主</small>' : '') + '</th>';
      gan += '<td class="gz">' + ch(g, wg) + '</td>';
      zhi += '<td class="gz">' + ch(z, wz) + '</td>';
      wx += '<td>' + wg + wz + '</td>';
      hide += '<td>' + LunarUtil.ZHI_HIDE_GAN[z].map(function (h) { return '<span style="color:' + WX_COLOR[LunarUtil.WU_XING_GAN[h]] + '">' + h + '</span>'; }).join('') + '</td>';
      ny += '<td>' + LunarUtil.NAYIN[c[1]] + '</td>';
    });
    var miss = Object.keys(cnt).filter(function (k) { return !cnt[k]; });
    var cntTxt = Object.keys(cnt).map(function (k) { return '<span style="color:' + WX_COLOR[k] + '">' + k + cnt[k] + '</span>'; }).join(' ');
    var dg = p.d[0];

    paint(v,
      '<header class="topbar"><span class="ib"></span><h1>八字</h1><span class="ib"></span></header>',
      '<div class="bz-form">' +
        '<div class="bz-row"><label>历法</label><div class="seg2">' +
          '<button data-act="bzmode" data-v="solar" class="' + (B.mode === 'solar' ? 'on' : '') + '">阳历</button>' +
          '<button data-act="bzmode" data-v="lunar" class="' + (B.mode === 'lunar' ? 'on' : '') + '">阴历</button></div></div>' +
        '<div class="bz-row"><label>出生日期</label>' + dateRow + '</div>' +
        '<div class="bz-row"><label>出生时间</label>' +
          (B.noTime ? '<span class="bz-dim">不详</span>' : '<input type="time" id="bzTime" value="' + pad(B.h) + ':' + pad(B.mi) + '">') +
          '<button class="chip' + (B.noTime ? ' on' : '') + '" data-act="bznotime">时辰不详</button></div>' +
        '<div class="bz-row"><label>出生地时区</label><select id="bzTz">' + tzo + '</select></div>' +
        '<div class="bz-tip">按出生地当时的钟表时间填写。夏令时出生请选夏令时的时区；中国1986–1991年夏天实行过夏令时，那几年夏天出生请选 UTC+9。</div>' +
      '</div>' +
      '<table class="bz-tbl"><tr><th></th>' + hdr + '</tr>' +
        '<tr class="big"><th>天干</th>' + gan + '</tr>' +
        '<tr class="big"><th>地支</th>' + zhi + '</tr>' +
        '<tr><th>五行</th>' + wx + '</tr>' +
        '<tr><th>藏干</th>' + hide + '</tr>' +
        '<tr><th>纳音</th>' + ny + '</tr>' +
      '</table>' +
      '<div class="bz-info">' +
        '<p><b>八字</b>' + cols.map(function (c) { return c[1]; }).join(' ') + '</p>' +
        '<p><b>公历</b>' + B.y + '年' + B.m + '月' + B.d + '日' + (B.noTime ? '' : ' ' + pad(B.h) + ':' + pad(B.mi)) + '（' + tzLabel(B.tz).split(' ')[0] + '）</p>' +
        '<p><b>农历</b>' + lun.getYearInGanZhi() + '年' + lunarText(lun) + (B.noTime ? '' : ' ' + lun.getTimeZhi() + '时') + '</p>' +
        '<p><b>属相</b>属' + SX_OF[p.y[1]] + '（以立春为界）</p>' +
        '<p><b>日主</b>' + dg + LunarUtil.WU_XING_GAN[dg] + '</p>' +
        '<p><b>五行</b>' + cntTxt + (miss.length ? '　缺' + miss.join('、') : '　五行俱全') + '</p>' +
        '<p class="bz-dim">年柱以立春、月柱以节气交节时刻为界；23点（子时）起日柱按次日。</p>' +
      '</div>');
  }

  function bzSetSolar(s) { B.y = s.getYear(); B.m = s.getMonth(); B.d = s.getDay(); }

  function bzChange(t) {
    if (t.id === 'bzDate' && t.value) {
      var a = t.value.split('-'); B.y = +a[0]; B.m = +a[1]; B.d = +a[2];
    } else if (t.id === 'bzTime' && t.value) {
      var b = t.value.split(':'); B.h = +b[0]; B.mi = +b[1];
    } else if (t.id === 'bzTz') {
      B.tz = +t.value;
    } else if (t.id === 'bzLy' || t.id === 'bzLm' || t.id === 'bzLd') {
      var ly = +$('#bzLy').value, lm = +$('#bzLm').value, ld = +$('#bzLd').value;
      if (t.id === 'bzLy') {
        // 换年后若没有这个闰月就退回本月
        var ok = LunarYear.fromYear(ly).getMonths().some(function (mm) { return mm.getYear() === ly && mm.getMonth() === lm; });
        if (!ok) lm = Math.abs(lm);
      }
      ld = Math.min(ld, LunarMonth.fromYm(ly, lm).getDayCount());
      bzSetSolar(Lunar.fromYmd(ly, lm, ld).getSolar());
    } else {
      return false;
    }
    saveB();
    renderBazi();
    return true;
  }

  // ---------- 切换 ----------
  function showTab(tab) {
    S.tab = tab;
    document.querySelectorAll('.tab').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === tab); });
    document.querySelectorAll('.view').forEach(function (v) { v.classList.toggle('active', v.id === 'v-' + tab); });
    render();
    scrollTop(tab);
  }

  function render(anim) {
    if (S.tab === 'cal') renderCal(anim);
    else if (S.tab === 'alm') renderAlm(anim);
    else renderBazi();
  }

  function moveMonth(d) {
    var m = S.vm + d, y = S.vy;
    if (m < 1) { m = 12; y--; } else if (m > 12) { m = 1; y++; }
    S.vy = y; S.vm = m;
    var isCur = y === T.getYear() && m === T.getMonth();
    S.sel = isCur ? T : Solar.fromYmd(y, m, 1);
    renderCal(d > 0 ? 'l' : 'r');
  }

  function moveDay(d) {
    setSel(S.sel.next(d));
    renderAlm(d > 0 ? 'l' : 'r');
  }

  // ---------- 事件 ----------
  document.addEventListener('click', function (e) {
    var tab = e.target.closest('.tab');
    if (tab) { showTab(tab.dataset.tab); return; }

    var cell = e.target.closest('.cell');
    if (cell) {
      var s = parseYmd(cell.dataset.d);
      var dir = s.getMonth() === S.vm ? null : (dayNum(s) > dayNum(S.sel) ? 'l' : 'r');
      setSel(s);
      renderCal(dir);
      return;
    }

    var up = e.target.closest('.up-row');
    if (up) { setSel(parseYmd(up.dataset.d)); renderCal(); scrollTop('cal'); return; }

    var a = e.target.closest('[data-act]');
    if (!a) return;
    var act = a.dataset.act;
    switch (act) {
      case 'today':
        T = today(); setSel(T); render(); break;
      case 'goAlm':
        S.seg = 'day'; showTab('alm'); break;
      case 'hideTip':
        try { localStorage.setItem('zcym.tip', '1'); } catch (err) {}
        render(); break;
      case 'seg':
        S.seg = a.dataset.v; renderAlm(); break;
      case 'prevDay': moveDay(-1); break;
      case 'nextDay': moveDay(1); break;
      case 'modern':
        S.modern = !S.modern; renderAlm(); break;
      case 'share': share(); break;
      case 'zeji': openZeji(); break;
      case 'back': closePage(); break;
      case 'zev': Z.ev = +a.dataset.v; renderZeji(); break;
      case 'zrange': Z.range = +a.dataset.v; renderZeji(); break;
      case 'zavoid': Z.avoid = a.dataset.v; renderZeji(); break;
      case 'zwk': Z.weekend = !Z.weekend; renderZeji(); break;
      case 'zhd': Z.hd = !Z.hd; renderZeji(); break;
      case 'bzmode': B.mode = a.dataset.v; saveB(); renderBazi(); break;
      case 'bznotime': B.noTime = !B.noTime; saveB(); renderBazi(); break;
      case 'pickDay':
        setSel(parseYmd(a.dataset.d));
        closePage();
        S.seg = 'day';
        showTab('alm');
        break;
    }
  });

  document.addEventListener('change', function (e) {
    var t = e.target;
    if (bzChange(t)) return;
    if (t.id === 'monthInput' && t.value) {
      var p = t.value.split('-');
      S.vy = +p[0]; S.vm = +p[1];
      var isCur = S.vy === T.getYear() && S.vm === T.getMonth();
      S.sel = isCur ? T : Solar.fromYmd(S.vy, S.vm, 1);
      renderCal();
    } else if (t.id === 'dateInput' && t.value) {
      setSel(parseYmd(t.value));
      renderAlm();
    }
  });

  window.addEventListener('popstate', function () { closePage(true); });

  // 左右滑动：万年历翻月，黄历翻日
  var sx = 0, sy = 0, sTarget = null;
  document.addEventListener('touchstart', function (e) {
    var t = e.target.closest('#calGrid, #almBig');
    sTarget = t ? t.id : null;
    sx = e.touches[0].clientX; sy = e.touches[0].clientY;
  }, { passive: true });
  document.addEventListener('touchend', function (e) {
    if (!sTarget) return;
    var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (sTarget === 'calGrid') moveMonth(dx < 0 ? 1 : -1);
      else moveDay(dx < 0 ? 1 : -1);
    }
    sTarget = null;
  }, { passive: true });

  // 跨过零点或从后台回来时刷新“今天”
  var lastHour = nowHourIndex(), lastTz = tzKey();
  function refreshToday() {
    var c = $('#clock');
    if (c) c.textContent = clockText();
    var n = today(), h = nowHourIndex(), tz = tzKey();
    if (ymd(n) === ymd(T) && h === lastHour && tz === lastTz) return;
    if (tz !== lastTz) toast('时区已变为 ' + clockText().split(' · ')[1] + '，干支已更新');
    lastHour = h; lastTz = tz;
    if (ymd(n) !== ymd(T)) {
      var wasToday = ymd(S.sel) === ymd(T);
      T = n;
      if (wasToday) setSel(T);
    }
    $('#tabDay').textContent = T.getDay();
    if ($('#page').classList.contains('open')) return;
    render();
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) refreshToday(); });
  setInterval(function () { if (!document.hidden) refreshToday(); }, 15000);
  window.addEventListener('focus', refreshToday);
  window.addEventListener('pageshow', refreshToday);

  $('#tabDay').textContent = T.getDay();
  render();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
})();

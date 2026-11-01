# 子丑寅卯（万年历、黄历、佛历、八字）设计与交接文档

本文是给后续接手开发的AI或人看的总览，已对照2026-10-28的最后一次提交（`3334823`）和当前文件核实。仓库是公开的（GitHub Pages），所以文档里不要写任何个人信息或密钥。

## 1. 是什么

用途：用户自用的iPhone万年历和黄历网页应用（PWA）。在Safari打开后“添加到主屏幕”，像App一样全屏使用，离线可用。界面参考用户提供的三张商业万年历App截图（深色主题，保存在上一级目录`D:\project\万年历\`的三个jpg）。

线上地址：https://zimocun.github.io/zichouyinmao/ （GitHub用户`zimocun`，公开仓库`zimocun/zichouyinmao`，Pages从`main`分支根目录发布）。上一级目录里的`子丑寅卯-扫码打开.png`是该地址的二维码。

范围（用户明确限定）：
- 万年历（月历、节假日休班、近期节日节气）。
- 黄历（宜忌、冲煞、值神、建除十二神、二十八星宿、彭祖百忌、胎神、吉神凶煞、时辰宜忌、现代文解释、分享、吉日查询）。
- 佛历（佛历纪年、佛教节日、斋日、戒期、二十八宿）。
- 八字（阳历/阴历输入、出生地时区、四柱、五行、藏干、纳音、本人八字）。

明确不做（用户说“先不要”，没有要求就不要加）：天气、工具、会员、运程等其他栏目；“听一听”朗读和“查看当日黄历”按钮已被用户去掉。

四柱干支的规则是用户要求的（2026-10-27）：四个干支始终显示，并跟随手机当前时间和时区；日柱在23点（子时）起换为次日，因为用户读时间起金钱卦、六爻。

## 2. 目录结构

仓库根目录`D:\project\万年历\zichouyinmao`（git，分支`main`，远端`origin`）：
- `index.html`：唯一页面。四个视图`#v-cal`、`#v-alm`、`#v-fo`、`#v-bazi`，底部标签栏`#tabbar`，二级页`#page`（吉日查询）、滚轮弹层`#sheet`、提示`#toast`。依次加载`js/lunar.js`、`js/data.js`、`js/app.js`。
- `js/app.js`（895行）：全部应用逻辑，一个IIFE，无框架，用字符串拼接HTML后整体`innerHTML`重绘。
- `js/lunar.js`：第三方库lunar-javascript 1.7.7（MIT），原样拷贝，与npm包文件逐字节相同，不要手改。
- `js/data.js`：`window.ZD`，只有本应用自己的数据：`yiji`（宜忌术语的现代文解释）、`tianshen`（值神）、`zhixing`（建除）、`pengzu`（彭祖百忌）、`events`（吉日查询的事项与对应的宜忌词）。
- `css/app.css`（约270行）：全部样式；深色主题，颜色在`:root`变量里；`@font-face`加载`fonts/serif.woff`。
- `fonts/serif.woff`：衬线粗体子集字体（7.6 KB），用在大号农历日期、时辰干支、八字天干地支（`--serif`变量）；字体回退链里有系统宋体，字体里缺的字会回退显示。
- `icons/`：`icon-32/180/192/512.png`、`maskable-512.png`。
- `manifest.webmanifest`：PWA清单（名称、`display: standalone`、竖屏、主题色`#1c1c1e`、图标）。
- `sw.js`：service worker，见3。
- `LICENSE-lunar-javascript.txt`：lunar-javascript的MIT许可，必须保留。
- `README.md`：一段简介。
- `.gitignore`：只有`.claude/`。`.claude/launch.json`是本机预览配置（`python -m http.server 8765`），不入库。

仓库外（本机开发辅助，不发布）：`D:\project\万年历\_dev\`有npm安装的`lunar-javascript`（用于在Node里试算API，`t1.js`到`t3.js`是试算脚本），以及参考截图和二维码。

## 3. 架构与数据流

无构建步骤，无后端，无打包工具：浏览器直接运行`index.html`加三份脚本。所有历法计算在客户端完成。

历法算法来源：lunar-javascript（作者6tail）。它内置寿星天文历（ShouXing）算法计算节气，农历、干支、宜忌、值神、建除、星宿、胎神、方位、佛历（`Foto`）都来自该库；法定节假日表来自`HolidayUtil`。库的有效范围大约是公元1900到2100年，年月日滚轮限定为1901到2099年。库中的节气时刻是北京时间（UTC+8），这是四柱换算要先转北京时间的原因。

法定假日数据只到2026年（实测2026年有39条，2027年为0）。2027年及以后的放假/补班要等库发布新版后更新`js/lunar.js`。

状态（`app.js`内的IIFE变量）：
- `T`：今天（`Solar`）；`S = {tab, sel, vy, vm, seg, modern}`：当前标签、选中的日期、月历正在看的年月、黄历子页（`day`/`hour`）、是否展开现代文。
- `B`：八字当前排盘（`mode`、`y/m/d/h/mi`、`tz`、`noTime`）；`SELF`：本人八字；`Z`：吉日查询条件；`W`：年月日滚轮的临时状态。
- 持久化只有`localStorage`的三个键：`zcym.bazi`（上次排盘）、`zcym.self`（本人八字）、`zcym.tip`（是否关闭“添加到主屏幕”提示）。读写都包在try/catch里（无痕模式会抛异常）。没有任何服务器存储。
- 八字默认值`bzDefault()`是公历2000年1月1日12:00、UTC+8、有时辰。

页面结构：
- 四个视图是`.view`，同一时间只有一个有`.active`；每个视图由`paint(view, 标题栏HTML, 内容HTML)`重绘，标题栏固定，内容在`.scroll`里滚动，重绘时保留滚动位置。
- 底部标签：万年历、黄历、佛历、八字，由`showTab()`切换；`render()`按`S.tab`调`renderCal/renderAlm/renderFo/renderBazi`。
- 吉日查询是覆盖在上面的二级页`#page`，打开时`history.pushState({page:'zeji'})`，返回键或`popstate`关闭（`closePage`）。
- 事件：全部委托在`document`上，用`data-act`属性分发（`switch (act)`）。左右滑动：万年历翻月，黄历和佛历翻日。
- iOS适配：`viewport-fit=cover`、`env(safe-area-inset-*)`、`fitHeight()`在主屏幕全屏模式下用屏幕高度修正底部空白（`--apph`变量）、禁用缩放与文字选择。

四柱算法（`pillarsAt`、`pillars`）：
- 日柱、时柱按手机本地钟点，23点起日柱用`getDayInGanZhiExact`（次日）。
- 年柱（立春为界）、月柱（节为界）比较的是同一时刻，所以先把本地时刻按`offMin`（该地相对UTC的分钟数）换成北京时间再取`getYearInGanZhiExact`/`getMonthInGanZhiExact`。
- 八字页用出生地时区`B.tz`调同一个函数；时区下拉有UTC-12到UTC+14以及 +3:30、+5:30、+5:45、+9:30。

Service worker缓存策略（`sw.js`）：
- `CACHE = 'zcym-v9'`；`FILES`是预缓存清单：`./`、`index.html`、`css/app.css`、`js/lunar.js`、`js/data.js`、`js/app.js`、`fonts/serif.woff`、`manifest.webmanifest`、`icons/icon-180/192/512/32.png`。
- install：`caches.addAll`（每个请求带`cache: 'reload'`绕过HTTP缓存），然后`skipWaiting()`。清单里任何一个文件404，整个安装会失败，旧SW继续服务。
- activate：删除名字不等于当前`CACHE`的所有缓存，`clients.claim()`。
- fetch：只处理同源GET；先`match`（`ignoreSearch`）命中缓存就立刻返回，同时用`fetch(..., {cache: 'no-cache'})`在后台更新缓存（stale-while-revalidate）；没命中则走网络；网络失败回落缓存。清单外的文件（如`maskable-512.png`）在第一次访问后才进缓存。
- 后果：发布新版后，已安装的用户第一次打开看到的仍是旧版，缓存在后台更新，下次打开才是新版；提高`CACHE`版本号会让新SW安装并清掉旧缓存，加速切换，但已打开的页面仍要重新打开。SW以真实HTTPS地址上的行为为准（`app.js`在`file:`协议下不注册SW，内置浏览器面板也会拦截）。
- 仓库里的`.md`文件（README、DESIGN、AGENTS、CLAUDE）不在预缓存清单里，不影响离线和更新；GitHub Pages会把它们当静态文件原样发布（没有front matter，Jekyll不处理）。

## 4. 功能

### 4.1万年历（`renderCal`）
- 月历网格6行以内，每格：阳历日、农历日或节气或节日（优先级：节气、节日、初一显示月名、否则农历日）、休/班角标（`HolidayUtil`）。周六日红色，今天描边，选中填红。
- 选中日的详情卡`detailHtml`：农历、星座、四柱、生肖、第几周、宜（前5）忌（前3）、标签（节气、节日、放假/补班）。点详情卡跳到黄历页。
- 近期节日节气`upcomingHtml`：未来75天内最近7项。
- 公历节日只保留常用的（`SOLAR_FEST`白名单）；农历节日用库的`getFestivals()`。
- 月份标题是原生`<input type="month">`叠在上面；右上“今”回今天。

### 4.2黄历（`renderAlm`、`almDay`、`almHours`）
- 分段：黄历、时辰。黄历页：大号农历日期（左右箭头或滑动换日）、四柱、手机时间提示（`clockText`）、宜忌词、黄帝纪元、五行（纳音）、冲煞、值神、十二时辰吉凶、建除、吉神宜趋、胎神、凶神宜忌、二十八星宿、彭祖百忌。
- “查看现代文”（`modernHtml`）：用`ZD`中的解释把宜忌词、冲煞、值神、建除、彭祖、胎神、喜财福神方位翻成白话。`ZD`里没有的词显示“—”。
- 时辰页：12个时辰的干支、时段（子时按23:00–00:59）、吉凶、值神、宜忌、方位；当前时辰高亮。
- 分享：`navigator.share`，不支持时复制到剪贴板。
- 吉日查询（`renderZeji`）：选事项（`ZD.events`，每个事项对应若干黄历“宜”词）、范围（30/60/90/180/365天）、避开冲自己的属相、只看周末、只看黄道日。命中条件：当天“宜”包含任一对应词且“忌”不含任何对应词。点结果跳到该日黄历。

### 4.3佛历（`renderFo`）
- 用库的`Foto.fromLunar`：佛历纪年、农历月日、斋日标签（十斋日、六斋日、朔望斋、观音斋、三长斋月）、佛教节日、戒期与神诞（杨公忌若库未列则补一条）、二十八宿、近期8个佛教节日（150天内）。底部有斋日规则说明。

### 4.4八字（`renderBazi`）
- 输入：阳历/阴历（阴历含闰月）、出生日期（自制年月日滚轮`#sheet`，`wheelItems/buildCol/settleCol`）、出生时间（`<input type="time">`，可选“时辰不详”）、出生地时区。
- 输出：四柱的天干、地支、五行、藏干（`LunarUtil.ZHI_HIDE_GAN`）、纳音；八字、公历、农历、属相（以立春为界）、日主、五行个数与缺项。时辰不详时不显示时柱。
- 本人八字：“设为本人”“看本人”“新排盘”，存在`zcym.self`。
- 提示：中国1986–1991年夏季实行过夏令时，那几年夏天出生要选UTC+9。工具不做真太阳时修正。

## 5. 外部依赖与发布

- 运行依赖：只有浏览器和`js/lunar.js`。没有npm依赖、没有CDN、没有网络请求（字体和图标都在本地）。
- 本机预览：在应用目录启动静态服务器，`python -m http.server 8765 --bind 127.0.0.1`，浏览器打开`http://127.0.0.1:8765/`（`.claude/launch.json`的`zcym`配置就是这个，但`preview_start`只在当前项目根目录找配置，需要用Bash自己启动服务器再让浏览器面板导航）。本机预览不能代表iOS上的SW行为（内置浏览器面板会拦截SW；普通浏览器访问127.0.0.1可以注册，但仍以真机为准）。
- 发布流程（用户要求时才做）：`git add -A`、`git commit`、`git push origin main`，GitHub Pages自动部署，约一分钟生效。仓库本地的`user.name`是`zimocun`，邮箱是GitHub的noreply地址；推送走Git Credential Manager（已授权）。需要登录GitHub时由用户自己操作，不要代输入验证码。
- 每次改动`index.html`、`css/`、`js/`、`icons/`、`fonts/`或清单文件时，必须同时提高`sw.js`的`CACHE`（`zcym-v9`变`zcym-v10`…），历史上每次功能提交都这样做。新增要离线可用的文件时，还要加进`FILES`，并确认文件真的存在。
- 更新`js/lunar.js`：在`D:\project\万年历\_dev`里`npm update lunar-javascript`，把`node_modules/lunar-javascript/lunar.js`复制过来，再提高`CACHE`，并核对2027年的`HolidayUtil`数据。

## 6. 约定

- 代码：原生ES5风格（`var`、`function`、字符串拼接），不引入框架、打包器和npm依赖；整个`app.js`在一个IIFE里，严格模式；DOM事件统一用`data-act`委托。
- 界面文字用中文，汉字与数字、英文、符号之间不留空格（页面里的“第3周”“共5天”写法）；黄历术语用传统写法，不改写。
- 主题：只有深色，颜色全部走`css/app.css`的`:root`变量；字体用系统字体加`ZSerif`（子集字体，缺字时回退到系统宋体，换了显示内容后要在iPhone上看一眼）。
- 本地存储访问一律try/catch。
- 不加联网请求、统计、广告脚本；不收集个人信息。八字数据只存在用户手机的`localStorage`。
- 提交信息用中文一句话描述改动，沿用`git log`的写法。

## 7. 测试

没有自动化测试，也没有package.json。验证方式：
1. 本机起`http.server`后用浏览器（或iPhone尺寸的模拟）逐个标签点一遍：万年历翻月、选日；黄历换日、时辰页、现代文、分享、吉日查询；佛历；八字改日期、阴历闰月、时区、时辰不详、本人八字。
2. 四柱算法可用Node对照：在`D:\project\万年历\_dev`里`node -e`用`lunar-javascript`的`Solar.fromYmdHms(...).getLunar().getYearInGanZhiExact()`等与页面显示核对，特别是立春、节气前后几分钟和23点前后。
3. SW与离线只能在已发布的HTTPS地址上验证：iPhone打开后开飞行模式再打开，确认能用；发布后确认确实拿到了新版本（页面右下无版本号，可看Safari开发者工具里的缓存名）。

## 8. 已知问题与待办

- 2027年法定节假日数据库里还没有（实测为0条），2026年底前后要更新lunar-javascript并重新拷贝。
- 真太阳时、夏令时历史表没有做：八字页只按用户选的时区换算，夏令时靠用户手选时区。
- 手机时区变化时四柱会跟着变（这是用户要的），但八字页的出生时区是独立的。
- 没有版本号显示，判断线上是否更新需要看缓存名；`sw.js`的`CACHE`版本号与提交没有自动关联，容易忘记提高。
- 仓库只有一个`app.js`，约870行，几个渲染函数很长；新增栏目前建议先按标签拆分文件，同时把新文件加进`FILES`。
- 没有`.nojekyll`；目前没有以下划线开头的目录，不影响发布，将来加这类目录会被Jekyll忽略。
- 用户暂不需要的栏目（天气、工具、会员、运程）不要主动添加。

## 9. 版本与重要改动（`git log`）

- `1f569dc`（2026-10-27）初版：万年历、黄历、八字PWA。
- `dae5b75`（2026-10-27）八字默认出生时间调整（后来又被改过）。
- `b69bd05`（2026-10-27）离线缓存后台更新时绕过HTTP缓存。
- `4517d16`（2026-10-27）修复iPhone主屏幕模式下底部空白和顶部标题栏发虚（`fitHeight`）。
- `d780104`（2026-10-27）八字出生日期改用年月日滚轮选择，阳历/阴历含闰月。
- `051b883`（2026-10-28）新增佛历页（放在八字左边）。
- `3334823`（2026-10-28）八字默认公历2000年1月1日；新增本人八字（设为本人、看本人、新排盘）；`CACHE`为`zcym-v9`。

当前工作区干净，与`origin/main`同步。

# AGENTS.md：子丑寅卯（万年历、黄历、佛历、八字PWA）

子丑寅卯是一个自用的iPhone PWA：纯静态页面（原生HTML/CSS/JS，无构建、无后端、无npm依赖），在Safari“添加到主屏幕”后全屏离线使用。四个标签：万年历、黄历（含时辰、现代文、吉日查询）、佛历、八字。历法计算全部来自仓库内的`js/lunar.js`（lunar-javascript 1.7.7，MIT，原样拷贝，不要手改）。线上地址：https://zimocun.github.io/zichouyinmao/ （GitHub Pages，`main`分支根目录）。详细设计见 [DESIGN.md](DESIGN.md)。

## 运行、测试、发布
- 本机预览：在本目录运行`python -m http.server 8765 --bind 127.0.0.1`，浏览器打开`http://127.0.0.1:8765/`。没有构建步骤，改完刷新即可。
- 没有自动化测试：逐个标签手动点一遍（翻月、选日、换日、时辰页、现代文、吉日查询、佛历、八字改日期/阴历闰月/时区/时辰不详/本人八字）。四柱可用`D:\project\万年历\_dev`里的Node加lunar-javascript对照。
- Service worker只能在真实HTTPS地址上验证；本机预览和内置浏览器面板不代表iOS行为。
- 发布（只有用户明确要求才做）：`git add -A`、`git commit -m "<中文一句话>"`、`git push origin main`，Pages约一分钟生效。登录GitHub由用户自己操作，不要代输入验证码或密码。

## 文件速览
- `index.html`：唯一页面（四个视图、标签栏、二级页`#page`、滚轮弹层`#sheet`）。
- `js/app.js`：全部逻辑（895行IIFE）：`renderCal/renderAlm/renderFo/renderBazi`、`pillarsAt`、`renderZeji`、年月日滚轮。
- `js/data.js`：`window.ZD`，宜忌现代文、值神、建除、彭祖、吉日查询事项；`css/app.css`：样式；`fonts/serif.woff`：衬线子集字体。
- `sw.js`：缓存先行加后台更新，预缓存清单`FILES`；`manifest.webmanifest`：PWA清单；`icons/`：图标。
- 仓库外`D:\project\万年历\_dev`是npm版lunar-javascript和试算脚本，不发布。

## 硬规则
- 改了`index.html`、`css/`、`js/`、`icons/`、`fonts/`或预缓存清单，必须同时提高`sw.js`里的`CACHE`（现为`zcym-v9`，下次`zcym-v10`），否则已安装的手机拿不到新版。新增要离线可用的文件要加进`sw.js`的`FILES`，并确认文件存在，否则整个SW安装会失败。
- 不要提交或推送，除非用户要求。本仓库是公开的：文档、代码、提交信息里不要出现个人信息、出生日期、密钥。
- 不要手改`js/lunar.js`；升级时从npm包整文件替换，保留`LICENSE-lunar-javascript.txt`。2027年起的法定假日数据要等库更新（现在为0条）。
- 范围只有万年历、黄历、佛历、八字。天气、工具、会员、运程等栏目用户明确说“先不要”，没有要求不要加。
- 四柱规则（用户要求）：始终显示四个干支并跟随手机当前时间和时区；日柱23点起算次日；年柱、月柱先换算到北京时间再按立春、节气判断。改动`pillarsAt/pillars`前先读DESIGN.md第3节。
- 保持原生JS（`var`、`function`、`data-act`事件委托）和单文件`app.js`的风格；界面颜色走`css/app.css`的`:root`变量（只有深色主题）；本地存储访问都要try/catch。
- 界面文字用中文，汉字与数字、英文、符号之间不留空格；新增的`.md`文件不要放进`sw.js`的`FILES`（文档不需要离线）。
- 不加联网请求、统计、第三方脚本；八字数据只存在用户手机的`localStorage`（键`zcym.bazi`、`zcym.self`、`zcym.tip`）。

详细设计见 [DESIGN.md](DESIGN.md)。

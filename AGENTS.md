# AGENTS.md — FlowCredit 开发仓库协作规范（迭代版）

本文件约束在此仓库工作的协助者（AI 或人）。README.md 是项目说明；本文件是改动铁律。与任务书冲突时以任务书为准。

## 0. 仓库定位与隔离（必读）

- 本仓库 `Anhao1314/flowcredit-v2` 是**开发与测试仓库**：用于迭代、验证与回归，**不部署、不发布、不对接任何平台**。
- 生产面有两个，均随生产仓库 `Anhao1314/flowcredit` 的 `main` push 自动发布，与本仓库无关：
  - API `https://flowcredit-api.onrender.com`（Render）
  - 静态演示 `https://anhao1314.github.io/flowcredit/`（GitHub Pages）
- 隔离机制（改动前先确认仍然成立）：
  - `origin` = 本仓库；`upstream` = 生产仓库，push 地址已禁用，只读同步仍可用 `git fetch upstream`。
  - `.git/hooks/pre-push` 拦截任何指向生产仓库的推送，包含直接 URL 推送。
  - `npm run check:isolation` 在 CI 中阻止部署描述文件、部署型 workflow 步骤与写权限 token 进入本仓库。
  - 本仓库无 Actions secrets、无 environments，workflow token 只读，GitHub Pages 必须保持关闭。
- 边界细节与核验命令见 `docs/dev-isolation.md`。
- 上线路径：由人明确授权后，把已验证的改动移植到生产仓库；本仓库不承担任何发布动作。

## 1. 项目本质
- 零构建静态站：原生 HTML/CSS/JS，普通 script 按序加载（data→state→ui→intake-v03→view-landing→view-ingest→view-audit→view-report→view-workspace→ai-ledger→view-ai→view-ai-live→app），无 module/defer/CDN/npm。
- fetch 唯一豁免：view-ai-live.js 允许同源 `/fc/ai/*` 的版本化 config/schema/run/extract/assess/ask 调用，必须带 try/catch、短超时、探测失败静默退出；其余所有文件仍禁 fetch。
- 双击 index.html 以 file:// 离线可跑；UI 文案全英文；无 emoji（允许 → ← ✓ · σ ± 等符号）；图标只用 App.ui.icon 内联 SVG；数字 mono + tabular-nums。

## 1.1 对外措辞纪律（合规红线）

- 业务定位：AI 信用风控（风险评估）系统，不是审计机构；用户可见文案禁用 audit / 审计 / auditor / 审阅意见 等表述，统一用 risk assessment / 风控评估 / 评估结论 / 复核。
- 免责口径：「非审计意见、不构成法定审计」类注记必须保留（报告 D 节与全局页脚）。
- 工程标识例外：路由 #/audit、文件名 view-audit.js、id run-audit / reset-audit / audit-report-btn、状态字段 auditStage / auditDone 属内部标识，只允许出现在代码与文档技术段，禁止进入用户可见文案。
- 该红线由 `agent/scripts/check-frontend-discipline.js` 静态守护：除上述内部标识与法定免责句式外，前端与 index.html 出现 audit 即判失败。

## 1.2 实时 AI 会话态原则

- 页面实时 AI（view-ai-live.js + 本仓库 agent/ 源码构建的本机侧车）只更新会话内存，绝不写 ai-ledger.js；ai-ledger.js 与 git 提交链仅由离线批跑生成。
- 侧车源码、配置和测试统一位于本仓库 `agent/` 子目录；API 密钥、node_modules、会话、运行日志和其他 runtime 数据必须位于仓库外 `/Users/yimingyang/fc-agent/`，不得提交。本仓库本地跑测试建议用独立的 `FC_RUNTIME_ROOT`，与其它本地运行分开。

## 2. 核心冻结区（默认一字不改；任务书明确点名才动）
- 文件：assets/js/data.js、assets/js/ui.js、assets/js/app.js、assets/js/state.js、assets/js/view-landing.js。
- v0.3 任务书对 app.js 的唯一例外：导航可见标签改为 New Assessment，并只读 FC_INTAKE 进度；路由、状态机、ID、计时和事件绑定继续冻结。
- 2026-09-13 解冻例外（产品减法任务授权）：仅解冻 app.js 的四处——顶栏导航链接、App.wallet 定义、toggleWallet/walletConnectedUi 及其 wallet 句柄、路由正则中的 account；用于删除不支撑任何用户任务的 Demo Wallet 模拟连接与 #/account 死胡同页。状态机语义、其余元素 id、事件绑定与演示节奏（audit 350ms 步进、stress 约 2s 时序、ring 600ms、动画 200–350ms）继续冻结；该次授权不外溢到本文件其他冻结内容。
- 内容：SUBJECTS / ANCHOR_W / STRESS_FRAMES / 全部公式与 mock 数值 / 路由 hash（landing|workspace|ingest|audit|report）/ 状态机语义 / 元素 id / 事件绑定 / 演示节奏（audit 350ms 步进、stress 约 2s 时序、ring 600ms、动画 200–350ms）。
- id 清单（保留）：run-audit / reset-audit / anchor-btn / anchor-btn-label / verify-btn / stress-btn / recover-btn / go-p1 / ring-slot / line-slot / chain-log。
- L1 口径：Raw Token = d.l0.compute.Raw（healthy 80.0M / sybil 108.0M）；rawNT_M 是「已乘 w_model/w_task 后的 NT」（96.0M / 108.0M），只用于 L2「毛 NT」，绝不顶替 Raw Token。
- Merkle：哈希输入 = 各叶摘要 + 时间戳 + 递增 nonce，每次 Anchor root 不同；anchor 保存最新 root；chainLogs 只增（switchSubject 时清空）。
- 冻结区的任何解冻都必须先改本文件、说明理由，再改代码；CI 冻结基线（`agent/test/frontend-baseline.test.js`）会拦截无意漂移。

## 3. 派生数值纪律
- 页面一律调用 App.fn 现算（cci/pd/validNT_M/efficiency/scuOf/creditLine/vetoed/deviation/ntM/stressMeta），禁止写死 795/320/90.2/36.7/2.3/85.0 等结果字面量。
- 回归基线：CCI 795/320 · PD 2.3/85.0 · ValidNT 90.2/36.7 · Efficiency 22857/514286 · SCU 3570/86.1 · Credit 20000/0 · Deviation +3%/+186% · stress 帧 1.85/1.05/1.35 与 20000/12000/18000。
- 上述基线现由 `agent/test/frontend-baseline.test.js` 执行守护（含 watch 主体 668/9.2/42.1/33750/992/6000/+9% 与 Merkle 四条性质）；改公式必须同步改测试并在交付说明中写明理由。

## 4. 句柄纪律（硬规则）
- setTimeout/setInterval/requestAnimationFrame 一律经 App.fn.timeout/raf 登记 state.timer；页面局部动画用 App.fn.addClearHook 注册复位。
- switchSubject、路由切换、resetAll/Reset/Recover 必须先 clearTimers()；跨页不得残留回调或半绘动画；stress 飞行中切页回 idle，终态 recover 保留。
- 风险横幅只在 #/report 视图；landing 入场动画只在真正进入 #/landing 时播一次。

## 5. 样式纪律
- 颜色只用 :root token（--teal/--blue/--amber/--red/--green/--text/--text2/--text3/--line/--card/--card2/--mono），不新增品牌色。
- 新组件样式追加到 styles.css 末尾（可用注释分段，如 P0 enterprise components）；同特异性后写覆盖前写。
- 不删除仍被 JS 使用的类名/选择器；删死 CSS 前须提供全仓零引用证据（index.html + assets/js 扫描）且避开动态拼接类（如 dot- + state）。
- 动画 200–350ms（ring 600ms）；prefers-reduced-motion 下静态完整；≤420px 无横向滚动；flex/grid 用 auto-fit minmax。

## 6. 迭代流程与提交
- 自检已自动化，本地与 CI 同源；每次改动后至少执行：

```bash
cd agent
node scripts/check-syntax.js              # 全部 JS 语法（src/scripts/test/assets/js）
node scripts/check-frontend-discipline.js # fetch 门控、零构建模型、emoji、audit 措辞
node scripts/check-dev-isolation.js       # 部署隔离守卫
node --test test/*.test.js                # 单元与回归（含前端冻结基线）
node scripts/verify-release.js            # 完整门禁：契约、冒烟、密钥与制品扫描
```

- CSS 花括号配平仍需人工确认；临时验证脚本放系统临时目录（不入库），长期有效的回归必须沉淀到 `agent/test/` 并由 CI 执行。
- 提交粒度：一个改动一次提交；消息用英文 conventional 前缀（`fix(scope):` / `feat(scope):` / `docs(scope):` / `chore(scope):`），正文说明改了什么与为什么。
- 推送目标只有 `origin`（本开发仓库）；`upstream` 为只读生产仓库，push 地址已禁用且由 `pre-push` 钩子二次拦截。
- 本仓库不创建 release tag、不部署、不发版；tag 与发布只属于生产仓库，需人工明确授权后在那边执行。
- 禁止 force push、force-with-lease 与任何远端历史改写（对 origin 同样适用）；push 被拒绝时停止并报告远端差异，不自动 rebase 或 merge。
- 交付说明列出：改动文件清单、每文件改动点、冻结区零改动核对、验收结果。

## 7. 服务端基线（迭代回归）

- 固定演练案例（`agent/test/risk-core-v021.test.js`、`agent/scripts/validate-*.js`）：healthy TAI 93.8 / CCI 929 / grade A；watch 82 / 741 / B；sybil 28.9 / 193 / D 且 veto=true。
- 版本标识：`flowcredit.api/v1`、`flowcredit.intake/v0.3.1`、`flowcredit.risk_result/v0.2.1`，以及 v0.1 遗留标识 `flowcredit.risk_result/v0.1`；改动其中任何一个都属对外契约变更，必须在交付说明中单列。

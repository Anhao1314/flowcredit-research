# FlowCredit 企业填报体验改造方案与交付

日期：2026-09-13。适用仓库：`Anhao1314/flowcredit-v2`，仅开发和验证。

## 方案

以提交证据的企业为主要用户，任务顺序为填写事实、理解结论、补齐证据、保存报告。采用简洁的浅色内容面、清晰的主次操作、渐进展开和就地引导。布局上限 1120px，表单与报告上限 880px；系统字体，桌面标题 40px、手机 32px，正文 16px、辅助文字至少 13px，控件至少 44px。

- Workspace 的主操作是 New assessment，直接创建草稿并打开现有九字段表单；示例和 JSON 导入为次操作。
- 表单顶部集中名称、实际保存状态、示例填充与辅助输入。日期说明单月或 27–31 天窗口，Token 使用百万单位，金额使用 USD。
- 历史提供可增删的月度表格，R/C 使用成对数值行，证据记录提供字段、来源、核验方法、观察日期、覆盖率和引用摘要。补充组继续渐进展开。
- 高级 JSON 与可视表单共用草稿；切换先保存，非法 JSON 保留并阻止切换。额外申请元数据不参与评分，保留在内部扩展输入中并随 JSON 导出；原有禁止申请方提供评分的纪律继续生效。月度行的额外元数据和未编辑的观察时间戳保留。
- 结果与报告共用确定性结论摘要，先呈现状态、主要原因和优先行动，再呈现 TAI、CCI、Rule risk grade 与 Evidence readiness。未知状态保守显示 Review required；确认否决优先。相同优先级保留原行动顺序。示例标记 Synthetic data，任何状态均不表示自动授信通过。
- Add missing data 使用内存定位意图进入原输入路由，展开组、滚动并聚焦。定位延后到壳层渲染之后；不改变原路由或绑定。
- 报告顶部 Print / Save PDF 为主操作，JSON 和编辑为次操作。章节、全部计算依据和 D 节免责保留。可选 proof 与固定场景不参与结论或完成条件；打印默认不包含未展开附录。
- config 的模型状态、侧车状态和鉴权要求分别判断。模型不可用或鉴权必需时禁用抽取及提问；确定性评估仍可本地执行。在线提问额外要求有效会话和独立授权，无页面密钥输入。401 后页面停止继续调用需要鉴权的服务；会话失效时重新授权运行。
- 持久化实际写入后显示 Saved in this browser、Saved for this tab 或 Memory only。tab 回退标记避免可读但无法更新的旧 localStorage 覆盖较新的 tab 草稿。
- 删除与清空提供一次 Undo，快照只在内存中保存，恢复顺序和活动草稿。下一次草稿变更或重新加载后失效，上限仍为五份。

## 逐文件交付

| 文件 | 改动 |
| --- | --- |
| `AGENTS.md` | 先记录本轮首页展示、壳层服务文案及末尾主题覆盖的有限解冻。 |
| `assets/js/intake-v03.js` | 实际保存反馈、tab 回退、最近一次删除 Undo、扩展输入保留、共享确定性摘要、AI 能力判断、补证定位意图；抽取后清除旧结果。 |
| `assets/js/view-workspace.js` | New assessment 主操作直接创建草稿，示例为次操作，删除 Undo，导入异步回调检查路由。 |
| `assets/js/view-ingest.js` | 默认九字段表单、集中顶部、单位/日期指导、可增删历史/成对数值/证据行、枚举选择、JSON 同步和错误保留、补证定位、能力限制和异步取消保护。 |
| `assets/js/view-ai.js` | 结论摘要和优先行动共享展示、证据与规则等级分离、行动定位按钮、Synthetic data 标识。 |
| `assets/js/view-audit.js` | 使用共享摘要和行动，提问能力与会话门控，独立授权，会话失效后重跑引导。内部文件名和路由不变。 |
| `assets/js/view-report.js` | 顶部打印/JSON/编辑工具栏，共享结论和补证行动，保留章节、计算依据及免责。 |
| `assets/js/view-ai-live.js` | 解析既有 config、服务/模型/鉴权分离、调用前门控、401 后禁用鉴权调用；API 路径和请求 schema 不变。 |
| `assets/js/app.js` | 仅将服务显示判断从错误的 ready 改为现有 config 的 available；绑定及壳层控制逻辑不变。 |
| `assets/js/view-landing.js` | 主入口文字 Get started。 |
| `assets/styles.css` | 仅末尾追加浅色 token、排版、布局、控件、可视行、焦点、手机和减少动态覆盖；修正打印 flex 分页造成的末尾空白页。 |
| `index.html` | theme-color 与浅色页面一致。脚本顺序和零构建模式不变。 |
| `agent/test/frontend-enterprise-experience.test.js` | 结论、实际保存、Undo、额外元数据、JSON 双向切换、非法 JSON、成对值、时间戳、定位、AI 能力/会话/独立授权、错误降级与异步切页保护回归。 |
| 本文 | 方案、逐文件交付与验收记录。 |

## 验收

- 实际 Chrome：Workspace 新评估直接打开九字段；示例一击得到结果，低于 30 秒开发者走查目标；示例 Grade A 与 Further review required 同时呈现，并明确 Synthetic data。
- 实际 Chrome：通过九字段 JSON 进入可视表单，运行有限评估显示 More evidence needed / Not computable；Add missing data 展开 Token 组并聚焦有效率字段，补入有效率后重跑更新 Valid NT。
- 实际 Chrome：非法 JSON 阻止切换；报告 JSON 下载后通过 Workspace 原样恢复结论、分数和示例标识，提问仍禁用且授权未继承。
- 实际 Chrome：删除出现 Undo，恢复原列表首项；自动回归另覆盖清空、五份上限及活动草稿。
- 实际 Chrome 1440 / 768 / 420 / 375px：浅色内容面、操作与标题正常布局；手机主工具栏可达。键盘定位焦点验证通过。DevTools 减少动态仿真后内容完整静态呈现。未注入浏览器控制台脚本，也不把页面隐藏溢出作为实测尺寸证明。
- 实际 Chrome 打印：3 页，章节与 D 节免责完整，末页无空白页；关闭的可选附录不打印。PDF 预览逐页核对。
- 既有 100 项回归加新增 9 项回归：109 项全部通过。完整 verify-release 门禁通过。
- 语法、前端措辞/fetch/零构建纪律、开发隔离、全部测试、完整 verify-release 门禁均运行。TypeScript 5.9.2 工具链放在仓库外 `/Users/yimingyang/fc-agent/tools/typescript/`，按既有 `agent/tsconfig.json` 检查其限定的服务端文件；前端仍为原生 JS，以全量语法与行为回归验证。
- CSS 花括号配平及 Git whitespace 检查通过。冻结数据、公式、状态、ui、生成引擎与其源码零改动；app/home 仅上述有授权的显示差异。API、schema、快照版本无改动。

## 仍需外部验证

真实企业用户五分钟任务完成情况、外部用户走查、真实证据连接器和评分校准尚未完成，沿用 `docs/external-validation-plan.md` 记录的依赖。开发者走查和模拟响应不代替真实用户测试或真实模型服务验收。本轮不部署、不发布，不向生产仓库或平台提交。

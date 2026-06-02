# src/components/

> L2 | 父级: ../AGENTS.md

成员清单
Composer.tsx: 对话输入器组件，提供消息草稿、单聊/群聊模式开关、右侧发送按钮与禁用态
ConversationHeader.tsx: 对话头部组件，展示标题、direct/group 完成态与终止群聊入口
ConversationSidePanel.tsx: 对话右侧辅助栏组件，组合会话人物、人物加入器与任务状态摘要
ConversationWorkspace.tsx: 对话工作区组件，渲染消息时间线、运行态头部与右控式输入器
DistillWorkspace.tsx: Distill 工作区组件，展示中文化 evidence count、Skill 结构与蒸馏入口
EvidencePanel.tsx: 右侧证据与输出面板，展示资料片段、Skill 引用、对话摘要、群聊链路与单人物切换下拉
JobPanel.tsx: 对话任务摘要组件，呈现导入/蒸馏/运行状态的简短说明
MessageTimeline.tsx: 对话时间线组件，按发送者与消息类型渲染消息流
ParticipantTray.tsx: 对话参与者托盘组件，展示当前在场人物、人数与模式提示并提供移除动作
PeoplePanel.tsx: 左侧人物矩阵组件，承载真实人物库列表、中文状态标签、女娲同步入口与当前人物删除动作
PersonaPicker.tsx: 对话人物选择器组件，从人物库选择对象并加入会话
ResearchWorkspace.tsx: Research 工作区组件，编辑种子链接、主题词、采集深度并触发 crawl
useConversationController.ts: 对话状态 hook，管理会话创建、参与者同步、run polling、单聊/群聊动作与任务文案
WorkflowTabs.tsx: 工作流分段控件，以中文标签切换 Research/Distill/Conversation 三种模式

法则: 成员完整·一行一文件·父级链接·技术词前置

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md

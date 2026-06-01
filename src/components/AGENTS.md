# src/components/

> L2 | 父级: ../AGENTS.md

成员清单
Composer.tsx: 对话输入器组件，提供消息草稿、发送、单聊与群聊动作按钮
ConversationHeader.tsx: 对话头部组件，展示标题、运行状态与终止群聊入口
ConversationWorkspace.tsx: 对话工作区组件，编排会话创建、参与者、消息流与 run 控制
DistillWorkspace.tsx: Distill 工作区组件，展示中文化 evidence count、Skill 结构与蒸馏入口
EvidencePanel.tsx: 右侧证据与输出面板，展示 fragments、skill、verdict、critique 与单人物切换下拉
JobPanel.tsx: 对话任务摘要组件，呈现导入/蒸馏/运行状态的简短说明
MessageTimeline.tsx: 对话时间线组件，按发送者渲染消息流
ParticipantTray.tsx: 对话参与者托盘组件，展示当前在场人物并提供移除动作
PeoplePanel.tsx: 左侧人物矩阵组件，渲染中文 seed personas、状态与标签
PersonaPicker.tsx: 对话人物选择器组件，从人物库选择对象并加入会话
ResearchWorkspace.tsx: Research 工作区组件，编辑种子链接、主题词、采集深度并触发 crawl
WorkflowTabs.tsx: 工作流分段控件，以中文标签切换 Research/Distill/Conversation 三种模式

法则: 成员完整·一行一文件·父级链接·技术词前置

[PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md

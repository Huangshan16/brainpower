/**
 * [INPUT]: 依赖 React 状态与副作用、ApiClient seam 与人物库摘要驱动对话工作台
 * [OUTPUT]: 对外提供 ConversationWorkspace 组件
 * [POS]: src/components 的对话主工作区，被 App 消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { useEffect, useMemo, useState } from "react";
import type { ApiClient } from "../api/client";
import { Composer } from "./Composer";
import { ConversationHeader } from "./ConversationHeader";
import { JobPanel } from "./JobPanel";
import { MessageTimeline } from "./MessageTimeline";
import { ParticipantTray } from "./ParticipantTray";
import { PersonaPicker } from "./PersonaPicker";

type LibraryPerson = {
  id: string;
  name: string;
};

type UiMessage = {
  id: string;
  senderType: string;
  senderName: string;
  content: string;
};

function mapSenderName(people: LibraryPerson[], senderType: string, senderId: string) {
  if (senderType === "user") {
    return "你";
  }

  if (senderType === "system") {
    return "系统";
  }

  return people.find((person) => person.id === senderId)?.name ?? senderId;
}

export function ConversationWorkspace({
  api,
  libraryPeople,
  selectedPersonId
}: {
  api?: ApiClient;
  libraryPeople: LibraryPerson[];
  selectedPersonId: string;
}) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Array<{ id: string; name: string; skillId: string }>>([]);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [draft, setDraft] = useState("你会如何判断这个项目？");
  const [runState, setRunState] = useState<"idle" | "direct" | "group_running" | "group_stopped">("idle");
  const [selectedAddPersonId, setSelectedAddPersonId] = useState(selectedPersonId);
  const [runId, setRunId] = useState<string | null>(null);
  const [jobNote, setJobNote] = useState("已连接对话工作台。下一步是添加人物并发起第一条消息。");

  const peopleById = useMemo(() => new Map(libraryPeople.map((person) => [person.id, person.name])), [libraryPeople]);

  useEffect(() => {
    if (libraryPeople.length === 0) {
      if (selectedAddPersonId) {
        setSelectedAddPersonId("");
      }

      return;
    }

    if (!selectedAddPersonId || !peopleById.has(selectedAddPersonId)) {
      setSelectedAddPersonId(selectedPersonId && peopleById.has(selectedPersonId) ? selectedPersonId : libraryPeople[0].id);
    }
  }, [libraryPeople, peopleById, selectedAddPersonId, selectedPersonId]);

  async function ensureConversation() {
    if (conversationId) {
      return conversationId;
    }

    if (!api) {
      throw new Error("未接入对话 API。");
    }

    const conversation = await api.createConversation({ title: "数字高人对话", mode: "group" });
    setConversationId(conversation.id);
    return conversation.id;
  }

  async function syncMessages(nextConversationId: string) {
    if (!api) {
      return;
    }

    const payload = await api.listConversationMessages({ conversationId: nextConversationId });
    const mapped = payload.messages.map((message) => {
      const senderType = String(message.senderType ?? "system");
      const senderId = String(message.senderId ?? "system");

      return {
        id: String(message.id),
        senderType,
        senderName: mapSenderName(libraryPeople, senderType, senderId),
        content: String(message.content ?? "")
      };
    });

    setMessages(mapped);
  }

  async function handleAddParticipant() {
    const person = libraryPeople.find((entry) => entry.id === selectedAddPersonId);

    if (!person) {
      return;
    }

    if (!api) {
      setJobNote("未接入对话 API。");
      return;
    }

    const nextConversationId = await ensureConversation();
    await api.addConversationParticipant({
      conversationId: nextConversationId,
      personId: person.id,
      skillId: `${person.id}-v1`,
      joinSource: "library"
    });

    setParticipants((current) => {
      if (current.some((participant) => participant.id === person.id)) {
        return current;
      }

      return [...current, { id: person.id, name: person.name, skillId: `${person.id}-v1` }];
    });
    setJobNote(`${person.name} 已加入会话。`);
  }

  async function handleRemoveParticipant(participant: { id: string; name: string; skillId: string }) {
    if (!api || !conversationId) {
      return;
    }

    await api.removeConversationParticipant({
      conversationId,
      personId: participant.id,
      skillId: participant.skillId
    });
    setParticipants((current) => current.filter((entry) => entry.id !== participant.id));
    setJobNote(`${participant.name} 已移出会话。`);
  }

  async function sendUserMessage() {
    if (!api) {
      throw new Error("未接入对话 API。");
    }

    const nextConversationId = await ensureConversation();
    const message = await api.sendConversationMessage({
      conversationId: nextConversationId,
      content: draft,
      senderType: "user",
      senderId: "user"
    });

    await syncMessages(nextConversationId);
    return { conversationId: nextConversationId, messageId: String(message.id) };
  }

  async function handleSend() {
    await sendUserMessage();
    setJobNote("消息已写入会话。你可以继续发送，或立即发起单聊 / 群聊。");
  }

  async function handleDirect() {
    if (!api) {
      setJobNote("未接入对话 API。");
      return;
    }

    const speaker = participants[0] ?? libraryPeople.find((person) => person.id === selectedPersonId);

    if (!speaker) {
      setJobNote("请先添加至少 1 位人物。");
      return;
    }

    const next = await sendUserMessage();
    await api.startDirectRun({
      conversationId: next.conversationId,
      messageId: next.messageId,
      speakerPersonId: speaker.id
    });
    await syncMessages(next.conversationId);
    setRunState("direct");
    setJobNote(`${speaker.name} 已完成一轮单聊回复。`);
  }

  async function handleGroup() {
    if (!api) {
      setJobNote("未接入对话 API。");
      return;
    }

    if (participants.length === 0) {
      setJobNote("群聊前至少需要 1 位人物。");
      return;
    }

    const next = await sendUserMessage();
    const run = await api.startGroupRun({
      conversationId: next.conversationId,
      messageId: next.messageId
    });
    await syncMessages(next.conversationId);
    setRunId(String(run.id));
    setRunState("group_running");
    setJobNote("群聊已拉起，当前轮次消息已写入。");
  }

  async function handleStop() {
    if (!api || !conversationId || !runId) {
      return;
    }

    await api.stopGroupRun({ conversationId, runId });
    setRunState("group_stopped");
    setJobNote("群聊已终止，但消息历史已保留。");
  }

  return (
    <section className="workspace-card conversation-workspace">
      <ConversationHeader onStop={() => void handleStop()} runState={runState} title="对话工作台" />
      <ParticipantTray onRemove={(participant) => void handleRemoveParticipant(participant)} participants={participants} />
      <MessageTimeline messages={messages} />
      <Composer
        disabled={!api}
        draft={draft}
        onChange={setDraft}
        onDirect={() => void handleDirect()}
        onGroup={() => void handleGroup()}
        onSend={() => void handleSend()}
      />
      <PersonaPicker
        onAdd={() => void handleAddParticipant()}
        onSelect={setSelectedAddPersonId}
        people={libraryPeople}
        selectedPersonId={selectedAddPersonId}
      />
      <JobPanel note={jobNote} />
    </section>
  );
}

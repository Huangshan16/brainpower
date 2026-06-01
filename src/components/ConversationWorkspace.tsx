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

type RunState = "idle" | "direct" | "group_running" | "group_stopped" | "group_completed" | "group_failed";

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
  const [participants, setParticipants] = useState<Array<{ id: string; name: string; skillId: string | null }>>([]);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [draft, setDraft] = useState("你会如何判断这个项目？");
  const [runState, setRunState] = useState<RunState>("idle");
  const [selectedAddPersonId, setSelectedAddPersonId] = useState(selectedPersonId);
  const [runId, setRunId] = useState<string | null>(null);
  const [jobNote, setJobNote] = useState("已连接对话工作台。下一步是添加人物并发起第一条消息。");
  const [isBusy, setIsBusy] = useState(false);

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

  async function syncParticipants(nextConversationId: string) {
    if (!api) {
      return [];
    }

    const payload = await api.listConversationParticipants({ conversationId: nextConversationId });
    const mapped = payload.participants.map((participant) => ({
      id: participant.personId,
      name: peopleById.get(participant.personId) ?? participant.personId,
      skillId: participant.skillId
    }));

    setParticipants(mapped);
    return mapped;
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

  async function syncRunState(nextConversationId: string, nextRunId: string) {
    if (!api) {
      return;
    }

    const run = await api.getConversationRun({ conversationId: nextConversationId, runId: nextRunId });
    const status = String(run.status ?? "running");

    setRunState(
      status === "completed" ? "group_completed" : status === "stopped" ? "group_stopped" : status === "failed" ? "group_failed" : "group_running"
    );

    if (status !== "running") {
      setRunId(null);
    }
  }

  useEffect(() => {
    if (!api || !conversationId || !runId || runState !== "group_running") {
      return;
    }

    const timer = setInterval(() => {
      void Promise.all([syncMessages(conversationId), syncParticipants(conversationId), syncRunState(conversationId, runId)]);
    }, 1200);

    return () => {
      clearInterval(timer);
    };
  }, [api, conversationId, runId, runState]);

  async function ensureParticipant(personId: string) {
    const existing = participants.find((participant) => participant.id === personId);

    if (existing) {
      return existing;
    }

    const person = libraryPeople.find((entry) => entry.id === personId);

    if (!person) {
      throw new Error("人物不存在。");
    }

    const nextConversationId = await ensureConversation();
      await api?.addConversationParticipant({
        conversationId: nextConversationId,
        personId: person.id,
        joinSource: "library"
      });
    const nextParticipants = await syncParticipants(nextConversationId);
    const inserted = nextParticipants.find((participant) => participant.id === person.id);
    return inserted ?? { id: person.id, name: person.name, skillId: null };
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
    setIsBusy(true);

    try {
      await api.addConversationParticipant({
        conversationId: nextConversationId,
        personId: person.id,
        joinSource: "library"
      });
      await syncParticipants(nextConversationId);
    } catch (error) {
      setJobNote(error instanceof Error ? error.message : "加入会话失败。");
      return;
    } finally {
      setIsBusy(false);
    }

    setJobNote(`${person.name} 已加入会话。`);
  }

  async function handleRemoveParticipant(participant: { id: string; name: string; skillId: string | null }) {
    if (!api || !conversationId) {
      return;
    }

    setIsBusy(true);

    try {
      await api.removeConversationParticipant({
        conversationId,
        personId: participant.id
      });
      await syncParticipants(conversationId);
      setJobNote(`${participant.name} 已移出会话。`);
    } catch (error) {
      setJobNote(error instanceof Error ? error.message : "移出会话失败。");
    } finally {
      setIsBusy(false);
    }
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

    await Promise.all([syncMessages(nextConversationId), syncParticipants(nextConversationId)]);
    return { conversationId: nextConversationId, messageId: String(message.id) };
  }

  async function handleSend() {
    if (!draft.trim()) {
      setJobNote("先输入消息。");
      return;
    }

    setIsBusy(true);

    try {
      await sendUserMessage();
      setDraft("");
      setRunState("idle");
      setJobNote("消息已写入会话。你可以继续发送，或立即发起单聊 / 群聊。");
    } catch (error) {
      setJobNote(error instanceof Error ? error.message : "消息发送失败。");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDirect() {
    if (!api) {
      setJobNote("未接入对话 API。");
      return;
    }

    if (!draft.trim()) {
      setJobNote("先输入消息。");
      return;
    }

    const fallbackSpeaker = libraryPeople.find((person) => person.id === selectedPersonId) ?? libraryPeople[0];

    if (!fallbackSpeaker) {
      setJobNote("请先选择 1 位人物。");
      return;
    }

    setIsBusy(true);

    try {
      const speaker = await ensureParticipant(fallbackSpeaker.id);
      const next = await sendUserMessage();
      await api.startDirectRun({
        conversationId: next.conversationId,
        messageId: next.messageId,
        speakerPersonId: speaker.id
      });
      await Promise.all([syncMessages(next.conversationId), syncParticipants(next.conversationId)]);
      setDraft("");
      setRunId(null);
      setRunState("direct");
      setJobNote(`${speaker.name} 已完成一轮单聊回复。`);
    } catch (error) {
      setJobNote(error instanceof Error ? error.message : "单聊失败。");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleGroup() {
    if (!api) {
      setJobNote("未接入对话 API。");
      return;
    }

    if (!draft.trim()) {
      setJobNote("先输入消息。");
      return;
    }

    if (participants.length < 2) {
      setJobNote("群聊至少需要 2 位人物。先把更多人物加入会话。");
      return;
    }

    setIsBusy(true);

    try {
      const next = await sendUserMessage();
      const run = await api.startGroupRun({
        conversationId: next.conversationId,
        messageId: next.messageId
      });
      await Promise.all([syncMessages(next.conversationId), syncParticipants(next.conversationId)]);
      setDraft("");
      setRunId(String(run.id));
      setRunState("group_running");
      setJobNote("群聊已拉起，人物会继续多轮交锋，直到你终止或自动完成。");
    } catch (error) {
      setJobNote(error instanceof Error ? error.message : "群聊启动失败。");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleStop() {
    if (!api || !conversationId || !runId) {
      return;
    }

    setIsBusy(true);

    try {
      await api.stopGroupRun({ conversationId, runId });
      await Promise.all([syncMessages(conversationId), syncRunState(conversationId, runId)]);
      setJobNote("群聊已终止，但消息历史已保留。");
    } catch (error) {
      setJobNote(error instanceof Error ? error.message : "终止群聊失败。");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <section className="workspace-card conversation-workspace">
      <ConversationHeader onStop={() => void handleStop()} runState={runState} title="对话工作台" />
      <ParticipantTray onRemove={(participant) => void handleRemoveParticipant(participant)} participants={participants} />
      <MessageTimeline messages={messages} />
      <Composer
        disabled={!api || isBusy || runState === "group_running"}
        directDisabled={libraryPeople.length === 0}
        groupDisabled={participants.length < 2 || runState === "group_running"}
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

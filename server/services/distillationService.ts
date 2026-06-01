/**
 * [INPUT]: 依赖 better-sqlite3 读取 people/skills 与消息上下文，作为对未来真实蒸馏模型的可替换 seam
 * [OUTPUT]: 对外提供 createDistillationService 工厂与 persona reply stub
 * [POS]: server/services 的会话回复生成接缝，被 conversationRunService 调用而不直接暴露 HTTP
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import type Database from "better-sqlite3";

type PersonaReplyInput = {
  conversationId: string;
  messageId: string;
  speakerPersonId: string;
  mode: "direct" | "group";
  prompt: string;
};

export function createDistillationService(db: Database.Database) {
  return {
    generatePersonaReply(input: PersonaReplyInput) {
      const person = db
        .prepare("select name from people where id = ?")
        .get(input.speakerPersonId) as { name: string } | undefined;
      const skill = db
        .prepare("select version from skills where person_id = ? order by version desc, created_at desc limit 1")
        .get(input.speakerPersonId) as { version: number } | undefined;

      if (!person) {
        throw new Error("Persona not found");
      }

      const prefix = input.mode === "group" ? "群聊首轮判断" : "直接回复";
      const version = skill?.version ?? 0;

      return {
        content: `${person.name} v${version}: ${prefix}，先给一句判断。${input.prompt}`.trim(),
        meta: {
          source: "distillation_stub",
          conversationId: input.conversationId,
          messageId: input.messageId,
          mode: input.mode
        }
      };
    }
  };
}

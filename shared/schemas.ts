/**
 * [INPUT]: 依赖 zod 的运行时 schema 与类型推导能力
 * [OUTPUT]: 对外提供 PersonSchema、SourceSchema、FragmentSchema、SkillSchema、EvaluationSchema、CritiqueSchema、JobSchema 与类型
 * [POS]: shared 的契约中心，被前端 API client 与后端服务共同消费
 * [PROTOCOL]: 变更时更新此头部，然后检查 AGENTS.md
 */
import { z } from "zod";

export const PersonSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.enum(["investor", "entrepreneur", "ai_builder"]),
  region: z.string(),
  tags: z.array(z.string()),
  status: z.enum(["needs_research", "researching", "ready_to_distill", "ready_to_evaluate"]),
  notes: z.string().optional()
});

export const SourceSchema = z.object({
  id: z.string(),
  personId: z.string(),
  url: z.string().url(),
  title: z.string(),
  sourceType: z.string(),
  trustLevel: z.string(),
  crawlStatus: z.string(),
  fetchedAt: z.string().nullable().optional(),
  createdAt: z.string()
});

export const FragmentSchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  personId: z.string(),
  content: z.string(),
  summary: z.string(),
  timelineTag: z.string(),
  evidenceType: z.string(),
  createdAt: z.string()
});

export const SkillSchema = z.object({
  id: z.string(),
  personId: z.string(),
  name: z.string(),
  description: z.string(),
  principles: z.array(z.string()),
  evidenceFragmentIds: z.array(z.string()),
  confidence: z.number().min(0).max(1)
});

export const EvaluationSchema = z.object({
  id: z.string(),
  personId: z.string(),
  prompt: z.string(),
  output: z.string(),
  scores: z.array(z.object({
    name: z.string(),
    value: z.number().min(0).max(1)
  })),
  evidenceFragmentIds: z.array(z.string()),
  createdAt: z.string()
});

export const CritiqueSchema = z.object({
  id: z.string(),
  evaluationId: z.string(),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  missingEvidence: z.array(z.string()),
  recommendation: z.string(),
  createdAt: z.string()
});

export const JobSchema = z.object({
  id: z.string(),
  type: z.enum(["crawl", "research", "distill", "evaluate"]),
  status: z.enum(["queued", "running", "succeeded", "failed"]),
  personId: z.string().optional(),
  input: z.array(z.string()),
  output: z.array(z.string()),
  error: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string()
});

export type Person = z.infer<typeof PersonSchema>;
export type Source = z.infer<typeof SourceSchema>;
export type Fragment = z.infer<typeof FragmentSchema>;
export type Skill = z.infer<typeof SkillSchema>;
export type Evaluation = z.infer<typeof EvaluationSchema>;
export type Critique = z.infer<typeof CritiqueSchema>;
export type Job = z.infer<typeof JobSchema>;

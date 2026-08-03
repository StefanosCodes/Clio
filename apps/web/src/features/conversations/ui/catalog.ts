import { ListChecks, RefreshCw, WandSparkles, type LucideIcon } from "lucide-react";

export type SkillCatalogItem = {
  id: string;
  command: string;
  title: string;
  description: string;
  icon: LucideIcon;
  prompt: string;
};

export const planningSkills: SkillCatalogItem[] = [
  {
    id: "plan-new-work",
    command: "plan",
    title: "Plan new work",
    description: "Shape an outcome into a clear plan",
    icon: ListChecks,
    prompt: "Help me shape a new product outcome into a clear plan.",
  },
  {
    id: "turn-context-into-work",
    command: "context",
    title: "Turn context into work",
    description: "Convert context into reviewable work",
    icon: WandSparkles,
    prompt: "Turn the context I share into concrete, reviewable work.",
  },
  {
    id: "improve-existing-work",
    command: "improve",
    title: "Improve existing work",
    description: "Improve work without losing its intent",
    icon: RefreshCw,
    prompt: "Help me improve an existing piece of work without losing its intent.",
  },
];

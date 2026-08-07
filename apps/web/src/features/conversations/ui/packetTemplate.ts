export function createBuildPacketTemplate(organizationName: string) {
  return {
    title: "Planning workspace for clear, accepted work",
    outcome:
      "Turn Clio M1 into a planning workspace where a user can start a conversation, shape intent, and open a useful Build Packet without needing to understand implementation details.",
    audience: organizationName,
    status: "Draft",
    context_summary:
      "The current shell is close to the intended Codex-like experience, but the Build Packet needs to feel like the durable artifact produced by the conversation rather than a short form with three fields.",
    decision_flow: [
      {
        from: "Conversation intent",
        to: "Planning questions",
        label: "Clarify scope",
      },
      {
        from: "Planning questions",
        to: "Build Packet",
        label: "Structure evidence",
      },
      {
        from: "Build Packet",
        to: "Accepted work",
        label: "Version and hand off",
      },
    ],
    milestones: [
      {
        label: "M1",
        status: "In review",
        owner: "Product",
        summary:
          "Conversation shell, draft creation, settings sidebar, and explicit Build Packet opening.",
      },
      {
        label: "M2",
        status: "Next",
        owner: "Packet and source core",
        summary:
          "Establish canonical packet contracts, source handling, and verified organization isolation.",
      },
      {
        label: "M3",
        status: "Later",
        owner: "Planning agent",
        summary:
          "Turn a messy request into a valid Build Packet through one controlled planning agent.",
      },
    ],
    acceptance_checks: [
      "New Chat does not create a saved sidebar item until the first user message.",
      "Build Packet stays closed until the user opens it from chat context.",
      "The left sidebar can collapse into an icon rail and expand again.",
      "Settings replaces the sidebar with a dedicated settings navigation.",
      "The composer stays focused on the prompt and send action.",
    ],
    evidence: [
      {
        label: "UX reference",
        source: "Codex desktop patterns",
        status: "Reviewed",
      },
      {
        label: "User feedback",
        source: "M1 review conversation",
        status: "Active input",
      },
      {
        label: "Implementation proof",
        source: "Frontend tests and fixture states",
        status: "Passing",
      },
    ],
    risks: [
      {
        label: "Mock data can overpromise intelligence",
        mitigation:
          "Keep copy explicit that M1 is fixture-backed while making the artifact shape realistic.",
      },
      {
        label: "Settings and planning tools can compete",
        mitigation:
          "Move knowledge base and plugins into settings; keep the composer focused on planning actions.",
      },
      {
        label: "Packet can feel like a form",
        mitigation:
          "Render a calm document with clear sections, flow, milestones, evidence, and checks.",
      },
    ],
    connectors: [
      {
        name: "Linear",
        status: "Planned",
        detail: "Create accepted scope and follow-up issues from packet sections.",
      },
      {
        name: "GitHub",
        status: "Planned",
        detail: "Attach implementation evidence, branches, and pull requests.",
      },
      {
        name: "Knowledge Base",
        status: "Available in settings",
        detail: "Provide source context before plan generation.",
      },
    ],
    open_questions: [
      "Which packet sections should be required before handoff?",
      "When should Clio ask a clarifying question instead of drafting immediately?",
      "Which connector actions belong in M1 versus later milestones?",
    ],
  };
}

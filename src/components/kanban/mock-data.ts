export type TaskPriority = "low" | "medium" | "high"

export interface TaskAssignee {
  name: string
  avatar: string
}

export interface MockTask {
  id: string
  code: string
  title: string
  priority: TaskPriority
  description: string
  assignee: TaskAssignee
  labels: string[]
  dueDate: string
  estimate: string
  comments: number
  attachments: number
}

export const COLUMN_TITLES: Record<string, string> = {
  backlog: "Backlog",
  todo: "Todo",
  inProgress: "In Progress",
  review: "Review",
  done: "Done",
}

export const INITIAL_COLUMNS: Record<string, MockTask[]> = {
  backlog: [
    {
      id: "task-1",
      code: "PRD-12",
      title: "Design onboarding flow",
      priority: "high",
      description: "Map the first-run journey, empty states, and setup checklist.",
      assignee: {
        name: "Emma Wilson",
        avatar:
          "https://images.unsplash.com/photo-1485893086445-ed75865251e0?w=96&h=96&dpr=2&q=80",
      },
      labels: ["Product", "Design"],
      dueDate: "Jun 15",
      estimate: "5 pts",
      comments: 4,
      attachments: 2,
    },
    {
      id: "task-2",
      code: "DOC-07",
      title: "Write API docs",
      priority: "medium",
      description: "Document auth, task, and webhook endpoints with request samples.",
      assignee: {
        name: "Sarah Chen",
        avatar:
          "https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=96&h=96&dpr=2&q=80",
      },
      labels: ["Docs"],
      dueDate: "Jun 18",
      estimate: "3 pts",
      comments: 1,
      attachments: 3,
    },
  ],
  todo: [
    {
      id: "task-3",
      code: "DB-03",
      title: "Define data schema",
      priority: "low",
      description: "Model tasks, events, attachments, and employee links.",
      assignee: {
        name: "Michael Rodriguez",
        avatar:
          "https://images.unsplash.com/photo-1584308972272-9e4e7685e80f?w=96&h=96&dpr=2&q=80",
      },
      labels: ["Backend"],
      dueDate: "Jun 22",
      estimate: "3 pts",
      comments: 0,
      attachments: 1,
    },
    {
      id: "task-4",
      code: "SEC-08",
      title: "Add authentication",
      priority: "high",
      description: "Google sign-in with a manager allowlist re-checked per session.",
      assignee: {
        name: "Alex Johnson",
        avatar:
          "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80",
      },
      labels: ["Security", "Backend"],
      dueDate: "Jun 10",
      estimate: "8 pts",
      comments: 6,
      attachments: 2,
    },
    {
      id: "task-5",
      code: "API-11",
      title: "Create API endpoints",
      priority: "medium",
      description: "Expose task CRUD and webhook handlers for the Zalo flow.",
      assignee: {
        name: "Sarah Chen",
        avatar:
          "https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=96&h=96&dpr=2&q=80",
      },
      labels: ["API"],
      dueDate: "Jun 15",
      estimate: "5 pts",
      comments: 2,
      attachments: 0,
    },
  ],
  inProgress: [
    {
      id: "task-6",
      code: "DS-31",
      title: "Design system updates",
      priority: "high",
      description:
        "Reconcile radius, shadow, and neutral color tokens across the workspace.",
      assignee: {
        name: "Emma Wilson",
        avatar:
          "https://images.unsplash.com/photo-1485893086445-ed75865251e0?w=96&h=96&dpr=2&q=80",
      },
      labels: ["Design"],
      dueDate: "Aug 25",
      estimate: "8 pts",
      comments: 3,
      attachments: 4,
    },
    {
      id: "task-7",
      code: "UI-19",
      title: "Implement dark mode",
      priority: "medium",
      description: "Audit contrast, chart colors, and empty states for dark theme parity.",
      assignee: {
        name: "David Kim",
        avatar:
          "https://images.unsplash.com/photo-1607990281513-2c110a25bd8c?w=96&h=96&dpr=2&q=80",
      },
      labels: ["UI"],
      dueDate: "Aug 25",
      estimate: "5 pts",
      comments: 1,
      attachments: 0,
    },
  ],
  review: [
    {
      id: "task-8",
      code: "QA-04",
      title: "Review auth flow",
      priority: "medium",
      description: "Verify invites, role changes, and expired token states.",
      assignee: {
        name: "Alex Johnson",
        avatar:
          "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80",
      },
      labels: ["Security"],
      dueDate: "Jun 12",
      estimate: "3 pts",
      comments: 5,
      attachments: 0,
    },
  ],
  done: [
    {
      id: "task-9",
      code: "OPS-01",
      title: "Setup project and scaffolding",
      priority: "high",
      description: "Ship isolated preview builds for every registry component change.",
      assignee: {
        name: "Aron Thompson",
        avatar:
          "https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=96&h=96&dpr=2&q=80",
      },
      labels: ["Setup"],
      dueDate: "Sep 25",
      estimate: "5 pts",
      comments: 2,
      attachments: 1,
    },
    {
      id: "task-10",
      code: "GIT-02",
      title: "Initial commit",
      priority: "low",
      description: "Create the first grouped component entries with preview metadata.",
      assignee: {
        name: "James Brown",
        avatar:
          "https://images.unsplash.com/photo-1543299750-19d1d6297053?w=96&h=96&dpr=2&q=80",
      },
      labels: ["Setup"],
      dueDate: "Sep 20",
      estimate: "1 pt",
      comments: 0,
      attachments: 0,
    },
  ],
}

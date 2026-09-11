export type TaskPriority = "low" | "medium" | "high"

export interface TaskAssignee {
  name: string
  avatar: string
}

export interface MockTask {
  id: string
  title: string
  priority: TaskPriority
  assignee: TaskAssignee
  labels: string[]
  dueDate: string
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
      title: "Design onboarding flow",
      priority: "high",
      assignee: {
        name: "Emma Wilson",
        avatar:
          "https://images.unsplash.com/photo-1485893086445-ed75865251e0?w=96&h=96&dpr=2&q=80",
      },
      labels: ["Product", "Design"],
      dueDate: "Jun 15",
      comments: 4,
      attachments: 2,
    },
    {
      id: "task-2",
      title: "Write API docs",
      priority: "medium",
      assignee: {
        name: "Sarah Chen",
        avatar:
          "https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=96&h=96&dpr=2&q=80",
      },
      labels: ["Docs"],
      dueDate: "Jun 18",
      comments: 1,
      attachments: 3,
    },
  ],
  todo: [
    {
      id: "task-3",
      title: "Define data schema",
      priority: "low",
      assignee: {
        name: "Michael Rodriguez",
        avatar:
          "https://images.unsplash.com/photo-1584308972272-9e4e7685e80f?w=96&h=96&dpr=2&q=80",
      },
      labels: ["Backend"],
      dueDate: "Jun 22",
      comments: 0,
      attachments: 1,
    },
    {
      id: "task-4",
      title: "Add authentication",
      priority: "high",
      assignee: {
        name: "Alex Johnson",
        avatar:
          "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80",
      },
      labels: ["Security", "Backend"],
      dueDate: "Jun 10",
      comments: 6,
      attachments: 2,
    },
    {
      id: "task-5",
      title: "Create API endpoints",
      priority: "medium",
      assignee: {
        name: "Sarah Chen",
        avatar:
          "https://images.unsplash.com/photo-1519699047748-de8e457a634e?w=96&h=96&dpr=2&q=80",
      },
      labels: ["API"],
      dueDate: "Jun 15",
      comments: 2,
      attachments: 0,
    },
  ],
  inProgress: [
    {
      id: "task-6",
      title: "Design system updates",
      priority: "high",
      assignee: {
        name: "Emma Wilson",
        avatar:
          "https://images.unsplash.com/photo-1485893086445-ed75865251e0?w=96&h=96&dpr=2&q=80",
      },
      labels: ["Design"],
      dueDate: "Aug 25",
      comments: 3,
      attachments: 4,
    },
    {
      id: "task-7",
      title: "Implement dark mode",
      priority: "medium",
      assignee: {
        name: "David Kim",
        avatar:
          "https://images.unsplash.com/photo-1607990281513-2c110a25bd8c?w=96&h=96&dpr=2&q=80",
      },
      labels: ["UI"],
      dueDate: "Aug 25",
      comments: 1,
      attachments: 0,
    },
  ],
  review: [
    {
      id: "task-8",
      title: "Review auth flow",
      priority: "medium",
      assignee: {
        name: "Alex Johnson",
        avatar:
          "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=96&h=96&dpr=2&q=80",
      },
      labels: ["Security"],
      dueDate: "Jun 12",
      comments: 5,
      attachments: 0,
    },
  ],
  done: [
    {
      id: "task-9",
      title: "Setup project and scaffolding",
      priority: "high",
      assignee: {
        name: "Aron Thompson",
        avatar:
          "https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=96&h=96&dpr=2&q=80",
      },
      labels: ["Setup"],
      dueDate: "Sep 25",
      comments: 2,
      attachments: 1,
    },
    {
      id: "task-10",
      title: "Initial commit",
      priority: "low",
      assignee: {
        name: "James Brown",
        avatar:
          "https://images.unsplash.com/photo-1543299750-19d1d6297053?w=96&h=96&dpr=2&q=80",
      },
      labels: ["Setup"],
      dueDate: "Sep 20",
      comments: 0,
      attachments: 0,
    },
  ],
}

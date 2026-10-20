export const SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  startDate TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planning',
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'member',
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS project_members (
  projectId INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  memberId INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  PRIMARY KEY (projectId, memberId)
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  projectId INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  parentId INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  startDate TEXT,
  duration INTEGER NOT NULL DEFAULT 1,
  dueDate TEXT,
  status TEXT NOT NULL DEFAULT 'todo',
  priority TEXT NOT NULL DEFAULT 'medium',
  progress INTEGER NOT NULL DEFAULT 0,
  assigneeId INTEGER REFERENCES members(id) ON DELETE SET NULL,
  optimisticDays REAL,
  mostLikelyDays REAL,
  pessimisticDays REAL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS dependencies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  projectId INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  predecessorId INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  successorId INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'FS',
  lag INTEGER NOT NULL DEFAULT 0,
  UNIQUE (projectId, predecessorId, successorId)
);

CREATE TABLE IF NOT EXISTS workdays (
  dayOfWeek INTEGER PRIMARY KEY,
  isWorking INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS holidays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(projectId);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parentId);
CREATE INDEX IF NOT EXISTS idx_dependencies_project ON dependencies(projectId);
CREATE INDEX IF NOT EXISTS idx_dependencies_pred ON dependencies(predecessorId);
CREATE INDEX IF NOT EXISTS idx_dependencies_succ ON dependencies(successorId);
`;

export const DEFAULT_WORKDAYS: Array<{ dayOfWeek: number; isWorking: number }> = [
  { dayOfWeek: 0, isWorking: 0 },
  { dayOfWeek: 1, isWorking: 1 },
  { dayOfWeek: 2, isWorking: 1 },
  { dayOfWeek: 3, isWorking: 1 },
  { dayOfWeek: 4, isWorking: 1 },
  { dayOfWeek: 5, isWorking: 1 },
  { dayOfWeek: 6, isWorking: 0 },
];

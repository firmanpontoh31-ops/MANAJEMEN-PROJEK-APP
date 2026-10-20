/**
 * Ikon terpusat berbasis Lucide (lucide-react).
 * Penggunaan: <Icon name="plus" />  |  <Icon name="trash" size={16} />
 * Nama ikon diketik sehingga salah ketik langsung terdeteksi TypeScript.
 */
import type { CSSProperties } from 'react';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  ArrowUpDown,
  ArrowUpRight,
  Bell,
  Briefcase,
  Building2,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  ChartColumn,
  ChartPie,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  CircleDot,
  ClipboardList,
  Clock,
  Columns3,
  CornerDownRight,
  Eye,
  FileText,
  Flag,
  FolderKanban,
  FolderPlus,
  Gauge,
  Hash,
  Inbox,
  Info,
  Kanban,
  Layers,
  Link2,
  List,
  ListFilter,
  ListTodo,
  LoaderCircle,
  Mail,
  Menu,
  Milestone,
  MoreHorizontal,
  Network,
  PanelLeft,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Rocket,
  Rows3,
  Save,
  Search,
  Share2,
  SlidersHorizontal,
  SquarePen,
  Sun,
  Target,
  Timer,
  Trash2,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  UserCheck,
  UserPlus,
  Users,
  Workflow,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react';

export type IconName =
  | 'grid'
  | 'folder'
  | 'folder-plus'
  | 'users'
  | 'user-check'
  | 'user-plus'
  | 'calendar'
  | 'calendar-plus'
  | 'calendar-clock'
  | 'clock'
  | 'alert-triangle'
  | 'circle-alert'
  | 'check-circle'
  | 'check'
  | 'check-check'
  | 'activity'
  | 'share'
  | 'network'
  | 'workflow'
  | 'calculator'
  | 'plus'
  | 'x'
  | 'pencil'
  | 'edit'
  | 'trash'
  | 'refresh'
  | 'chevron-right'
  | 'chevron-left'
  | 'chevron-down'
  | 'arrow-right'
  | 'arrow-left'
  | 'arrow-up-right'
  | 'arrow-up-down'
  | 'link'
  | 'info'
  | 'flag'
  | 'inbox'
  | 'loader'
  | 'list'
  | 'list-todo'
  | 'list-filter'
  | 'play'
  | 'trending-up'
  | 'trending-down'
  | 'layers'
  | 'external-link'
  | 'chart'
  | 'chart-pie'
  | 'search'
  | 'filter'
  | 'bell'
  | 'menu'
  | 'kanban'
  | 'table'
  | 'columns'
  | 'target'
  | 'timer'
  | 'gauge'
  | 'more'
  | 'eye'
  | 'save'
  | 'zap'
  | 'building'
  | 'mail'
  | 'hash'
  | 'folder-kanban'
  | 'briefcase'
  | 'rocket'
  | 'sun'
  | 'milestone'
  | 'file-text'
  | 'clipboard'
  | 'circle-dot'
  | 'panel-left'
  | 'columns-3'
  | 'corner-down-right';

const MAP: Record<IconName, LucideIcon> = {
  grid: Columns3,
  folder: FolderKanban,
  'folder-plus': FolderPlus,
  users: Users,
  'user-check': UserCheck,
  'user-plus': UserPlus,
  calendar: CalendarDays,
  'calendar-plus': CalendarPlus,
  'calendar-clock': CalendarClock,
  clock: Clock,
  'alert-triangle': TriangleAlert,
  'circle-alert': CircleAlert,
  'check-circle': CircleCheck,
  check: Check,
  'check-check': CheckCheck,
  activity: Activity,
  share: Share2,
  network: Network,
  workflow: Workflow,
  calculator: Zap,
  plus: Plus,
  x: X,
  pencil: Pencil,
  edit: SquarePen,
  trash: Trash2,
  refresh: RefreshCw,
  'chevron-right': ChevronRight,
  'chevron-left': ChevronLeft,
  'chevron-down': ChevronDown,
  'arrow-right': ArrowRight,
  'arrow-left': ArrowLeft,
  'arrow-up-right': ArrowUpRight,
  'arrow-up-down': ArrowUpDown,
  link: Link2,
  info: Info,
  flag: Flag,
  inbox: Inbox,
  loader: LoaderCircle,
  list: List,
  'list-todo': ListTodo,
  'list-filter': ListFilter,
  play: Play,
  'trending-up': TrendingUp,
  'trending-down': TrendingDown,
  layers: Layers,
  'external-link': ArrowUpRight,
  chart: ChartColumn,
  'chart-pie': ChartPie,
  search: Search,
  filter: SlidersHorizontal,
  bell: Bell,
  menu: Menu,
  kanban: Kanban,
  table: Rows3,
  columns: Columns3,
  target: Target,
  timer: Timer,
  gauge: Gauge,
  more: MoreHorizontal,
  eye: Eye,
  save: Save,
  zap: Zap,
  building: Building2,
  mail: Mail,
  hash: Hash,
  'folder-kanban': FolderKanban,
  briefcase: Briefcase,
  rocket: Rocket,
  sun: Sun,
  milestone: Milestone,
  'file-text': FileText,
  clipboard: ClipboardList,
  'circle-dot': CircleDot,
  'panel-left': PanelLeft,
  'columns-3': Columns3,
  'corner-down-right': CornerDownRight,
};

export default function Icon({
  name,
  size = 18,
  className = '',
  style,
  strokeWidth = 2,
}: {
  name: IconName;
  size?: number;
  className?: string;
  style?: CSSProperties;
  strokeWidth?: number;
}) {
  const Cmp = MAP[name];
  return (
    <Cmp
      className={`icon ${className}`.trim()}
      width={size}
      height={size}
      strokeWidth={strokeWidth}
      aria-hidden="true"
      style={style}
    />
  );
}

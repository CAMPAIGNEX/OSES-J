/**
 * Solid, sharp icon set for the whole app (Heroicons 24/solid).
 *
 * Exports keep the names the screens were written with (formerly lucide outlines), so every
 * `import { Search } from "@/components/ui/icons"` renders a filled glyph. Every icon carries
 * `data-icon` so templates (see globals.css) can restyle them globally.
 */
import type { ComponentType, SVGProps } from "react";
import * as H from "@heroicons/react/24/solid";

type IconProps = SVGProps<SVGSVGElement> & { title?: string };
type Hero = ComponentType<SVGProps<SVGSVGElement> & { title?: string; titleId?: string }>;

function make(Icon: Hero, name: string): ComponentType<IconProps> {
  const Wrapped = ({ className, ...props }: IconProps) => <Icon data-icon={name} aria-hidden={props.title ? undefined : true} className={className ?? "h-4 w-4"} {...props} />;
  Wrapped.displayName = name;
  return Wrapped;
}

export const AlertCircle = make(H.ExclamationCircleIcon, "alert-circle");
export const AlertTriangle = make(H.ExclamationTriangleIcon, "alert-triangle");
export const ArrowLeft = make(H.ArrowLeftIcon, "arrow-left");
export const ArrowRight = make(H.ArrowRightIcon, "arrow-right");
export const BarChart3 = make(H.ChartBarIcon, "bar-chart");
export const Bookmark = make(H.BookmarkIcon, "bookmark");
export const BookmarkCheck = make(H.BookmarkSquareIcon, "bookmark-check");
export const BookOpen = make(H.BookOpenIcon, "book-open");
export const Bot = make(H.CpuChipIcon, "bot");
export const Building2 = make(H.BuildingOffice2Icon, "building");
export const CalendarClock = make(H.CalendarDaysIcon, "calendar-clock");
export const Check = make(H.CheckIcon, "check");
export const CheckCircle2 = make(H.CheckCircleIcon, "check-circle");
export const ChevronLeft = make(H.ChevronLeftIcon, "chevron-left");
export const ChevronRight = make(H.ChevronRightIcon, "chevron-right");
export const ChevronsUpDown = make(H.ChevronUpDownIcon, "chevrons-up-down");
export const Clock = make(H.ClockIcon, "clock");
export const Copy = make(H.DocumentDuplicateIcon, "copy");
export const Cpu = make(H.CpuChipIcon, "cpu");
export const Database = make(H.CircleStackIcon, "database");
export const Download = make(H.ArrowDownTrayIcon, "download");
export const ExternalLink = make(H.ArrowTopRightOnSquareIcon, "external-link");
export const Eye = make(H.EyeIcon, "eye");
export const FileText = make(H.DocumentTextIcon, "file-text");
export const Globe = make(H.GlobeAltIcon, "globe");
export const History = make(H.ClockIcon, "history");
export const Home = make(H.HomeIcon, "home");
export const Inbox = make(H.InboxIcon, "inbox");
export const Info = make(H.InformationCircleIcon, "info");
export const KeyRound = make(H.KeyIcon, "key");
export const LayoutDashboard = make(H.Squares2X2Icon, "dashboard");
export const Lifebuoy = make(H.LifebuoyIcon, "lifebuoy");
export const Link2 = make(H.LinkIcon, "link");
export const ListChecks = make(H.QueueListIcon, "list-checks");
export const LogOut = make(H.ArrowRightStartOnRectangleIcon, "log-out");
export const Mail = make(H.EnvelopeIcon, "mail");
export const Megaphone = make(H.MegaphoneIcon, "megaphone");
export const Menu = make(H.Bars3Icon, "menu");
export const MessageCircle = make(H.ChatBubbleOvalLeftEllipsisIcon, "message-circle");
export const MessageSquare = make(H.ChatBubbleLeftIcon, "message-square");
export const MessagesSquare = make(H.ChatBubbleLeftRightIcon, "messages");
export const Moon = make(H.MoonIcon, "moon");
export const Palette = make(H.SwatchIcon, "palette");
export const Pause = make(H.PauseIcon, "pause");
export const Pencil = make(H.PencilIcon, "pencil");
export const Phone = make(H.PhoneIcon, "phone");
export const Play = make(H.PlayIcon, "play");
export const Plug = make(H.BoltIcon, "plug");
export const Plus = make(H.PlusIcon, "plus");
export const Power = make(H.PowerIcon, "power");
export const RefreshCw = make(H.ArrowPathIcon, "refresh");
export const Reply = make(H.ArrowUturnLeftIcon, "reply");
export const Rocket = make(H.RocketLaunchIcon, "rocket");
export const RotateCcw = make(H.ArrowUturnLeftIcon, "rotate");
export const Search = make(H.MagnifyingGlassIcon, "search");
export const Send = make(H.PaperAirplaneIcon, "send");
export const Server = make(H.ServerStackIcon, "server");
export const Settings = make(H.Cog6ToothIcon, "settings");
export const ShieldCheck = make(H.ShieldCheckIcon, "shield-check");
export const ShieldOff = make(H.ShieldExclamationIcon, "shield-off");
export const Signal = make(H.SignalIcon, "signal");
export const SlidersHorizontal = make(H.AdjustmentsHorizontalIcon, "sliders");
export const Sparkles = make(H.SparklesIcon, "sparkles");
export const Square = make(H.StopIcon, "square");
export const Store = make(H.BuildingStorefrontIcon, "store");
export const Sun = make(H.SunIcon, "sun");
export const Table = make(H.TableCellsIcon, "table");
export const Tag = make(H.TagIcon, "tag");
export const Terminal = make(H.CommandLineIcon, "terminal");
export const Trash2 = make(H.TrashIcon, "trash");
export const TrendingUp = make(H.ArrowTrendingUpIcon, "trending-up");
export const Unplug = make(H.BoltSlashIcon, "unplug");
export const Upload = make(H.ArrowUpTrayIcon, "upload");
export const User = make(H.UserIcon, "user");
export const UserPlus = make(H.UserPlusIcon, "user-plus");
export const Users = make(H.UsersIcon, "users");
export const Wand2 = make(H.PaintBrushIcon, "wand");
export const Wrench = make(H.WrenchScrewdriverIcon, "wrench");
export const X = make(H.XMarkIcon, "x");
export const XCircle = make(H.XCircleIcon, "x-circle");
export const Zap = make(H.BoltIcon, "zap");

/** Spinner: a solid arc so it matches the filled icon set. Add `animate-spin` at the call site. */
export function Loader2({ className, ...props }: IconProps) {
  return (
    <svg data-icon="spinner" viewBox="0 0 24 24" fill="none" aria-hidden className={className ?? "h-4 w-4"} {...props}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3.5" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

import autoAwesome from "@material-design-icons/svg/filled/auto_awesome.svg?raw";
import cancel from "@material-design-icons/svg/filled/cancel.svg?raw";
import checkCircle from "@material-design-icons/svg/filled/check_circle.svg?raw";
import close from "@material-design-icons/svg/filled/close.svg?raw";
import darkMode from "@material-design-icons/svg/filled/dark_mode.svg?raw";
import deleteIcon from "@material-design-icons/svg/filled/delete.svg?raw";
import description from "@material-design-icons/svg/filled/description.svg?raw";
import fileUpload from "@material-design-icons/svg/filled/file_upload.svg?raw";
import formatListBulleted from "@material-design-icons/svg/filled/format_list_bulleted.svg?raw";
import help from "@material-design-icons/svg/filled/help.svg?raw";
import info from "@material-design-icons/svg/filled/info.svg?raw";
import lightMode from "@material-design-icons/svg/filled/light_mode.svg?raw";
import playArrow from "@material-design-icons/svg/filled/play_arrow.svg?raw";
import schedule from "@material-design-icons/svg/filled/schedule.svg?raw";
import stop from "@material-design-icons/svg/filled/stop.svg?raw";

const ICONS = {
  "dark-mode": darkMode,
  "light-mode": lightMode,
  help,
  close,
  description,
  play: playArrow,
  stop,
  upload: fileUpload,
  delete: deleteIcon,
  list: formatListBulleted,
  "check-circle": checkCircle,
  "auto-awesome": autoAwesome,
  cancel,
  schedule,
  info,
} as const;

type IconName = keyof typeof ICONS;

export function Icon({ name, className = "icon" }: { name: IconName; className?: string }) {
  return (
    <span
      className={className}
      aria-hidden="true"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: SVGs are bundled from a trusted icon package.
      dangerouslySetInnerHTML={{ __html: ICONS[name] }}
    />
  );
}

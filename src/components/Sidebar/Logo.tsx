
export function SidebarLogo() {
  const { theme, systemTheme } = useTheme();
  const current = theme === "system" ? systemTheme : theme;
  let logo = "/Darkmode nobackground.png";
  if (current === "light") logo = "/Lightmode nobackground.png";
  return (
    <div className="flex items-center gap-2 px-2 py-1 select-none">
      <img src={logo} alt="VWisper Logo" className="w-8 h-8" />
      <span className="text-base font-semibold">VWisper</span>
    </div>
  );
}
import { useTheme } from "next-themes";

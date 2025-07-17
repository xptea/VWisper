import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { IconBrandGithub, IconBrandX, IconWorld, IconBrandDiscord } from "@tabler/icons-react";

export function AppHeader({ section }: { section: string }) {
  const sectionTitle =
    section === "getting-started"
      ? "Getting Started"
      : section === "analytics"
      ? "Analytics"
      : section === "history"
      ? "History"
      : section === "settings"
      ? "Settings"
      : section === "setup"
      ? "Setup"
      : "Dashboard";
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
        <h1 className="text-base font-medium">VWisper - {sectionTitle}</h1>
        <div className="ml-auto flex items-center gap-2">
          <a
            href="https://github.com/your-repo"
            rel="noopener noreferrer"
            target="_blank"
            className="dark:text-foreground hover:text-primary"
            title="GitHub"
          >
            <IconBrandGithub className="w-5 h-5" />
          </a>
          <a
            href="https://x.com/your-x"
            rel="noopener noreferrer"
            target="_blank"
            className="dark:text-foreground hover:text-primary"
            title="X (Twitter)"
          >
            <IconBrandX className="w-5 h-5" />
          </a>
          <a
            href="https://yourwebsite.com"
            rel="noopener noreferrer"
            target="_blank"
            className="dark:text-foreground hover:text-primary"
            title="Website"
          >
            <IconWorld className="w-5 h-5" />
          </a>
          <a
            href="https://discord.gg/your-discord"
            rel="noopener noreferrer"
            target="_blank"
            className="dark:text-foreground hover:text-primary"
            title="Discord"
          >
            <IconBrandDiscord className="w-5 h-5" />
          </a>
        </div>
      </div>
    </header>
  );
}

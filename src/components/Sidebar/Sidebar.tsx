
import * as React from "react";
import { IconRocket, IconDashboard, IconHistory, IconSettings, IconKey } from "@tabler/icons-react";
import { ThemeSwitcher } from "../Utils/Theme";
import { SidebarLogo } from "./Logo";
import { MainNav } from "@/components/Utils/Nav";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

interface SidebarComponentProps extends React.ComponentProps<typeof Sidebar> {
  showSetup?: boolean;
}

export function SidebarComponent({ showSetup = false, ...props }: SidebarComponentProps) {
  const navMain = React.useMemo(() => {
    if (showSetup) {
      return [
        {
          title: "Setup",
          url: "#setup",
          icon: IconKey,
        },
      ];
    }
    
    return [
      {
        title: "Getting Started",
        url: "#getting-started",
        icon: IconRocket,
      },
      {
        title: "Analytics",
        url: "#analytics",
        icon: IconDashboard,
      },
      {
        title: "History",
        url: "#history",
        icon: IconHistory,
      },
      {
        title: "Settings",
        url: "#settings",
        icon: IconSettings,
      },
    ];
  }, [showSetup]);

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarLogo />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <MainNav items={navMain} />
      </SidebarContent>
      <SidebarFooter>
        <ThemeSwitcher />
      </SidebarFooter>
    </Sidebar>
  );
}

export { SidebarComponent as Sidebar };

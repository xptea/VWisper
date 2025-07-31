import * as React from "react"
import { Link, useLocation } from "react-router-dom"
import {
  IconSettings,
  IconSun,
  IconMoon,
  IconDeviceDesktop,
  IconHome,
} from "@tabler/icons-react"

import { Button } from "@/components/ui/button"
import { useTheme } from "@/lib/theme-provider"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { theme, setTheme } = useTheme();
  const location = useLocation();

  const toggleTheme = () => {
    const themes: ('light' | 'dark' | 'system')[] = ['light', 'dark', 'system'];
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
  };

  const getThemeIcon = () => {
    switch (theme) {
      case 'light':
        return IconSun;
      case 'dark':
        return IconMoon;
      case 'system':
        return IconDeviceDesktop;
    }
  };

  const ThemeIcon = getThemeIcon();

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-2 px-3 py-2">
              <img src="/logo.png" alt="VWisper Logo" className="h-6 w-6 object-contain" />
              <span className="text-base font-semibold">VWisper</span>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              asChild
              className={location.pathname === "/dashboard" ? "bg-accent text-accent-foreground" : ""}
            >
              <Link to="/dashboard">
                <IconHome className="h-4 w-4" />
                <span>Home</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton 
              asChild
              className={location.pathname === "/settings" ? "bg-accent text-accent-foreground" : ""}
            >
              <Link to="/settings">
                <IconSettings className="h-4 w-4" />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex justify-center p-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-8 w-8"
          >
            <ThemeIcon className="h-4 w-4" />
            <span className="sr-only">Toggle theme</span>
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
